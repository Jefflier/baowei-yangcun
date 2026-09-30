"""Minimal SWF reader: tags, symbol table, shapes, sprites, bitmaps.
Used by tools/swf_survey.py and tools/swf_export.py to turn the vector art in
tdsheep_swf/*.swf into JSON the HTML5 game can draw on a canvas."""
import struct, zlib


class Bits:
    def __init__(self, data, pos=0):
        self.d = data
        self.p = pos
        self.bit = 0  # bits consumed in current byte (0..7)

    def align(self):
        if self.bit:
            self.p += 1
            self.bit = 0

    def ub(self, n):
        v = 0
        for _ in range(n):
            byte = self.d[self.p]
            v = (v << 1) | ((byte >> (7 - self.bit)) & 1)
            self.bit += 1
            if self.bit == 8:
                self.bit = 0
                self.p += 1
        return v

    def sb(self, n):
        if n == 0:
            return 0
        v = self.ub(n)
        if v & (1 << (n - 1)):
            v -= 1 << n
        return v

    def fb(self, n):
        return self.sb(n) / 65536.0

    # byte-aligned reads
    def u8(self):
        self.align()
        v = self.d[self.p]
        self.p += 1
        return v

    def u16(self):
        self.align()
        v = struct.unpack_from('<H', self.d, self.p)[0]
        self.p += 2
        return v

    def s16(self):
        self.align()
        v = struct.unpack_from('<h', self.d, self.p)[0]
        self.p += 2
        return v

    def u32(self):
        self.align()
        v = struct.unpack_from('<I', self.d, self.p)[0]
        self.p += 4
        return v

    def fixed8(self):
        return self.s16() / 256.0

    def cstr(self):
        self.align()
        e = self.d.index(b'\0', self.p)
        s = self.d[self.p:e].decode('utf-8', 'replace')
        self.p = e + 1
        return s

    def rect(self):
        n = self.ub(5)
        r = [self.sb(n) for _ in range(4)]
        self.align()
        return r  # twips: xmin,xmax,ymin,ymax

    def matrix(self):
        a, b, c, d, tx, ty = 1.0, 0.0, 0.0, 1.0, 0, 0
        if self.ub(1):
            n = self.ub(5)
            a = self.fb(n)
            d = self.fb(n)
        if self.ub(1):
            n = self.ub(5)
            b = self.fb(n)  # rotateskew0 -> b
            c = self.fb(n)  # rotateskew1 -> c
        n = self.ub(5)
        tx = self.sb(n)
        ty = self.sb(n)
        self.align()
        return [a, b, c, d, tx / 20.0, ty / 20.0]

    def cxform(self, alpha):
        has_add = self.ub(1)
        has_mul = self.ub(1)
        n = self.ub(4)
        mul = [256, 256, 256, 256]
        add = [0, 0, 0, 0]
        cnt = 4 if alpha else 3
        if has_mul:
            for i in range(cnt):
                mul[i] = self.sb(n)
        if has_add:
            for i in range(cnt):
                add[i] = self.sb(n)
        self.align()
        return {'mul': [m / 256.0 for m in mul], 'add': add}


def read_swf(path):
    raw = open(path, 'rb').read()
    sig = raw[:3]
    ver = raw[3]
    if sig == b'CWS':
        body = zlib.decompress(raw[8:])
    elif sig == b'FWS':
        body = raw[8:]
    else:
        raise ValueError('unsupported signature %r' % sig)
    b = Bits(body)
    frame = b.rect()
    rate = b.fixed8()
    nframes = b.u16()
    return {'version': ver, 'frame': frame, 'rate': rate, 'frames': nframes,
            'tags': list(iter_tags(body, b.p))}


def iter_tags(body, pos):
    n = len(body)
    while pos < n:
        h = struct.unpack_from('<H', body, pos)[0]
        pos += 2
        t = h >> 6
        ln = h & 0x3F
        if ln == 0x3F:
            ln = struct.unpack_from('<I', body, pos)[0]
            pos += 4
        yield (t, body[pos:pos + ln])
        pos += ln
        if t == 0:
            break


