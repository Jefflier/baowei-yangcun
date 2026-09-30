# 保卫羊村 · B站宣传视频（介绍 + 实机演示）

成片在 `output/`：

| 文件 | 内容 |
|---|---|
| `保卫羊村_介绍+演示.mp4` | 完整版：介绍片 53.5 秒 + 实机演示 123.7 秒，共约 2 分 57 秒，1080p / 60fps |
| `intro.mp4` | 只有介绍片 |
| `demo.mp4` | 只有实机演示 |

## 目录

- `narration_intro.json` / `narration_demo.json`：配音+字幕的文案（一行一段，改字后重新生成即可；也可以照着文案自己录音）
- `tts_intro/`、`tts_demo/`：合成好的旁白 mp3 与时长表
- `intro/`：介绍片页面（`intro.html`）、素材截图（`img/`）、统计数字
- `tools/`：全部脚本

## 重新生成（游戏改动后 / 想改文案）

需要：Node 22、Python（edge-tts）、ffmpeg、Chrome。先在游戏目录起一个本地服务（端口 8765）：

```bash
cd E:\game && python tools/devserver.py 8765
```

然后在 `video/` 下依次：

```bash
# 1. 改了文案就重新合成旁白（音色 zh-CN-YunxiNeural，语速 +10%）
python tools/gen_tts.py narration_demo.json tts_demo zh-CN-YunxiNeural +10%
python tools/gen_tts.py narration_intro.json tts_intro zh-CN-YunxiNeural +10%

# 2. 录制实机演示（约 2 分钟，无头 Chrome，不占用屏幕；产物在 _work/rec_demo）
node tools/demo_run.mjs

# 3. 截取介绍片素材、渲染介绍片
node tools/shot_title.mjs && node tools/capture_stills.mjs
node tools/render_intro.mjs

# 4. 编码、混音、拼接 → output/
node tools/final_mix.mjs demo
node tools/final_mix.mjs intro
node tools/final_mix.mjs concat
```

`demo_run.mjs` 是一段全自动「真人操作」脚本（平滑鼠标轨迹、点击涟漪、字幕、高亮圈），
想换关卡 / 换布阵，改里面的格子坐标即可。
