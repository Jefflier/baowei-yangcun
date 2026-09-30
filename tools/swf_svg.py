"""Render symbols from a SWF library to standalone SVG strings (flat output: every path carries
its own composite transform, so clip layers and bbox tracking are simple).

usage:  python tools/swf_svg.py tdsheep_swf/gameUI_sheep.swf out_dir [Class1 Class2 ...]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from swflib import *


def mmul(m1, m2):
    """Apply m2 first, then m1  (m = m1 * m2)."""
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1]


IDENT = [1, 0, 0, 1, 0, 0]


def cx_compose(outer, inner):
    """colour = outer(inner(c))"""
    if outer is None:
        return inner
    if inner is None:
        return outer
    mul = [outer['mul'][i] * inner['mul'][i] for i in range(4)]
    add = [outer['add'][i] * 1 + inner['add'][i] * outer['mul'][i] for i in range(4)]
    return {'mul': mul, 'add': add}


def cx_apply(cx, col):
    if cx is None:
        return col
    return [max(0, min(255, col[i] * cx['mul'][i] + cx['add'][i])) for i in range(4)]


def f2(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return s if s not in ('-0', '') else '0'


def rgba(col):
    r, g, b, a = col
    return 'rgb(%d,%d,%d)' % (round(r), round(g), round(b)), a / 255.0


def col4(col):
    """[r,g,b,a] rounded - used by the flat (canvas/Path2D) output."""
    return [int(round(col[0])), int(round(col[1])), int(round(col[2])), int(round(col[3]))]


def path_d(subpaths):
    out = []
    for sp in subpaths:
        for c in sp:
            if c[0] == 'M':
                out.append('M%s %s' % (f2(c[1] / 20), f2(c[2] / 20)))
            elif c[0] == 'L':
                out.append('L%s %s' % (f2(c[1] / 20), f2(c[2] / 20)))
            else:
                out.append('Q%s %s %s %s' % (f2(c[1] / 20), f2(c[2] / 20), f2(c[3] / 20), f2(c[4] / 20)))
        out.append('Z')
    return ''.join(out)


class Doc:
    def __init__(self, path):
        self.path = path
        self.swf = read_swf(path)
        tags = self.swf['tags']
        self.sym = symbol_class(tags)
        self.by_name = {v: k for k, v in self.sym.items()}
        self.shapes = {}
        self.sprites = {}
        self.bad = []
        for t, d in tags:
            try:
                if t in (2, 22, 32, 83):
                    sid, sh = parse_define_shape(t, d)
                    sh['paths'] = shape_to_paths(sh)
                    self.shapes[sid] = sh
                elif t == 39:
                    sid, sp = parse_sprite(d)
                    self.sprites[sid] = sp
            except Exception as e:  # keep going, report at the end
                self.bad.append((t, repr(e)))
        self._states = {}
        self._gid = 0

    # -- display list simulation for a sprite --------------------------------
    def states(self, sid):
        if sid in self._states:
            return self._states[sid]
        sp = self.sprites[sid]
        cur = {}
        out = []
        for ops in sp['frames']:
            for o in ops:
                dep = o['depth']
                if o['op'] == 'remove':
                    cur.pop(dep, None)
                    continue
                if o.get('new') or ('id' in o and not o.get('move')):
                    cur[dep] = {'id': o['id'], 'm': o.get('m', IDENT), 'cx': o.get('cx'),
                                'clip': o.get('clip'), 'name': o.get('name')}
                else:
                    ex = cur.get(dep)
                    if ex is None:
                        continue
                    ex = dict(ex)
                    if 'id' in o:
                        ex['id'] = o['id']
                    if 'm' in o:
                        ex['m'] = o['m']
                    if 'cx' in o:
                        ex['cx'] = o['cx']
                    if 'clip' in o:
                        ex['clip'] = o['clip']
                    cur[dep] = ex
            out.append({d: dict(v) for d, v in cur.items()})
        self._states[sid] = out
        return out

    def nframes(self, sid):
        return len(self.states(sid)) if sid in self.sprites else 1

    # -- rendering -----------------------------------------------------------
    def emit_shape(self, sid, m, cx, out, defs, bbox, clipmode=False):
        sh = self.shapes.get(sid)
        if not sh:
            return
        tf = 'matrix(%s %s %s %s %s %s)' % tuple(f2(v) for v in m)
        paths = sh['paths']
        for idx in sorted(paths['fills']):
            sub = paths['fills'][idx]
            if not sub:
                continue
            d = path_d(sub)
            self._bb(sub, m, bbox)
            if clipmode:
                out.append('<path d="%s" transform="%s"/>' % (d, tf))
                continue
            fs = sh['fills'][idx - 1] if 0 < idx <= len(sh['fills']) else None
            if fs is None:
                continue
            fill_attr = self.fill_attr(fs, cx, defs)
            if fill_attr is None:
                continue
            out.append('<path d="%s" transform="%s" fill-rule="evenodd" %s/>' % (d, tf, fill_attr))
        if clipmode:
            return
        for idx in sorted(paths['lines']):
            sub = paths['lines'][idx]
            ls = sh['lines'][idx - 1] if 0 < idx <= len(sh['lines']) else None
            if not ls or not sub:
                continue
            col = ls['c']
            if col is None:
                continue
            c, a = rgba(cx_apply(cx, col))
            w = max(ls['w'], 0.05)
            d = path_d(sub).replace('Z', '')
            self._bb(sub, m, bbox, pad=w / 2)
            out.append('<path d="%s" transform="%s" fill="none" stroke="%s" stroke-opacity="%s" '
                       'stroke-width="%s" stroke-linecap="round" stroke-linejoin="round"/>' % (d, tf, c, f2(a), f2(w)))

    def _bb(self, sub, m, bbox, pad=0):
        a, b, c, d, e, f = m
        for sp in sub:
            for cmd in sp:
                xs = [(cmd[1], cmd[2])] if cmd[0] != 'Q' else [(cmd[3], cmd[4])]
                for x, y in xs:
                    x /= 20.0
                    y /= 20.0
                    X = a * x + c * y + e
                    Y = b * x + d * y + f
                    bbox[0] = min(bbox[0], X - pad)
                    bbox[1] = min(bbox[1], Y - pad)
                    bbox[2] = max(bbox[2], X + pad)
                    bbox[3] = max(bbox[3], Y + pad)

    def fill_attr(self, fs, cx, defs):
        t = fs['t']
        if t == 'solid':
            c, a = rgba(cx_apply(cx, fs['c']))
            return 'fill="%s" fill-opacity="%s"' % (c, f2(a))
        if t in ('lin', 'rad'):
            self._gid += 1
            gid = 'g%d' % self._gid
            m = fs['m']
            gt = 'matrix(%s %s %s %s %s %s)' % tuple(f2(v) for v in m)
            stops = []
            for ratio, col in fs['stops']:
                c, a = rgba(cx_apply(cx, col))
                stops.append('<stop offset="%s" stop-color="%s" stop-opacity="%s"/>' % (f2(ratio / 255.0), c, f2(a)))
            if t == 'lin':
                defs.append('<linearGradient id="%s" gradientUnits="userSpaceOnUse" x1="-819.2" x2="819.2" '
                            'gradientTransform="%s">%s</linearGradient>' % (gid, gt, ''.join(stops)))
            else:
                fx = fs.get('focal', 0) * 819.2
                defs.append('<radialGradient id="%s" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="819.2" '
                            'fx="%s" fy="0" gradientTransform="%s">%s</radialGradient>' % (gid, f2(fx), gt, ''.join(stops)))
            return 'fill="url(#%s)"' % gid
        if t == 'bmp':
            return 'fill="rgb(200,200,200)" fill-opacity="0.5"'
        return None

    def render(self, cid, frame, m, cx, out, defs, bbox, pick=None, depth=0):
        """Draw character `cid` (at its timeline `frame`) into out."""
        if depth > 12:
            return
        if cid in self.shapes:
            self.emit_shape(cid, m, cx, out, defs, bbox)
            return
        if cid not in self.sprites:
            return
        st = self.states(cid)
        if not st:
            return
        frame = max(0, min(frame, len(st) - 1))
        dl = st[frame]
        depths = sorted(dl)
        i = 0
        while i < len(depths):
            dep = depths[i]
            o = dl[dep]
            if o.get('clip'):
                clipto = o['clip']
                cdefs = []
                cpaths = []
                self._render_clip(o['id'], m, o['m'], cpaths, bbox)
                self._gid += 1
                cid_ = 'c%d' % self._gid
                defs.append('<clipPath id="%s" clip-rule="evenodd">%s</clipPath>' % (cid_, ''.join(cpaths)))
                inner = []
                j = i + 1
                while j < len(depths) and depths[j] <= clipto:
                    oo = dl[depths[j]]
                    self._render_obj(oo, m, cx, inner, defs, bbox, pick, depth)
                    j += 1
                out.append('<g clip-path="url(#%s)">%s</g>' % (cid_, ''.join(inner)))
                i = j
                continue
            self._render_obj(o, m, cx, out, defs, bbox, pick, depth)
            i += 1

    def _render_clip(self, cid, parent_m, m, out, bbox):
        mm = mmul(parent_m, m)
        if cid in self.shapes:
            self.emit_shape(cid, mm, None, out, [], bbox, clipmode=True)
        elif cid in self.sprites:
            st = self.states(cid)
            if st:
                for dep in sorted(st[0]):
                    o = st[0][dep]
                    self._render_clip(o['id'], mm, o['m'], out, bbox)

    def _render_obj(self, o, m, cx, out, defs, bbox, pick, depth):
        cid = o['id']
        mm = mmul(m, o['m'])
        cc = cx_compose(cx, o.get('cx'))
        f = 0
        if cid in self.sprites:
            f = pick(cid, self) if pick else 0
        self.render(cid, f, mm, cc, out, defs, bbox, pick, depth + 1)

    def svg(self, cid, frame=0, pick=None, pad=2, size=None):
        out, defs, bbox = [], [], [1e9, 1e9, -1e9, -1e9]
        self._gid = 0
        self.render(cid, frame, IDENT, None, out, defs, bbox, pick)
        if bbox[0] > bbox[2]:
            return None
        x0, y0 = bbox[0] - pad, bbox[1] - pad
        w, h = bbox[2] - bbox[0] + 2 * pad, bbox[3] - bbox[1] + 2 * pad
        return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s" width="%s" height="%s">'
                '<defs>%s</defs>%s</svg>' % (f2(x0), f2(y0), f2(w), f2(h), f2(w), f2(h),
                                             ''.join(defs), ''.join(out)))

    # -- flat output: primitives that a canvas can replay with Path2D ----------
    def _fill_json(self, fs, cx):
        t = fs['t']
        if t == 'solid':
            return {'k': 'solid', 'c': col4(cx_apply(cx, fs['c']))}
        if t in ('lin', 'rad'):
            m = fs['m']
            stops = [[round(ratio / 255.0, 3), col4(cx_apply(cx, col))] for ratio, col in fs['stops']]
            if t == 'lin':
                p0 = [m[0] * -819.2 + m[4], m[1] * -819.2 + m[5]]
                p1 = [m[0] * 819.2 + m[4], m[1] * 819.2 + m[5]]
                return {'k': 'lin', 'p0': [round(v, 2) for v in p0], 'p1': [round(v, 2) for v in p1],
                        'stops': stops}
            det = abs(m[0] * m[3] - m[1] * m[2])
            return {'k': 'rad', 'c': [round(m[4], 2), round(m[5], 2)],
                    'r': round(819.2 * math.sqrt(det), 2), 'stops': stops}
        if t == 'bmp':
            return {'k': 'solid', 'c': [200, 200, 200, 128]}
        return None

    def emit_shape_flat(self, sid, m, cx, out, bbox):
        sh = self.shapes.get(sid)
        if not sh:
            return
        tf = [round(v, 3) for v in m]
        paths = sh['paths']
        for idx in sorted(paths['fills']):
            sub = paths['fills'][idx]
            if not sub or not (0 < idx <= len(sh['fills'])):
                continue
            f = self._fill_json(sh['fills'][idx - 1], cx)
            if f is None:
                continue
            self._bb(sub, m, bbox)
            out.append({'t': tf, 'd': path_d(sub), 'f': f, 'r': 'evenodd'})
        for idx in sorted(paths['lines']):
            sub = paths['lines'][idx]
            if not sub or not (0 < idx <= len(sh['lines'])):
                continue
            ls = sh['lines'][idx - 1]
            if not ls or ls['c'] is None:
                continue
            w = max(ls['w'], 0.05)
            self._bb(sub, m, bbox, pad=w / 2)
            out.append({'t': tf, 'd': path_d(sub).replace('Z', ''),
                        's': {'c': col4(cx_apply(cx, ls['c'])), 'w': round(w, 2)}})

    def render_flat(self, cid, frame, m, cx, out, bbox, depth=0, inside=True):
        if depth > 12:
            return
        if cid in self.shapes:
            if inside:
                self.emit_shape_flat(cid, m, cx, out, bbox)
            return
        if cid in self.sprites:
            st = self.states(cid)
            if not st:
                return
            dl = st[max(0, min(frame, len(st) - 1))]
            skip = getattr(self, '_skip', ())
            only = getattr(self, '_only', ())
            for dep in sorted(dl):
                o = dl[dep]
                if o['id'] in skip:
                    continue
                mm = mmul(m, o['m'])
                self.render_flat(o['id'], 0, mm, cx_compose(cx, o.get('cx')), out, bbox, depth + 1,
                                 inside or o['id'] in only)
            return
        # clip layers arrive here with an id that is not a shape/sprite: skip

    def flat(self, cid, frame=0, pad=2, skip=None, only=None):
        """Return {'vb':[x,y,w,h],'p':[...]} - everything baked, no SVG needed.

        skip: sprite ids left out of the render (e.g. the ruby baked into the inlay tower).
        only: render just the sub-tree(s) rooted at these sprite ids, in the same coordinate
              system as the full render (so the layer lines up when drawn with the same origin)."""
        out, bbox = [], [1e9, 1e9, -1e9, -1e9]
        self._skip = set(skip or ())
        self._only = set(only or ())
        try:
            self.render_flat(cid, frame, IDENT, None, out, bbox, 0, not self._only)
        finally:
            self._skip = set()
            self._only = set()
        if not out:
            return None
        if bbox[0] > bbox[2]:
            return None
        x0, y0 = bbox[0] - pad, bbox[1] - pad
        return {'vb': [round(x0, 2), round(y0, 2),
                       round(bbox[2] - bbox[0] + 2 * pad, 2), round(bbox[3] - bbox[1] + 2 * pad, 2)],
                'p': out}


def main():
    path = sys.argv[1]
    outdir = sys.argv[2]
    want = sys.argv[3:]
    os.makedirs(outdir, exist_ok=True)
    doc = Doc(path)
    print('shapes', len(doc.shapes), 'sprites', len(doc.sprites), 'bad', doc.bad[:5])
    for cid, name in sorted(doc.sym.items()):
        if want and name not in want:
            continue
        n = doc.nframes(cid)
        for fr in range(min(n, 1 if not want else 40)):
            s = doc.svg(cid, fr)
            if s is None:
                continue
            fn = os.path.join(outdir, '%s%s.svg' % (name.replace('.', '_'), '' if n == 1 else '_f%02d' % fr))
            open(fn, 'w', encoding='utf-8').write(s)
        print(name, 'frames', n)


if __name__ == '__main__':
    main()
