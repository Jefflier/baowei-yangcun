# -*- coding: utf-8 -*-
"""旁白生成：读 narration_*.json（{id: 文本}），用 edge-tts 合成 mp3，量时长写 durations.json
用法: python gen_tts.py narration_demo.json out_dir [voice] [rate]
"""
import sys, json, os, subprocess, asyncio
import edge_tts

src, out = sys.argv[1], sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else 'zh-CN-YunxiNeural'
rate = sys.argv[4] if len(sys.argv) > 4 else '+6%'
os.makedirs(out, exist_ok=True)
lines = json.load(open(src, encoding='utf-8'))
durf = os.path.join(out, 'durations.json')
durs = json.load(open(durf, encoding='utf-8')) if os.path.exists(durf) else {}
meta = json.load(open(os.path.join(out, 'meta.json'), encoding='utf-8')) if os.path.exists(os.path.join(out, 'meta.json')) else {}

async def one(k, text):
    f = os.path.join(out, k + '.mp3')
    # 文本没变就不重新合成
    if meta.get(k) == [text, voice, rate] and os.path.exists(f) and k in durs:
        return
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(f)
            break
        except Exception as e:
            print('retry', k, e)
            await asyncio.sleep(1.5)
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True)
    durs[k] = float(r.stdout.strip())
    meta[k] = [text, voice, rate]
    print(f'{k}: {durs[k]:.2f}s  {text}')

async def main():
    for k, t in lines.items():
        await one(k, t)
    json.dump(durs, open(durf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(meta, open(os.path.join(out, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('total', sum(durs[k] for k in lines), 's')

asyncio.run(main())
