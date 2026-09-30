"""Tiny AVM2 disassembler: print the ops of methods whose name contains a pattern.
usage: python tools/abc_dis.py file.swf classPattern methodPattern"""
import sys, os, struct
sys.path.insert(0, os.path.dirname(__file__))
from swflib import read_swf


class R:
    def __init__(self, d, p=0):
        self.d, self.p = d, p

    def u8(self):
        v = self.d[self.p]
        self.p += 1
        return v

    def u16(self):
        v = struct.unpack_from('<H', self.d, self.p)[0]
        self.p += 2
        return v

    def u30(self):
        r = 0
        sh = 0
        while True:
            b = self.d[self.p]
            self.p += 1
            r |= (b & 0x7f) << sh
            sh += 7
            if not b & 0x80:
                return r

    def s24(self):
        v = self.d[self.p] | (self.d[self.p + 1] << 8) | (self.d[self.p + 2] << 16)
        self.p += 3
        return v - (1 << 24) if v & 0x800000 else v


def parse_abc(d):
    r = R(d)
    r.u16() if False else None
    r.p = 4
    e = d.index(b'\0', r.p)
    r.p = e + 1
    r.u16(); r.u16()
    for _ in range(max(0, r.u30() - 1)):
        r.u30()
    for _ in range(max(0, r.u30() - 1)):
        r.u30()
    n = r.u30()
    r.p += 8 * max(0, n - 1)
    n = r.u30()
    strings = ['']
    for _ in range(max(0, n - 1)):
        l = r.u30()
        strings.append(d[r.p:r.p + l].decode('utf-8', 'replace'))
        r.p += l
    n = r.u30()
    nss = [(0, 0)]
    for _ in range(max(0, n - 1)):
        k = r.u8()
        nss.append((k, r.u30()))
    n = r.u30()
    for _ in range(max(0, n - 1)):
        c = r.u30()
        for _ in range(c):
            r.u30()
    n = r.u30()
    mn = [None]
    for _ in range(max(0, n - 1)):
        k = r.u8()
        if k in (7, 13):
            ns = r.u30(); nm = r.u30()
            mn.append(strings[nm])
        elif k in (15, 16):
            mn.append(strings[r.u30()])
        elif k in (17, 18):
            mn.append('?')
        elif k in (9, 14):
            nm = r.u30(); r.u30()
            mn.append(strings[nm])
        elif k in (27, 28):
            r.u30(); mn.append('?L')
        elif k == 29:
            nm = r.u30()
            c = r.u30()
            for _ in range(c):
                r.u30()
            mn.append('TN')
        else:
            raise ValueError('mn kind %d' % k)
    n = r.u30()
    methods = []
    for _ in range(n):
        pc = r.u30()
        r.u30()
        for _ in range(pc):
            r.u30()
        name = r.u30()
        fl = r.u8()
        if fl & 8:
            for _ in range(r.u30()):
                r.u30(); r.u8()
        if fl & 128:
            for _ in range(pc):
                r.u30()
        methods.append(strings[name])
    n = r.u30()
    for _ in range(n):
        r.u30()
        for _ in range(r.u30()):
            r.u30(); r.u30()

    def traits():
        for _ in range(r.u30()):
            r.u30()
            k = r.u8()
            kind = k & 15
            if kind in (0, 6):
                r.u30(); r.u30()
                if r.u30():
                    r.u8()
            elif kind in (1, 2, 3):
                r.u30(); r.u30()
            elif kind == 4:
                r.u30(); r.u30()
            elif kind == 5:
                r.u30(); r.u30()
            if k & 0x40:
                for _ in range(r.u30()):
                    r.u30()
    nc = r.u30()
    for _ in range(nc):
        r.u30(); r.u30()
        fl = r.u8()
        if fl & 8:
            r.u30()
        for _ in range(r.u30()):
            r.u30()
        r.u30()
        traits()
    for _ in range(nc):
        r.u30()
        traits()
    for _ in range(r.u30()):
        r.u30()
        traits()
    bodies = {}
    for _ in range(r.u30()):
        m = r.u30()
        r.u30(); r.u30(); r.u30(); r.u30()
        ln = r.u30()
        bodies[m] = d[r.p:r.p + ln]
        r.p += ln
        for _ in range(r.u30()):
            for _ in range(5):
                r.u30()
        traits()
    return strings, mn, methods, bodies


NOARG = {0x01: 'bkpt', 0x02: 'nop', 0x03: 'throw', 0x07: 'dxnslate', 0x09: 'label', 0x1C: 'pushwith', 0x1D: 'popscope',
         0x1E: 'nextname', 0x1F: 'hasnext', 0x20: 'pushnull', 0x21: 'pushundefined', 0x23: 'nextvalue', 0x26: 'pushtrue',
         0x27: 'pushfalse', 0x28: 'pushnan', 0x29: 'pop', 0x2A: 'dup', 0x2B: 'swap', 0x30: 'pushscope', 0x47: 'returnvoid',
         0x48: 'returnvalue', 0x57: 'newactivation', 0x64: 'getglobalscope', 0x70: 'convert_s', 0x73: 'convert_i',
         0x74: 'convert_u', 0x75: 'convert_d', 0x76: 'convert_b', 0x77: 'convert_o', 0x82: 'coerce_a', 0x85: 'coerce_s',
         0x87: 'astypelate', 0x90: 'negate', 0x91: 'increment', 0x93: 'decrement', 0x95: 'typeof', 0x96: 'not',
         0x97: 'bitnot', 0xA0: 'add', 0xA1: 'subtract', 0xA2: 'multiply', 0xA3: 'divide', 0xA4: 'modulo', 0xA5: 'lshift',
         0xA6: 'rshift', 0xA7: 'urshift', 0xA8: 'bitand', 0xA9: 'bitor', 0xAA: 'bitxor', 0xAB: 'equals',
         0xAC: 'strictequals', 0xAD: 'lessthan', 0xAE: 'lessequals', 0xAF: 'greaterthan', 0xB0: 'greaterequals',
         0xB1: 'instanceof', 0xB3: 'istypelate', 0xB4: 'in', 0xD0: 'getlocal0', 0xD1: 'getlocal1', 0xD2: 'getlocal2',
         0xD3: 'getlocal3', 0xD4: 'setlocal0', 0xD5: 'setlocal1', 0xD6: 'setlocal2', 0xD7: 'setlocal3', 0xF3: 'timestamp'}