TAGNAMES = {
    0: 'End', 1: 'ShowFrame', 2: 'DefineShape', 4: 'PlaceObject', 5: 'RemoveObject',
    6: 'DefineBits', 8: 'JPEGTables', 9: 'SetBackgroundColor', 10: 'DefineFont',
    11: 'DefineText', 12: 'DoAction', 14: 'DefineSound', 20: 'DefineBitsLossless',
    21: 'DefineBitsJPEG2', 22: 'DefineShape2', 24: 'Protect', 26: 'PlaceObject2',
    28: 'RemoveObject2', 32: 'DefineShape3', 33: 'DefineText2', 34: 'DefineButton2',
    35: 'DefineBitsJPEG3', 36: 'DefineBitsLossless2', 37: 'DefineEditText',
    39: 'DefineSprite', 43: 'FrameLabel', 45: 'SoundStreamHead2', 46: 'DefineMorphShape',
    48: 'DefineFont2', 56: 'ExportAssets', 69: 'FileAttributes', 70: 'PlaceObject3',
    72: 'DoABC(old)', 73: 'DefineFontAlignZones', 74: 'CSMTextSettings', 75: 'DefineFont3',
    76: 'SymbolClass', 77: 'Metadata', 78: 'DefineScalingGrid', 82: 'DoABC',
    83: 'DefineShape4', 84: 'DefineMorphShape2', 86: 'DefineSceneAndFrameLabelData',
    87: 'DefineBinaryData', 88: 'DefineFontName', 90: 'DefineBitsJPEG4', 91: 'DefineFont4',
}


def symbol_class(tags):
    out = {}
    for t, d in tags:
        if t == 76:
            b = Bits(d)
            n = b.u16()
            for _ in range(n):
                cid = b.u16()
                out[cid] = b.cstr()
        elif t == 56:
            b = Bits(d)
            n = b.u16()
            for _ in range(n):
                cid = b.u16()
                out[cid] = b.cstr()
    return out


# ---------------------------------------------------------------- shapes
def parse_gradient(b, ver, focal=False):
    m = b.matrix()
    b.align()
    spread_interp = b.u8()
    spread = spread_interp >> 6
    n = spread_interp & 15
    stops = []
    for _ in range(n):
        ratio = b.u8()
        col = read_color(b, ver >= 3)
        stops.append((ratio, col))
    fp = b.fixed8() if focal else 0
    return {'m': m, 'stops': stops, 'spread': spread, 'focal': fp}


def read_color(b, alpha):
    r = b.u8()
    g = b.u8()
    bl = b.u8()
    a = b.u8() if alpha else 255
    return [r, g, bl, a]


def parse_fill_style(b, ver):
    """One FILLSTYLE record (also used on its own by LineStyle2 'has fill' lines)."""
    t = b.u8()
    if t == 0:
        return {'t': 'solid', 'c': read_color(b, ver >= 3)}
    if t in (0x10, 0x12, 0x13):
        g = parse_gradient(b, ver, focal=(t == 0x13))
        g['t'] = 'lin' if t == 0x10 else 'rad'
        return g
    if t in (0x40, 0x41, 0x42, 0x43):
        bid = b.u16()
        m = b.matrix()
        return {'t': 'bmp', 'id': bid, 'm': m, 'smooth': t in (0x40, 0x41),
                'repeat': t in (0x40, 0x42)}
    raise ValueError('fill type %x' % t)


def parse_fill_styles(b, ver):
    n = b.u8()
    if n == 0xFF and ver >= 2:
        n = b.u16()
    return [parse_fill_style(b, ver) for _ in range(n)]


def parse_line_styles(b, ver):
    n = b.u8()
    if n == 0xFF:
        n = b.u16()
    out = []
    for _ in range(n):
        if ver == 4:
            w = b.u16()
            b.ub(2)  # start cap
            b.ub(2)  # join
            nocap = None
            b.ub(1)  # hasfill
            b.ub(1)
            b.ub(1)
            b.ub(1)
            b.ub(1)
            b.ub(2)
            b.align()
            raise NotImplementedError('LineStyle2')
        w = b.u16()
        out.append({'w': w / 20.0, 'c': read_color(b, ver >= 3)})
    return out


def parse_line_styles2(b):
    n = b.u8()
    if n == 0xFF:
        n = b.u16()
    out = []
    for _ in range(n):
        w = b.u16()
        b.ub(2)
        b.ub(2)
        hasfill = b.ub(1)
        b.ub(1)
        b.ub(1)
        b.ub(1)
        b.ub(1)
        b.ub(2)
        b.align()
        # join style 2 => miter limit (only when join==2). Re-read handled below
        raise NotImplementedError


