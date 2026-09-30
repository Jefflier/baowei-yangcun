// 把录制的帧序列 + 音频编码成 mp4
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const FFMPEG = 'C:\\ffmpeg\\bin\\ffmpeg.exe';
export function run(args, opts = {}) {
  const r = spawnSync(FFMPEG, args, { stdio: opts.quiet ? 'pipe' : ['ignore', 'inherit', 'inherit'], maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.error(r.stderr?.toString().slice(-2000)); throw new Error('ffmpeg failed: ' + args.slice(0, 6).join(' ')); }
}

// 变帧率截图序列 → 60fps 恒定帧率 mp4（无音频）
export function encodeFrames(recDir, out, { fps = 60, crf = 17, from = 0, to = null, extraVf = '' } = {}) {
  const meta = JSON.parse(fs.readFileSync(path.join(recDir, 'meta.json'), 'utf8'));
  const ts = meta.frames, n = ts.length;
  const lines = [];
  const t0 = ts[from];
  const last = to == null ? n : to;
  for (let i = from; i < last; i++) {
    const nextT = i + 1 < n ? ts[i + 1] : meta.endTs;
    const dur = Math.max(0.001, nextT - ts[i]);
    lines.push(`file 'frames/f${String(i).padStart(6, '0')}.jpg'`, `duration ${dur.toFixed(5)}`);
  }
  lines.push(`file 'frames/f${String(last - 1).padStart(6, '0')}.jpg'`);
  const list = path.join(recDir, 'list.txt');
  fs.writeFileSync(list, lines.join('\n'));
  run(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=${fps},scale=1920:1080:flags=lanczos,format=yuv420p${extraVf}`, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-r', String(fps), '-an', out]);
  return meta;
}

// 等间隔帧序列 → mp4（无音频）
export function encodeSeq(dir, out, { fps = 60, crf = 17, pattern = 'f%05d.jpg', extraVf = '' } = {}) {
  run(['-y', '-framerate', String(fps), '-i', path.join(dir, pattern), '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p' + extraVf, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-r', String(fps), '-an', out]);
}