U30 = {0x04: 'getsuper', 0x05: 'setsuper', 0x06: 'dxns', 0x08: 'kill', 0x25: 'pushshort', 0x2C: 'pushstring', 0x2D: 'pushint',
       0x2E: 'pushuint', 0x2F: 'pushdouble', 0x31: 'pushnamespace', 0x40: 'newfunction', 0x41: 'call', 0x42: 'construct',
       0x49: 'constructsuper', 0x53: 'applytype', 0x55: 'newobject', 0x56: 'newarray', 0x58: 'newclass', 0x59: 'getdescendants',
       0x5A: 'newcatch', 0x5D: 'findpropstrict', 0x5E: 'findproperty', 0x5F: 'finddef', 0x60: 'getlex', 0x61: 'setproperty',
       0x62: 'getlocal', 0x63: 'setlocal', 0x66: 'getproperty', 0x68: 'initproperty', 0x6A: 'deleteproperty', 0x6C: 'getslot',
       0x6D: 'setslot', 0x6E: 'getglobalslot', 0x6F: 'setglobalslot', 0x80: 'coerce', 0x86: 'astype', 0x92: 'inclocal',
       0x94: 'declocal', 0xB2: 'istype', 0xC2: 'inclocal_i', 0xC3: 'declocal_i', 0xF0: 'debugline', 0xF1: 'debugfile', 0xF2: 'bkptline'}
U30x2 = {0x32: 'hasnext2', 0x43: 'callmethod', 0x44: 'callstatic', 0x45: 'callsuper', 0x46: 'callproperty', 0x4A: 'constructprop',
         0x4C: 'callproplex', 0x4E: 'callsupervoid', 0x4F: 'callpropvoid'}
JUMPS = {0x0C: 'ifnlt', 0x0D: 'ifnle', 0x0E: 'ifngt', 0x0F: 'ifnge', 0x10: 'jump', 0x11: 'iftrue', 0x12: 'iffalse',
         0x13: 'ifeq', 0x14: 'ifne', 0x15: 'iflt', 0x16: 'ifle', 0x17: 'ifgt', 0x18: 'ifge', 0x19: 'ifstricteq', 0x1A: 'ifstrictne'}


def disasm(code, strings, mn):
    r = R(code)
    out = []
    while r.p < len(code):
        at = r.p
        op = r.u8()
        if op in NOARG:
            out.append('%04x %s' % (at, NOARG[op]))
        elif op in U30:
            v = r.u30()
            nm = U30[op]
            if op == 0x2C:
                out.append('%04x pushstring %r' % (at, strings[v]))
            elif op in (0x5D, 0x5E, 0x60, 0x66, 0x61, 0x68, 0x80, 0x59):
                out.append('%04x %s %s' % (at, nm, mn[v] if v < len(mn) else v))
            else:
                out.append('%04x %s %d' % (at, nm, v))
        elif op in U30x2:
            a = r.u30(); b = r.u30()
            nm = U30x2[op]
            if op in (0x46, 0x4A, 0x4C, 0x4E, 0x4F):
                out.append('%04x %s %s argc=%d' % (at, nm, mn[a] if a < len(mn) else a, b))
            else:
                out.append('%04x %s %d %d' % (at, nm, a, b))
        elif op in JUMPS:
            off = r.s24()
            out.append('%04x %s ->%04x' % (at, JUMPS[op], r.p + off))
        elif op == 0x24:
            b = r.u8()
            out.append('%04x pushbyte %d' % (at, b - 256 if b > 127 else b))
        elif op == 0x65:
            out.append('%04x getscopeobject %d' % (at, r.u8()))
        elif op == 0x1B:
            r.s24()
            c = r.u30()
            for _ in range(c + 1):
                r.s24()
            out.append('%04x lookupswitch' % at)
        elif op == 0xEF:
            r.u8(); r.u30(); r.u8(); r.u30()
            out.append('%04x debug' % at)
        else:
            out.append('%04x ?op_%02x' % (at, op))
            break
    return out


if __name__ == '__main__':
    s = read_swf(sys.argv[1])
    cpat, mpat = sys.argv[2], sys.argv[3]
    for t, d in s['tags']:
        if t != 82:
            continue
        strings, mn, methods, bodies = parse_abc(d)
        if not any(cpat in x for x in strings[:6]):
            continue
        for i, name in enumerate(methods):
            if mpat in name and i in bodies:
                print('###', name)
                for line in disasm(bodies[i], strings, mn):
                    if not line.split()[1].startswith('debug'):
                        print('  ', line)
