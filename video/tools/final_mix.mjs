// 编码 + 混音 + 拼接：node final_mix.mjs demo|intro|concat
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { encodeFrames, encodeSeq, run, FFMPEG } from './assemble.mjs';

const W = 'E:/game/video/_work', OUT = 'E:/game/video/output';
fs.mkdirSync(OUT, { recursive: true });
const LAG = 0.09;
const TRIM = Number(process.env.TRIM || 0.6);   // 演示开头裁掉的静默秒数                 // 截屏帧比声音大约晚 0.1 秒
const GAME_VOL = Number(process.env.GAME_VOL || 0.9);
const mode = process.argv[2];
const probeDur = f => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.toString().trim());

// narr: [{file, at(秒)}]，bed: {file, vol, loop, off} 底噪（游戏音频或 BGM）
function mixAudio({ narr, bed, dur, out, fadeOut = 0 }) {
  const inputs = []; const fc = [];
  let k = 0;
  if (bed.loop) inputs.push('-stream_loop', '-1');
  inputs.push('-i', bed.file); const bedIdx = k++;
  narr.forEach(n => { inputs.push('-i', n.file); });
  const off = bed.off || 0, bedOff = Math.max(0, Math.round(off * 1000));
  const head = off < 0 ? `atrim=start=${(-off).toFixed(3)},asetpts=PTS-STARTPTS,` : `adelay=${bedOff}:all=1,`;
  fc.push(`[${bedIdx}:a]aresample=48000,aformat=channel_layouts=stereo,${head}volume=${bed.vol}${fadeOut ? `,afade=t=in:st=0:d=0.8,afade=t=out:st=${(dur - fadeOut).toFixed(2)}:d=${fadeOut}` : ''}[bed]`);
  narr.forEach((n, i) => {
    fc.push(`[${i + 1}:a]loudnorm=I=-15:LRA=7:TP=-1.5,aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.max(0, Math.round(n.at * 1000))}:all=1[n${i}]`);
  });
  const nl = narr.map((_, i) => `[n${i}]`).join('');
  fc.push(`${nl}amix=inputs=${narr.length}:normalize=0:duration=longest[nar]`);
  fc.push(`[nar]asplit=2[nar1][nar2]`);
  fc.push(`[bed][nar1]sidechaincompress=threshold=0.015:ratio=10:attack=15:release=500:makeup=1[bd]`);
  fc.push(`[bd][nar2]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95,apad[mix]`);
  run(['-y', ...inputs, '-filter_complex', fc.join(';'), '-map', '[mix]', '-t', dur.toFixed(3), '-c:a', 'aac', '-b:a', '192k', out]);
}

function mux(video, audio, out) {
  run(['-y', '-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out]);
}

if (mode === 'demo') {
  const rec = W + '/rec_demo';
  const m = JSON.parse(fs.readFileSync(rec + '/meta.json', 'utf8'));
  const silent = W + '/demo_silent.mp4';
  const from = m.frames.findIndex(t => t - m.frames[0] >= TRIM);
  const base = m.frames[from];
  encodeFrames(rec, silent, { from, extraVf: ',fade=t=in:st=0:d=0.4' });
  const dur = probeDur(silent);
  console.log('demo video', dur.toFixed(2), 's');
  const narr = m.narr.map(n => ({ file: `E:/game/video/tts_demo/${n.id}.mp3`, at: m.t0 + n.start - base }));
  mixAudio({ narr, bed: { file: rec + '/game_audio.webm', vol: GAME_VOL, off: m.audioT0 / 1000 - base + LAG }, dur, out: W + '/demo_audio.m4a' });
  mux(silent, W + '/demo_audio.m4a', OUT + '/demo.mp4');
  console.log('done demo.mp4');
} else if (mode === 'intro') {
  const plan = JSON.parse(fs.readFileSync(W + '/intro_plan.json', 'utf8'));
  const silent = W + '/intro_silent.mp4';
  const total = plan.total;
  const nFrames = fs.readdirSync(W + '/intro_frames').length;
  encodeSeq(W + '/intro_frames', silent, { extraVf: `,fade=t=out:st=${(nFrames / 60 - 0.35).toFixed(3)}:d=0.35` });
  const dur = probeDur(silent);
  console.log('intro video', dur.toFixed(2), 's (plan', total.toFixed(2), ')');
  const narr = plan.narr.map(n => ({ file: `E:/game/video/tts_intro/${n.id}.mp3`, at: n.start }));
  mixAudio({ narr, bed: { file: 'E:/game/tdsheep_swf/gameSound_fight001.mp3', vol: Number(process.env.BGM_VOL || 1.5), loop: true }, dur, out: W + '/intro_audio.m4a', fadeOut: 0.9 });
  mux(silent, W + '/intro_audio.m4a', OUT + '/intro.mp4');
  console.log('done intro.mp4');
} else if (mode === 'concat') {
  const list = W + '/concat.txt';
  fs.writeFileSync(list, `file '${OUT}/intro.mp4'\nfile '${OUT}/demo.mp4'\n`);
  run(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT + '/保卫羊村_介绍+演示.mp4']);
  console.log('done final');
}