def parse_shape_body(b, ver, fills, lines):
    """Returns list of paths grouped per style: [{fill:idx|None, line:idx|None, d:[...cmds]}]"""
    nfb = b.ub(4)
    nlb = b.ub(4)
    x = y = 0
    fill0 = fill1 = line = 0
    edges = []  # (fill0, fill1, line, [segments...]) as list of subpaths
    segs = []   # current list of drawing commands for the current style run
    cur = {'f0': 0, 'f1': 0, 'ln': 0, 'cmds': [], 'start': (0, 0)}
    runs = []

    def flush():
        nonlocal cur
        if cur['cmds']:
            runs.append(cur)
        cur = {'f0': cur['f0'], 'f1': cur['f1'], 'ln': cur['ln'], 'cmds': [], 'start': (x, y)}

    while True:
        typeflag = b.ub(1)
        if not typeflag:
            flags = b.ub(5)
            if flags == 0:
                break
            new_styles = flags & 16
            chg_line = flags & 8
            chg_f1 = flags & 4
            chg_f0 = flags & 2
            move = flags & 1
            if move:
                n = b.ub(5)
                nx = b.sb(n)
                ny = b.sb(n)
                flush()
                x, y = nx, ny
                cur['start'] = (x, y)
                cur['cmds'] = []
            else:
                flush()
            if chg_f0:
                cur['f0'] = b.ub(nfb)
            if chg_f1:
                cur['f1'] = b.ub(nfb)
            if chg_line:
                cur['ln'] = b.ub(nlb)
            if new_styles:
                b.align()
                # styles table for the following runs: caller must offset indices
                new_f = parse_fill_styles(b, ver)
                if ver == 4:
                    new_l = parse_line_styles_v4(b)
                else:
                    new_l = parse_line_styles(b, ver)
                fbase = len(fills)
                lbase = len(lines)
                fills.extend(new_f)
                lines.extend(new_l)
                cur['fbase'] = fbase
                cur['lbase'] = lbase
                nfb = b.ub(4)
                nlb = b.ub(4)
            if move and not cur['cmds']:
                cur['cmds'].append(('M', x, y))
        else:
            straight = b.ub(1)
            if not cur['cmds']:
                cur['cmds'].append(('M', x, y))
            if straight:
                n = b.ub(4) + 2
                if b.ub(1):
                    dx = b.sb(n)
                    dy = b.sb(n)
                elif b.ub(1):
                    dx = 0
                    dy = b.sb(n)
                else:
                    dx = b.sb(n)
                    dy = 0
                x += dx
                y += dy
                cur['cmds'].append(('L', x, y))
            else:
                n = b.ub(4) + 2
                cx = x + b.sb(n)
                cy = y + b.sb(n)
                ax = cx + b.sb(n)
                ay = cy + b.sb(n)
                x, y = ax, ay
                cur['cmds'].append(('Q', cx, cy, x, y))
    flush()
    b.align()
    return runs


def parse_line_styles_v4(b):
    n = b.u8()
    if n == 0xFF:
        n = b.u16()
    out = []
    for _ in range(n):
        w = b.u16()
        b.ub(2)  # start cap
        join = b.ub(2)
        hasfill = b.ub(1)
        b.ub(1)  # nohscale
        b.ub(1)  # novscale
        b.ub(1)  # pixel hinting
        b.ub(5)  # reserved
        b.ub(1)  # noclose
        b.ub(2)  # end cap
        b.align()
        if join == 2:
            b.u16()
        if hasfill:       # LineStyle2 carries ONE FillStyle (not a counted array)
            out.append({'w': w / 20.0, 'c': None, 'fill': parse_fill_style(b, 3)})
        else:
            out.append({'w': w / 20.0, 'c': read_color(b, True)})
    return out


def parse_define_shape(t, d):
    b = Bits(d)
    sid = b.u16()
    ver = {2: 1, 22: 2, 32: 3, 83: 4}[t]
    bounds = b.rect()
    if ver == 4:
        b.rect()  # edge bounds
        b.ub(8)   # flags
    fills = parse_fill_styles(b, ver)
    lines = parse_line_styles_v4(b) if ver == 4 else parse_line_styles(b, ver)
    runs = parse_shape_body(b, ver, fills, lines)
    return sid, {'bounds': [v / 20.0 for v in bounds], 'fills': fills, 'lines': lines, 'runs': runs, 'ver': ver}


def _rev(cmds):
    """Reverse a command list (M, L, Q...) so it can be chained."""
    pts = []
    for c in cmds:
        if c[0] == 'M':
            pts.append(('M', c[1], c[2]))
        elif c[0] == 'L':
            pts.append(('L', c[1], c[2]))
        else:
            pts.append(('Q', c[1], c[2], c[3], c[4]))
    # build edge list
    edges = []
    px, py = pts[0][1], pts[0][2]
    for c in pts[1:]:
        if c[0] == 'L':
            edges.append(('L', px, py, c[1], c[2]))
            px, py = c[1], c[2]
        else:
            edges.append(('Q', px, py, c[3], c[4], c[1], c[2]))
            px, py = c[3], c[4]
    return edges


