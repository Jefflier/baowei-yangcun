"""Export the original wolf unit models (gameUI/dynamic/<id>.swf) into sprite sheets.

Each wolf SWF holds a 4-frame "direction chooser" sprite (labels d/l/u/r) whose frames point
at four animated sprites; every animated sprite carries a `move` block followed by a `dead`
block. We bake them into a fixed cell grid so the animation never jitters:

  assets/wolf/<id>.png        24 cols x 4 rows  (walk: d, l, u, r)
  assets/wolf/<id>_dead.png   12 cols x 4 rows  (death, every 3rd frame)
  assets/wolf/manifest.json   cell size, columns, the shared bbox + the frame counts

The browser step (tools/_wolfwork/sheet*.html -> Chrome screenshot -> slice) does the actual
rasterising; this script writes the intermediate pages.

usage: python tools/export_wolves.py [--batch 10] [--cell 96]
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from swf_svg import Doc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MONSTER_DIR = os.path.join(ROOT, 'tdsheep_swf', 'monster')
WORK = os.path.join(ROOT, 'tools', '_wolfwork')
OUT = os.path.join(ROOT, 'assets', 'wolf')


def wolf_files():
    out = []
    for f in sorted(glob.glob(os.path.join(MONSTER_DIR, '*.swf'))):
        base = os.path.basename(f)[:-4]
        if base[:1] == 'm' and base[1:].isdigit():
            continue                      # m1..m18 are map tiles, not wolves
        out.append((base, f))
    return out


def analyse(path):
    d = Doc(path)
    chooser = None
    for sid, sp in sorted(d.sprites.items()):
        if sp['nframes'] == 4 and {'d', 'l', 'u', 'r'} <= set(sp['labels']):
            chooser = sid
            break
    if chooser is None:
        return None
    sp = d.sprites[chooser]
    by_frame = {v: k for k, v in sp['labels'].items()}      # frame -> 'd'|'l'|'u'|'r'
    dirs = {}
    for fi, fr in enumerate(sp['frames']):
        kids = [o['id'] for o in fr if o.get('id') in d.sprites]
        if kids and fi in by_frame:
            dirs[by_frame[fi]] = kids[-1]
    if len(dirs) != 4:
        return None
    anim = d.sprites[dirs['d']]
    move_at = anim['labels'].get('move', 0)
    dead_at = anim['labels'].get('dead', anim['nframes'])
    walk_n = dead_at - move_at
    dead_n = anim['nframes'] - dead_at
    return d, dirs, walk_n, dead_n, move_at, dead_at


def frame_flat(d, sid, idx):
    fl = d.flat(sid, idx)
    return fl


def collect(files, batch_size, cell):
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, 'manifest.json')
    manifest = {}
    if '--only' in sys.argv and os.path.exists(man_path):
        try:                                   # 增量导出：保留已有条目
            manifest = json.load(open(man_path, encoding='utf-8')).get('wolves', {})
        except Exception:  # noqa: BLE001
            manifest = {}
    batch, pages = [], []
    for wid, path in files:
        info = analyse(path)
        if not info:
            print('skip (no direction chooser):', wid)
            continue
        d, dirs, walk_n, dead_n, move_at, dead_at = info
        walk = {}
        dead = {}
        bbox = [1e9, 1e9, -1e9, -1e9]
        for k, sid in dirs.items():
            walk[k] = []
            for i in range(walk_n):
                fl = frame_flat(d, sid, move_at + i)
                if fl:
                    walk[k].append(fl)
                    v = fl['vb']
                    bbox[0] = min(bbox[0], v[0]); bbox[1] = min(bbox[1], v[1])
                    bbox[2] = max(bbox[2], v[0] + v[2]); bbox[3] = max(bbox[3], v[1] + v[3])
            dead[k] = []
            for i in range(0, dead_n, 3):
                fl = frame_flat(d, sid, dead_at + i)
                if fl:
                    dead[k].append(fl)
                    v = fl['vb']
                    bbox[0] = min(bbox[0], v[0]); bbox[1] = min(bbox[1], v[1])
                    bbox[2] = max(bbox[2], v[0] + v[2]); bbox[3] = max(bbox[3], v[1] + v[3])
        if bbox[0] > bbox[2]:
            continue
        pad = 2
        bbox = [bbox[0] - pad, bbox[1] - pad, bbox[2] - bbox[0] + 2 * pad, bbox[3] - bbox[1] + 2 * pad]
        entry = {'walk': walk, 'dead': dead, 'bbox': [round(v, 2) for v in bbox],
                 'walkN': len(walk['d']), 'deadN': len(dead['d'])}
        batch.append((wid, entry))
        manifest[wid] = {'cell': cell, 'cols': entry['walkN'], 'rows': 4,
                         'deadCols': entry['deadN'], 'bbox': entry['bbox']}
        if len(batch) >= batch_size:
            pages.append(batch); batch = []
    if batch:
        pages.append(batch)

    svg_only = '--svg-only' in sys.argv
    page_index = []
    sizes = []
    for i, page in enumerate(pages):
        if not svg_only:
            data = {wid: e for wid, e in page}
            with open(os.path.join(WORK, 'batch%d.js' % i), 'w', encoding='utf-8') as fh:
                fh.write('window.WOLFBATCH = %s;\n' % json.dumps(data, separators=(',', ':')))
            html = SHEET_HTML.replace('__BATCH__', 'batch%d.js' % i).replace('__CELL__', str(cell))
            with open(os.path.join(WORK, 'sheet%d.html' % i), 'w', encoding='utf-8') as fh:
                fh.write(html)
        svg = page_svg(page, cell)
        with open(os.path.join(WORK, 'sheet%d.svg' % i), 'w', encoding='utf-8') as fh:
            fh.write(svg)
        cols = max(e['walkN'] + e['deadN'] for _w, e in page)
        sizes.append([cols * cell, 4 * len(page) * cell, len(svg)])
        page_index.append([wid for wid, _e in page])
    with open(os.path.join(WORK, 'pages.json'), 'w', encoding='utf-8') as fh:
        json.dump({'cell': cell, 'pages': page_index, 'sizes': sizes}, fh, indent=1)
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump({'cell': cell, 'wolves': manifest}, fh, ensure_ascii=False, indent=1)
    print('wolves %d  pages %d  cell %d' % (len(manifest), len(pages), cell))
    return len(pages)


SHEET_HTML = '''<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#000;overflow:hidden}
canvas{display:block;margin:0}
</style>
<body><canvas id="c"></canvas>
<script src="../assets/art/tower.js"></script>
<script src="../js/art_original.js"></script>
<script src="__BATCH__.js"></script>
<script>
const CELL = __CELL__;
const ids = Object.keys(window.WOLFBATCH);
const DIRS = ['d','l','u','r'];
const walkCols = Math.max(...ids.map(id => window.WOLFBATCH[id].walkN));
const deadCols = Math.max(...ids.map(id => window.WOLFBATCH[id].deadN));
const cols = walkCols + deadCols;
const c = document.getElementById('c');
c.width = cols * CELL; c.height = ids.length * 4 * CELL;
const ctx = c.getContext('2d');

function drawFrame(fr, cell) {
  const vb = fr.vb;
  const k = Math.min(cell / vb[2], cell / vb[3]);
  ctx.save();
  ctx.translate((cell - vb[2]*k)/2, (cell - vb[3]*k)/2);
  ctx.scale(k, k);
  ctx.translate(-vb[0], -vb[1]);
  for (const q of fr.p) {
    ctx.save();
    ctx.transform(q.t[0],q.t[1],q.t[2],q.t[3],q.t[4],q.t[5]);
    const m = Path2D, p = new Path2D(q.d);
    if (q.f) { ctx.fillStyle = paint(ctx, q.f); ctx.fill(p, q.r === 'evenodd' ? 'evenodd' : 'nonzero'); }
    if (q.s) { ctx.strokeStyle = css(q.s.c); ctx.lineWidth = q.s.w; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke(p); }
    ctx.restore();
  }
  ctx.restore();
}
function css(c){ return 'rgba('+c[0]+','+c[1]+','+c[2]+','+(c[3]/255)+')'; }
function paint(ctx, g) {
  if (g.k === 'solid') return css(g.c);
  let grad;
  if (g.k === 'lin') grad = ctx.createLinearGradient(g.p0[0],g.p0[1],g.p1[0],g.p1[1]);
  else grad = ctx.createRadialGradient(g.c[0],g.c[1],0,g.c[0],g.c[1],Math.max(g.r,0.01));
  for (const s of g.stops) grad.addColorStop(Math.max(0,Math.min(1,s[0])), css(s[1]));
  return grad;
}

ids.forEach((id, row) => {
  const e = window.WOLFBATCH[id];
  DIRS.forEach((dr, di) => {
    const y = (row*4 + di) * CELL;
    (e.walk[dr] || []).forEach((fr, i) => { ctx.save(); ctx.translate(i*CELL, y); drawFrame(fr, CELL); ctx.restore(); });
    (e.dead[dr] || []).forEach((fr, i) => { ctx.save(); ctx.translate((e.walkN + i)*CELL, y); drawFrame(fr, CELL); ctx.restore(); });
  });
});
document.title = 'sheet ' + ids.length + ' wolves ' + c.width + 'x' + c.height;
</script>
'''


def esc(t):
    return (t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))


def frame_svg(fr, x, y, cell, defs):
    """One animation frame as an SVG group placed at (x, y) in a cell-sized box."""
    vb = fr['vb']
    k = min(cell / vb[2], cell / vb[3])
    ox = x + (cell - vb[2] * k) / 2 - vb[0] * k
    oy = y + (cell - vb[3] * k) / 2 - vb[1] * k
    out = ['<g transform="translate(%.2f %.2f) scale(%.4f)">' % (ox, oy, k)]
    for q in fr['p']:
        t = 'matrix(%s)' % ' '.join('%.4f' % v for v in q['t'])
        if q.get('f'):
            g = q['f']
            if g['k'] == 'solid':
                c = g['c']
                paint = 'fill="rgb(%d,%d,%d)" fill-opacity="%.3f"' % (c[0], c[1], c[2], c[3] / 255)
            else:
                gid = 'g%d' % len(defs)
                stops = ''.join('<stop offset="%.3f" stop-color="rgb(%d,%d,%d)" stop-opacity="%.3f"/>'
                                % (s[0], s[1][0], s[1][1], s[1][2], s[1][3] / 255) for s in g['stops'])
                if g['k'] == 'lin':
                    defs.append('<linearGradient id="%s" gradientUnits="userSpaceOnUse" x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f">%s</linearGradient>'
                                % (gid, g['p0'][0], g['p0'][1], g['p1'][0], g['p1'][1], stops))
                else:
                    defs.append('<radialGradient id="%s" gradientUnits="userSpaceOnUse" cx="%.2f" cy="%.2f" r="%.2f">%s</radialGradient>'
                                % (gid, g['c'][0], g['c'][1], max(g['r'], 0.01), stops))
                paint = 'fill="url(#%s)"' % gid
            out.append('<path d="%s" transform="%s" fill-rule="%s" %s/>'
                       % (esc(q['d']), t, 'evenodd' if q.get('r') == 'evenodd' else 'nonzero', paint))
        if q.get('s'):
            c = q['s']['c']
            out.append('<path d="%s" transform="%s" fill="none" stroke="rgb(%d,%d,%d)" stroke-opacity="%.3f" stroke-width="%.2f" stroke-linecap="round" stroke-linejoin="round"/>'
                       % (esc(q['d']), t, c[0], c[1], c[2], c[3] / 255, q['s']['w']))
    out.append('</g>')
    return ''.join(out)


def page_svg(page, cell):
    cols = max(e['walkN'] + e['deadN'] for _w, e in page)
    rows = 4 * len(page)
    W, H = cols * cell, rows * cell
    defs = []
    body = []
    for row, (_wid, e) in enumerate(page):
        for di, dr in enumerate(('d', 'l', 'u', 'r')):
            y = (row * 4 + di) * cell
            for i, fr in enumerate(e['walk'].get(dr, [])):
                body.append(frame_svg(fr, i * cell, y, cell, defs))
            for i, fr in enumerate(e['dead'].get(dr, [])):
                body.append(frame_svg(fr, (e['walkN'] + i) * cell, y, cell, defs))
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">'
            '<defs>%s</defs>%s</svg>' % (W, H, W, H, ''.join(defs), ''.join(body)))


def main():
    batch_size = 10
    cell = 96
    only = None
    if '--batch' in sys.argv:
        batch_size = int(sys.argv[sys.argv.index('--batch') + 1])
    if '--cell' in sys.argv:
        cell = int(sys.argv[sys.argv.index('--cell') + 1])
    if '--only' in sys.argv:
        only = {s.strip() for s in sys.argv[sys.argv.index('--only') + 1].split(',') if s.strip()}
    files = [(wid, p) for wid, p in wolf_files() if not only or wid in only]
    print('exporting %d wolves' % len(files))
    collect(files, batch_size, cell)


if __name__ == '__main__':
    main()