def shape_to_paths(shape):
    """Group edges by fill / line styles, chain them into closed subpaths.
    Returns {'fills': [(styleIndex, [[cmd,...],...]) ...], 'lines': [(styleIndex, [[cmd..]])...]}
    Each cmd: ['M',x,y] ['L',x,y] ['Q',cx,cy,x,y]; coordinates in twips."""
    fill_edges = {}
    line_edges = {}
    fbase = 0
    lbase = 0
    for run in shape['runs']:
        if 'fbase' in run:
            fbase = run['fbase']
            lbase = run['lbase']
        cmds = run['cmds']
        if len(cmds) < 2:
            continue
        edges = _rev(cmds)
        f0 = run['f0']
        f1 = run['f1']
        ln = run['ln']
        f0i = f0 + fbase if f0 else 0
        f1i = f1 + fbase if f1 else 0
        lni = ln + lbase if ln else 0
        for e in edges:
            if f1i:
                fill_edges.setdefault(f1i, []).append(e)
            if f0i:
                fill_edges.setdefault(f0i, []).append(_flip(e))
            if lni:
                line_edges.setdefault(lni, []).append(e)
    return {'fills': {k: _chain(v) for k, v in fill_edges.items()},
            'lines': {k: _chain(v) for k, v in line_edges.items()}}


def _flip(e):
    if e[0] == 'L':
        return ('L', e[3], e[4], e[1], e[2])
    return ('Q', e[3], e[4], e[1], e[2], e[5], e[6])


def _chain(edges):
    """Join edges end-to-start into subpaths."""
    from collections import defaultdict
    start = defaultdict(list)
    for i, e in enumerate(edges):
        start[(e[1], e[2])].append(i)
    used = [False] * len(edges)
    paths = []
    for i, e in enumerate(edges):
        if used[i]:
            continue
        used[i] = True
        path = [e]
        cur = e
        while True:
            key = (cur[3], cur[4])
            nxt = None
            for j in start.get(key, []):
                if not used[j]:
                    nxt = j
                    break
            if nxt is None:
                break
            used[nxt] = True
            cur = edges[nxt]
            path.append(cur)
        cmds = [['M', path[0][1], path[0][2]]]
        for p in path:
            if p[0] == 'L':
                cmds.append(['L', p[3], p[4]])
            else:
                cmds.append(['Q', p[5], p[6], p[3], p[4]])
        paths.append(cmds)
    return paths


# ------------------------------------------------------------- sprites
def parse_place(t, d):
    b = Bits(d)
    o = {'op': 'place'}
    if t == 4:
        o['id'] = b.u16()
        o['depth'] = b.u16()
        o['m'] = b.matrix()
        if b.p < len(d):
            o['cx'] = b.cxform(False)
        o['new'] = True
        return o
    flags = b.u8()
    flags2 = b.u8() if t == 70 else 0
    o['depth'] = b.u16()
    if t == 70 and (flags2 & 8 or (flags2 & 16 and flags & 2)):
        o['cls'] = b.cstr()
    if flags & 2:
        o['id'] = b.u16()
    o['move'] = bool(flags & 1)
    if flags & 4:
        o['m'] = b.matrix()
    if flags & 8:
        o['cx'] = b.cxform(True)
    if flags & 16:
        o['ratio'] = b.u16()
    if flags & 32:
        o['name'] = b.cstr()
    if flags & 64:
        o['clip'] = b.u16()
    return o


def parse_sprite(d, tags_out=None):
    b = Bits(d)
    sid = b.u16()
    nframes = b.u16()
    frames = []
    cur = []
    labels = {}
    for t, dd in iter_tags(d, b.p):
        if t == 1:
            frames.append(cur)
            cur = []
        elif t in (4, 26, 70):
            cur.append(parse_place(t, dd))
        elif t == 5:
            bb = Bits(dd)
            bb.u16()
            cur.append({'op': 'remove', 'depth': bb.u16()})
        elif t == 28:
            bb = Bits(dd)
            cur.append({'op': 'remove', 'depth': bb.u16()})
        elif t == 43:
            labels[Bits(dd).cstr()] = len(frames)
    if cur:
        frames.append(cur)
    return sid, {'nframes': nframes, 'frames': frames, 'labels': labels}


def parse_bitmap(t, d, jpegtables=None):
    """Return (id, ('png'|'jpg', bytes)) - alpha bitmaps become PNG."""
    import io
    b = Bits(d)
    cid = b.u16()
    if t == 20 or t == 36:
        fmt = b.u8()
        w = b.u16()
        h = b.u16()
        ncol = b.u8() + 1 if fmt == 3 else 0
        raw = zlib.decompress(d[b.p:])
        return cid, ('raw', {'fmt': fmt, 'w': w, 'h': h, 'ncol': ncol, 'alpha': t == 36, 'data': raw})
    if t == 21:
        return cid, ('jpg', d[2:])
    if t == 35 or t == 90:
        alen = struct.unpack_from('<I', d, 2)[0]
        off = 6
        if t == 90:
            off = 8
        jpg = d[off:off + alen]
        alpha = zlib.decompress(d[off + alen:])
        return cid, ('jpga', {'jpg': jpg, 'alpha': alpha})
    if t == 6:
        return cid, ('jpgtables', d[2:])
    raise ValueError(t)
