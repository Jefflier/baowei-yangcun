# 原版模型复原管线（羊 / 狼 / 塔）

> 除单位模型外，**大厅、世界地图、战斗底图**也是从原客户端里挖出来直接用的，
> 见 §9（`tools/build_scene.py` / `tools/build_maps.py`）。

这份文档记录「怎么把原作模型搬到本作里」的完整过程：数据从哪来、用什么工具解、
产物长什么样、怎么接进游戏，以及哪些是**原作矢量原样**、哪些是**照着截图手搓**的。

## 1. 结论先说

| 模型 | 来源 | 保真度 |
|---|---|---|
| 羊（7 种表情/状态） | 原客户端 `gameUI_sheep.swf` | **矢量原样**，逐点还原 |
| 5 种防御塔 × 5 档外观 | 原客户端 `gameUI_tower.swf` | **矢量原样** |
| 辅助建筑 / 机关（盘龙柱、牛郎织女、元宵灯楼…） | `gameUI_tower.swf` | **矢量原样** |
| 障碍物、地形、路径、弹簧 | `gameUI_tower.swf` / `gameUI_landform.swf` | **矢量原样** |
| 特效 / 技能图标 / 子弹 | `gameUI_effect/swf、skill.swf、bullet.swf` | **矢量原样** |
| 界面素材（资源图标 / 道具图标 / 按钮） | `gameUI_material.swf`、`gameUI_item.swf` | **矢量原样**（按名字挑着导，见 §10） |
| 狼身上的道具（气球 / 间谍狼 / 火把…） | `gameUI_wolf.swf` | **矢量原样**（见 §11） |
| 狼（已取回 113 种模型，覆盖 130 / 132 种狼） | 原站 `gameUI/dynamic/<id>.swf` | **原作矢量原样**：4 朝向 × N 帧行走 + 死亡动画 |

**踩过的坑：别拿资料里的键直接当文件名。** 早先那一轮只按 `js/data.js` 的键（`al_B`、`xuel_B`、
`yll_B`…）去探测，`_A / _B / _Z` 后缀那一批全部 404，于是被记成「原站没有」。
实际上服务端复用了基础模型的 SWF：去掉后缀就能命中（`al_B → al.swf`、`xuel_B/Z → xuel.swf`、
`yll_B / yll_B2 → yll.swf`、`daomu2_Z → daomu2.swf`、`D_glykl → glykl.swf`…），
这一轮一下补回 **16 个模型**（`al`、`amstl`、`chidunl`、`gzl`、`hlbb1`、`hlbb2`、`jisil`、
`meilyu`、`meinvl`、`sdsl`、`sdxhl`、`wushengl`、`xuel`、`yangpil`、`yemanl`、`yll`）。
现在 113 个模型覆盖 **130 / 132** 种狼（`tools/wolf_coverage.py` 出报告），
只有 `wjxcl_B 玩具小丑` 和 `xxgl_B 吸血鬼狼` 原站确实没有，退回程序化绘制。

狼的单位模型不在客户端包里，而是服务器按需加载的单独 SWF
（`DynamicLoad.getMonsterURL` → `gameUI/dynamic/<res>.swf`）。
**关键点：`res` 就是社区资料里那 132 种狼的 ID**（`js/data.js` 的键：`baozul`、`bdl`、`sdys`、`zblw`…），
于是可以直接把这些键当文件名去探测原站——一次命中 97 个，全部下载到 `tdsheep_swf/monster/`。
剩下的狼可以用同样的办法继续补（`tools/probe_wolf_res.py --full`）。

`js/art_wolf.js`（手搓骨架）现在只作为**图集缺失时的兜底**保留。

## 2. 数据来源（原客户端）

`tdsheep_swf/` 是从原作客户端下载/解包的静态资源：

```
MainClass.swf            全部 AS3 代码（413 个 DoABC）
TDSheepMain.swf          启动器
gameUI_sheep.swf         羊：sheepHigh / sheepFear / sheepCry / sheepAnger / sheepAfraid / sleepSheep / dreamSheep
gameUI_tower.swf         5 种塔 + 辅助建筑 + 障碍物（塔每符号 6 帧：第 0 帧是建造占位，1..5 是五档外观）
gameUI_landform.swf      路径、可建/不可建网格、弹簧、光环、木箱、影子
gameUI_effect.swf        62 种特效（燃烧、中毒、护盾、闪电、召唤…）
gameUI_skill.swf         42 个技能/抗性图标
gameUI_bullet.swf        24 种子弹
gameUI_item.swf / material.swf  道具与 UI 素材（尚未接入）
xmlFile_*.xml            原作配置与文案（**镜像站上是被裁过的**：config/string_cn 只剩文案属性，
                         数值属性在镜像端就被剥掉了，见 docs/ASSET_COLLECTION.md §4.1）
monster/m1..m18.swf      运行时抓到的 `gameUI/dynamic/m<N>.swf`（实为**地图地块**，不是狼）
```

从 AS3 反汇编（`tools/abc_dis.py`、`tools/abc_find.py`）确认的关键规则：

```
getMapURL(id)     = <base>/images/swf/ + "gameUI/dynamic/" + id + ".swf" + "?v=" + $vMap
getMonsterURL(res)= <base>/images/swf/ + "gameUI/dynamic/" + res + ".swf" + "?v=" + $vWolf
URL_UI = "gameUI/dynamic/"   URL_SWF = ".swf"   GlobalString.VERSION = "?v="
class 名以 m0..m9 开头 → 当地图处理；含 "mfx" → 防线图；含 "TheWorld" → 世界地图；其余 → 按狼加载
```

狼的 `res` 名字完全来自服务端配置，客户端里搜不到，原 Qzone CDN
（`app16488.imgcache.qzoneapp.com`）已下线，社区镜像上按常见前缀枚举也没命中，
所以没有继续在生产环境里穷举。

### 2.1 一次抓齐原站素材

镜像站（`https://tdsheep.tdsheepvillage.com/`）**只能按完整路径取文件**：目录列表一律 403，
所以清单得从客户端自己那儿来。`tools/fetch_site_assets.py` 汇总了三处：

1. 线上 `xmlFile/initXML.xml` 的 `<swfData>` 列出的 16 支固定资源
   （`gameUI/{landform,material,wolf,tower,sheep,bullet,effect,item,skill}.swf`、
   `gameUI/dynamic/{TheWorld,TheStronghold,TheStronghold_tame,TheStronghold_arena}.swf`、
   `gameUI/Font_num_HYHHJ.swf`、`MainClass.swf`）加 4 个 `xmlFile/*.xml`；
2. `js/data.js` 里所有狼的 id，外加地图配置引用到的 `sm / rb / prop / boss / fb`——
   并且**同时试「去掉 `_A/_B/_Z` 后缀」的写法**（这一条是这轮补回 16 个模型的关键）；
3. 地图地块 `gameUI/dynamic/m1..m18.swf`（外加 `mfx1/mfx2` 两张防线图）。

```bash
python tools/fetch_site_assets.py --probe     # 只 HEAD，列出「线上有、本地没有」的
python tools/fetch_site_assets.py             # 下载缺的；--force 全部重下
```

落盘沿用仓库里的扁平命名（`gameUI_tower.swf`、`tdsheep_swf/monster/<id>.swf`），
清单写进 `tdsheep_swf/site_assets.json`（哪些拿到、哪些 404）。
实测线上总共约 **150 个文件 / 6.8 MB**，本地已经全部拿齐。

## 3. 工具链

| 工具 | 作用 |
|---|---|
| `tools/swflib.py` | 纯 Python 的 SWF 解析：标签、形状、精灵时间线、位图、字体、ABC |
| `tools/swf_svg.py` | SWF 形状/精灵 → SVG（含渐变、裁剪、色变矩阵），并提供 `flat()` 输出画布可直接回放的数据 |
| `tools/export_assets.py` | **一键导出**：`assets/svg/*` + `assets/art/*.js` + `assets/art/manifest.json` |
| `tools/abc_dis.py` / `abc_find.py` | 反汇编 AS3，定位资源路径/加载逻辑 |
| `tools/probe_monster_swf.py` / `probe_names.py` | 只发 HEAD 的探测脚本（确认哪些资源还在服务器上） |
| `tools/fetch_refs.py` / `montage.py` / `crop_zoom.py` | 抓参考图、拼图册、局部放大（多模态比对用） |
| `tools/svg_sheet.py` | 把 `assets/svg/<库>/*.svg` 拼成一张网页图册，挑符号名用 |
| `tools/fetch_site_assets.py` | 按 `initXML` + `js/data.js` 把原站的 SWF/XML **一次抓齐**（`--probe` 只看不下载） |
| `tools/wolf_coverage.py` | 报告 132 种狼里哪些有原图集、哪些是复用基础模型、哪些没有 |
| `tools/probe_mirror.py` | **SWF 之外**的素材探测：静态图 / `gameSound` 音频 / 配置 XML（支持分组，清单按 URL 合并） |
| `tools/fetch_community_data.py` | 抓社区 lineup 仓库：数值 `data.js` + 47 张地图布局图 + 提取脚本 |
| `tools/export_config_data.py` | `xmlFile_*.xml` → `tdsheep_swf/data/*.json`（狼图鉴 / 文案 / 引导 / 地图名） |
| `tools/abc_dump_strings.py` | 把所有 DoABC 的字符串常量池转成文本，便于 grep（音效名就是这么找到的） |
| `tools/make_collect_page.py` / `tools/extra_sheet.py` | 生成素材收集台 `collect_check.html` 与图片图册 |
| 无头 Chrome 截图 | 每个校验台都是 HTML，用 `chrome --headless --screenshot` 出图后肉眼比对 |

重新生成资产：

```bash
python tools/export_assets.py            # 全部
python tools/export_assets.py tower sheep
```

重新生成**狼**的精灵图（原作 4 向 × 24 帧行走 + 死亡动画）：

```bash
python tools/probe_wolf_res.py --full --save tools/_meta/wolf_res.json   # 扫原站有哪些狼
python tools/fetch_wolf_res.py tools/_meta/wolf_res.json                 # 下载到 tdsheep_swf/monster/
powershell -ExecutionPolicy Bypass -File tools/build_wolves.ps1          # 烘成 assets/wolf/*.png
python tools/optimize_wolf_png.py 255                                    # 调色板量化（113 只：32 MB -> 18.5 MB）
python tools/probe_wolf_more.py                                          # 还没找到的狼，按命名变体再扫一轮
```

`build_wolves.ps1` 的流程是：`export_wolves.py` 把每批狼的 4×24（+4×12 死亡）帧排成一张大 SVG，
无头 Chrome 按画布尺寸截图光栅化，`slice_wolves.py` 再按固定单元格切成
`assets/wolf/<id>.png` 与 `<id>_dead.png`，并写出 `assets/wolf/manifest.json`。

几个踩过的坑（都已修好，别再走一遍）：

* 截图必须带 `--default-background-color=00000000`，否则图集是**白底**；
* Chrome 是 GUI 程序，PowerShell 里用 `& $Chrome ...` 要接 `| Out-Null`（或 `Start-Process -Wait`）
  才会等它跑完，否则一句 `2>$null` 就会立刻返回、什么都不生成；
* 每页都用同一个 `--user-data-dir` 会让后续启动"合并进已运行实例"而不截图，所以每次运行用新 profile；
* `.ps1` 里别写中文：PowerShell 5.1 按 ANSI 读无 BOM 的 UTF-8 文件，中文会把解析器搞崩；
* 透明没生效时**不要**用大容差洪泛抠白（会把狼脸上的白色一起吃掉），宁可重渲。

## 4. 产物格式

### `assets/svg/<库>/<名字>[_fNN].svg`
真正的 SVG（原坐标 /20），方便用别的引擎或矢量软件打开。

### `assets/art/<库>.js`
画布可以直接回放的扁平图元，按库挂到 `window.SVA_ART`：

```js
window.SVA_ART.tower.shaota = { frames: [ { vb:[x,y,w,h], p:[ ...图元... ] }, ... ] };
// 图元：{ t:[a,b,c,d,e,f], d:"M…", f:{k:'solid'|'lin'|'rad', …}, s:{c:[r,g,b,a], w} }
```

`js/art_original.js`（`SVAArt`）负责回放：缓存 `Path2D`、还原线性/径向渐变、
按 `anchor` 对齐、支持缩放/翻转/淡出。

```js
SVAArt.draw(ctx, 'tower', 'shaota', {frame: 3, x, y, scale: cs / 72, anchor: 'bottom'});
SVAArt.draw(ctx, 'sheep', 'sheepCry', {frame: 2, x, y, w: 60, anchor: 'bottom'});
```

## 5. 接进游戏

`index.html` 里按顺序加载：资产 → `js/art_original.js` → `js/art_chars.js` → `js/art_original_pack.js`。

`js/art_original_pack.js` 用「包装而非改写」的方式替换美术：

* `Art.drawTower` → 原版塔矢量，按 `lv / max` 取 5 档外观（分档点 0.3 / 0.55 / 0.8 / 1.0，与原有 tier 一致），
  另叠一个宝石色点与 80% 以上的金色等级牌；
* `Art.drawSheep` → 原版 7 种表情，按 `mood` 映射，行走时循环帧；
* `Art.drawWolf` → 默认仍用原来的程序化狼；把 `window.SVA_ORIGINAL_ART.wolf = true` 即切到手搓狼骨架。

想完全回到程序化美术：删掉 `index.html` 里那几行资产 `<script>`，或设
`window.SVA_ORIGINAL_ART = {tower:false, sheep:false, wolf:false}`。

> ⚠️ **开关默认值必须逐键补**。`window.SVA_ORIGINAL_ART` 是多个模块共用的一个对象，
> 而 `js/art_units_original.js`（它只关心 `units`）会**先**把它建成 `{}`。
> 所以「`SVA_ORIGINAL_ART` 不存在时才给默认值」这种写法是错的 —— 它会拿到一个空对象，
> `cfg.tower` 是 `undefined`（falsy），于是塔/羊/狼被**悄悄退回程序化绘制**，
> 而关卡、地图这些用 `=== false` 判断的模块照常显示原画，看起来「只是塔不对」。
> 现在 `js/art_original_pack.js` 用 `if (cfg.tower === undefined) cfg.tower = true;` 逐键补默认值。
> 新增开关时照这个写法。

## 6. 手搓狼模型的做法（多模态）

狼的单位模型在客户端里不存在，只能照着**实机画面**复原。流程如下：

1. **取参考**：
   * 图片搜索：`tools/fetch_refs.py "保卫羊村 狼" tools/_refs/wolf`；
   * 视频抽帧（B 站）：`tools/bili_search.py "保卫羊村"` 找实机视频 → `yt-dlp` 下低码率整片，
     或 `tools/bili_frame.py BV号 秒数…` 用直链 + ffmpeg 定点抽帧（注意分P要用 `BV号?p=N`，
     直链会过期，脚本每帧重新取一次）；
   * 抽出来的帧用 `tools/montage.py` 拼成图册先扫一遍，再用 `tools/crop_zoom.py` 放大到 600%~1200%。
2. **量化**：`tools/silhouette.py crop.png` 会打印 ASCII 剪影 + 深/中/浅三种冷色的像素占比。
   实测原版狼：**头部（含鬃毛与口鼻）占整体高度约 72%**、身体+腿只占约 22%，整体接近正方形，
   深色 `#273437`、中灰蓝 `#54676a`、浅灰 `#99a6a9`。手上的模型一开始头身比例是 55:45，量化后就改对了。
3. **拆结构**：深蓝黑鬃毛（外缘/后脑）→ 头顶偏灰蓝的高光带 → 下半部偏前的浅灰脸面 →
   向右前方伸出的厚口鼻（上灰下白）→ 鼻尖黑点 → 白色杏眼 + 黑瞳（主眼在前、副眼被鬃毛压掉一半）
   → 小白肚皮 + 四条短腿 + 拖地粗尾。
4. **参数化骨架**：`js/art_wolf.js` 里 `furball()` 负责「一团毛」（主块 + 沿弧线撒几撮，剪影不会太光滑），
   `head()` 负责五官分层，`tail()` 沿下坠曲线摆一串递减毛团；8 向 = 前 3/4 与后 3/4 两组 + 左右镜像，
   走路用相位驱动四肢摆动与身体起伏。
5. **上色**：`SVAWolf.palFor(狼名)` 按名字关键字（冰/火/毒/电/石/沙/BOSS…）给整套配色，
   也可以给狼定义加 `__pal` 精调。
6. **对照校验**：`tools/wolf_vs_ref.html` 把原作截图放大图与手搓模型并排渲染，截图后直接肉眼比对；
   `tools/wolf_sprite.html?dir=e` 可以把单只狼渲染成干净底图，方便再用 `silhouette.py` 量一次比例。

## 7. 校验台

| 页面 | 看什么 |
|---|---|
| `tools/original_lab.html` | 所有导出的原版矢量（羊 36 帧、塔 25 帧、建筑/机关/障碍/地形/技能/子弹/特效） |
| `tools/wolf_lab.html` | 狼的 8 向、行走循环、状态、配色变体，以及与原作截图的并排对照 |
| `tools/original_art_lab.html` | **接入后**的塔（5 档 × 5 种）与羊（6 种情绪） |
| `tools/scene_check.html` | 塔/羊/建筑/障碍/狼**同屏**，检查比例 |
| `tools/wolf_all_check.html` | 原作图集里**全部狼**（正面/侧面）铺开，逐个核对的底图 |
| `tools/wolf_video_check.html` | **跟 B 站实机录像逐只核对**：覆盖统计 + 每只狼「模型 vs 实拍抠图」+ 按分P 的核对卡片 |

最后两项是第二轮「对着实机录像逐只核对」的产物，方法、结论与缺口见
[`docs/WOLF_VIDEO_CHECK.md`](WOLF_VIDEO_CHECK.md)：录像覆盖 45/46 张图、128 只狼，
其中 126 只有原作模型、2 只（玩具小丑 / 吸血鬼狼）仍退回程序化绘制。

## 8. 已知差距与建议

* 狼目前是**一套骨架 + 名字猜色**，还没有 132 种各自的配件（冰晶、火焰、铠甲、王冠…）与
  原作逐帧动作；要更还原，建议按狼种补 `__pal` 和配件层。
* 塔的炮口朝向：原作是静态外观（本作也不旋转），若要做转向，需另画转向图层。
* `gameUI_item.swf`、`gameUI_material.swf` 里还有大量**面板底板 / 按钮**没接（现在只接了资源与道具图标，
  见 §10）；想接的话照着 `js/art_ui_original.js` 的路子加符号名即可。
* 原作狼单位模型如果在别处还能拿到（旧安装包、缓存 SWF、玩家存档中的 `res` 名），
  只要把文件放进 `tdsheep_swf/monster/`，`tools/swf_svg.py` 就能直接导出成同样的资产格式。
* **数值拿不到原文件**：镜像站的 `config.xml` 只留了 `s="文案"`（文件头 `<!--xpath#//@s-->`），
  带数值的属性在镜像端就被剥掉了；原 Qzone CDN 已下线，Internet Archive 上也无存档。
  目前数值以社区 `data.js`（《羊村百科全书 V1.82》整理）为准，详见 `docs/ASSET_COLLECTION.md`。
* **原作音效/音乐 35 个 mp3**（`tdsheep_swf/gameSound_*.mp3`）已接进游戏（`assets/audio/sounds.js` +
  `js/audio.js`），事件对应表是推断的，见 `docs/ASSET_COLLECTION.md` §9.1。大厅 / 地图音乐原作客户端里没有。

### 8.1 塔的外观（踩过的三个坑）

原作的塔符号是 **6 帧**：第 0 帧是「建造中」的通用占位（五座塔共用同一个 cid），1~5 帧才是五档外观
（石 → 蓝 → 黄 → 红 → 金）。`tools/export_assets.py` 用 `frames='1-5'` 只导出后五帧，
所以 **导出数据里的下标 0~4 就是五档**。

1. `js/art_original_pack.js` 的 `tierFrame()` 一开始返回 1~5，等于整体往上错了一档：
   一级塔直接显示第二档、最后两档长得一模一样。现在返回 0~4。
2. 原作会把**镶嵌的宝石画在塔身的插槽里**（不是旁边点一个小色点）。现在按各塔外框的
   比例把宝石画进插槽，见 `GEM_SOCKET` 表。
3. 等级数字：原作用 `building.levelBubble`（一个朝下的白色气泡）挂在塔顶写等级。
   `levelBubble` 是**单帧符号**，而导出配置写的是 `frames='1'`，一开始被当成「没有这一帧」丢掉了；
   `frame_list()` 现在对单帧符号直接取第 0 帧。不想要等级牌可以设
   `window.SVA_ORIGINAL_ART = {levelBadge: false}`。

4. **镶嵌塔要是空的，镶什么宝石就是什么颜色**（2026-09-30）。原画 `xiangqianta` 的塔身里烘了一颗**红宝石**
   （sprite 103 / shape 102，五档都有），所以不镶宝石也是红的，镶了别的颜色还会红底盖着。
   `tools/export_assets.py` 现在：① 导出塔身时把 sprite 103 摘掉（`Doc.flat(skip=[103])`）→ 空底座；
   ② 单独导出宝石层 `xiangqianta_gem`（`Doc.flat(only=[103])`，和塔身同一个原点，叠上去就对齐），
   把这颗原画宝石按 6 种宝石色改了色（HLS：色相平移、高光留亮、黑色去色压暗），
   **帧号 = 档位 × 6 + 宝石色序**（色序同 `SV.GEM_COLORS`：hong lv huang zi lan hei）。
   `js/art_original_pack.js` 的 `drawSocketGem` 对镶嵌塔画这一层，没镶宝石就什么都不画。
   校验台：`tools/_work/inlay_lab.html`（空底座五档 + 六色）。其它塔（哨 / 散弹 / 炮）的宝石仍是程序化画进插槽。
   注意：只跑 `python tools/export_assets.py tower` 会把 `manifest.json` 覆盖成只含 tower，要再跑一遍全量。

## 9. 场景与地图（大厅 / 世界地图 / 战斗底图）

这三块不是单位模型，而是**整张插画**，走的是「SVG → 无头 Chrome 光栅化 → PNG」这条路，
比逐图形还原省事得多，也最接近原版观感。

### 9.1 大厅与世界地图

```bash
python tools/build_scene.py --force     # → assets/scene/{village,world1..4}.png + flags.js
```

| 产物 | 来源符号 | 用途 |
|---|---|---|
| `assets/scene/village.png` | `TheStronghold.swf` → `TheStronghold` | 大厅（羊村）整张插画 |
| `assets/scene/world1..4.png` | `TheWorld.swf` → `TheWorld_fun_0..3` | 四块大陆的羊皮纸世界地图 |
| `assets/scene/flags.js` | 同上（自动标定） | 每张地图上关卡旗标的坐标 |

旗标标定：旗子是**黑边黄底**，用「饱和黄」做掩膜取连通域质心即可；
按行分组后再**蛇形排序**，正好对应关卡 1→N 的前进顺序。
四张地图的旗标数分别是 **11 / 14 / 12 / 9**，和 `js/data.js` 里第 1~4 章的关卡数
（11 / 14 / 12 / 9）**完全一致**——这也是「worldN ↔ 第 N 章」这个映射的验证。

接入层 `js/art_scene_pack.js` 做三件事：
1. 接掉 `Scene.build('hub'/'world')`，换成插画；插画是异步加载的，没到位时先画程序化版本，
   `onload` 之后 `Scene.invalidate()` 让下一帧重画；
2. 把大厅的可点建筑按插画坐标重排（`Scene.hubHotspots`，`ui_menu.js` 优先用它）；
3. 包装 `Menu.layout`，把关卡节点摆到旗标位置，`Scene.drawWorldPath` 改成一条很淡的虚线。

### 9.2 战斗底图

```bash
python tools/build_maps.py --force      # → assets/map/m*.png + fields.js + tools/_preview/maps_field.png
```

画面源是 `gameUI/dynamic/m<N>.swf`（注意：这些文件当年是被当成 `getMonsterURL` 抓下来的，
其实是**地图地块**）。直接光栅化会踩两个坑：

1. **舞台底色**：每个地块符号外面衬着一圈统一色的「舞台底」（m1 是淡灰绿、m15 是灰…），
   在棋盘外会露成一条难看的长条 → 从画面四边泛洪把这块同色的底设成透明。
   泛洪要设上限（吃掉 >33% 就认为边缘色其实就是画面本身，比如沙滩、雪原，放弃抠图）。
2. **场地在画里不是居中的**：本作的可建区域是个方正棋盘，原画里是一片形状不规则的沙地/雪原，
   所以要从中央区域取众数色，找它最大的连通域，取外接矩形当「场地」。
   运行时按这个矩形缩放，原画自带的树石环就会正好落在棋盘外面。
   自动标定不准的可以在 `build_maps.py` 的 `FIELD_FIX` 里手改，然后看
   `tools/_preview/maps_field.png`（红线＝场地框）核对。

场地矩形与场地代表色写进 `assets/map/fields.js`，`js/art_map_original.js` 读取：
场地等比缩放到棋盘（最多放大 1.25 倍，免得长宽比差太多时装饰环被整个挤出画布），
`js/art_terrain.js` 则用场地代表色给棋盘瓦片上色，并把格子深浅差压到几乎没有
（原作地面是均匀的，只有很淡的格线）。

另外：**用了原画之后，棋盘外不再叠程序化装饰**（原画自带的树石就是外圈），
否则会出现两套比例不同的树。

### 9.3 障碍物 / 建筑 / 机关

`js/art_units_original.js` 用「包装而非改写」接进游戏：

| 游戏里的东西 | 换成的原作矢量 |
|---|---|
| 墙 | `building.qiang` |
| 盘龙柱 / 牛郎雕像 / 织女雕像 / 元宵灯楼 | `building.panlong / niulang / zhinv / denglou` |
| 主题装饰树、石头、地图里的「障碍」格 | `obstacle.zhangai_shu1..4` / `zhangai_shitou1..4` |
| 火山 / 反应炉 / 核电厂 | `obstacle.zhangai_huoshan1` / `zhangai_fanyinglu` / `zhangai_hedianchang1` |
| 爆炸箱 / 弹簧 | `landform.WoodenBox` / `landform.SpringOutT` |

`js/art_terrain.js` 里留了两个钩子：`Art.drawObstacle()`（障碍格）与
`Art.drawHazardFacility()`（集群设施），没有原版矢量时会自动走程序化绘制。

### 9.4 战斗格子是 65×50 的长方形，底图要逐关标定（2026-09-30）

**这是之前一直没对上的根因。** 原作的格子**不是正方形**：从录像帧里量墙/塔的间距（`tools/_work/` 里的自相关脚本），
x 方向 ≈ 65、y 方向 ≈ 50 个「原作素材像素」，比例 1.3；和 `gameUI_landform.swf` 的 `FloorGridAllow`（69×53.6）同比例。
而且原作把**塔/墙/障碍的原点放在格子中心**，素材按 1:1（格宽 65 ↔ 素材 65 单位）缩放。
本作以前用正方形格子、把底图「按主题猜一张 + 场地矩形缩放」硬套上去，于是：

| 以前的症状 | 原因 |
|---|---|
| 塔/墙比例和原作不像 | 素材按 `cs/72`、底边对齐格子底，而原作是原点在格心、`cs/65` |
| 底图上烘好的羊村/出怪台和格子对不上，还被叠了一层程序化房子 | 没做逐关标定；程序化羊村无条件叠加 |
| 底图选错（安蒂亚村用了棕榈树沙滩图） | `THEME_BG` 是按主题猜的，不是原作的 |
| 格子里出现原作没有的树/石头/边框/棋盘格 | 原画里已经烘好了，又画一遍 |

现在的做法：

* `SV.CELL_W/CELL_H = 65/50`（`js/core.js`）。渲染器（`js/render.js`）里 `cs` 是格宽、`ch = cs×50/65` 是格高，
  逻辑坐标 (x,y) → 屏幕 `(ox + x·cs, oy + y·ch)`。为了不改上百处绘制代码，世界层（射程圈/特效/弹道/格线）
  在一个沿 y 压扁的坐标系里画，射程圈自然成了椭圆（与原作一致）；塔/狼/羊/飘字这些「站着的东西」用
  `R.upright()` 抵消压扁，按原比例画。地形层同理：`Art.squash()`。
* **`assets/map/register.js`**（由 `tools/map_register.py` 生成，勿手改）给每个标定过的关卡记：用哪张底图、
  **棋盘左上角在底图里的像素位置**。渲染时底图按 `cs/65` 缩放、把这个点对到棋盘左上角
  （`js/art_map_original.js`）。标定过的关卡不再画程序化的地面/边框/格线/树石/羊村/出怪洞——
  底图里都有；只保留原画里没有的东西（第 6 关的峡谷、桥、传送带、火山…）。
* 羊站在羊村格最靠下一排（1~3 只），不再叠在房顶上。

**怎么标定的（每一步都可复核）**

1. `tools/map_match_frames.py`：把每一帧录像和每张底图做 SIFT 匹配，得到「这一 P 用哪张图」以及 art→帧 的相似变换
   （`tools/_work/frame_art.json`）。**小心带「地图加载中」转圈的帧**：它可能显示的是下一关的底图
   （p15 的 t95 帧就是这样：SIFT 说是 m10，其实那帧是 p19 那关的图；西利村自己的图是雪松林+冰河+冰屋，
   镜像站上没有）。所以匹配结果必须再用第 3 步核实。
2. 用「地标」定位原点，比肉眼估准得多：
   * 第 12 关：3×3 的羊村格 ↔ 石屋；出怪格 ↔ 左侧岩台；
   * 第 31 关：6 个红 × 木箱 ↔ 数据里 6 个「爆炸箱」格（2/5/8 行 × 4/10 列）→ 原点 (110, 266)，**精确**；
   * 第 33 关：黑色钢网 ↔「有洞的钢网桥」格 → (109, 269)，**精确**；
   * 第 40 关：两座木桥 ↔ 数据里的「桥」格 → (181, 150)，**精确**；
   * 第 19 关：三个冰洞 ↔ 三个「特殊塔位」(type 6) 格 → (233, 199)；
   * 有围栏的羊村（1、2、5、6、8、9、43 关）用围栏包围盒中心 ↔ 羊村格中心，误差约半格；
   * 第 38 关：出口 ↔ 两座牛角门之间的缺口。
3. `tools/_work/reg_frame.py`：把格子通过 SIFT 变换画到录像帧上，看玩家放的墙/塔是不是落在格子里。
   ⚠️ **格子是周期的**：整整偏一格看上去也「塔都在格子里」，所以只靠这一步会漏掉整格偏差
   （第 19/31/33 关一开始就是这样错了一格），必须配合第 2 步的地标。

已标定 **13 关**（1、2、5、6、8、9、12、19、31、33、38、40、43），第 45 关只指定了底图（`{art:'m11'}`，图不完全对得上，没标定）。
新增一关：把 `(关卡, 底图, x, y)` 加进 `tools/map_register.py` 的 `REG`，`python tools/map_register.py`，
再用 `tools/shot.html?go=battle&map=<下标>&rich=1&towers=6&walls=10&sim=10` 看一眼。

**镜像站只有 12 张 m*.swf + 2 张防线图 mfx1/2**（`m1..m200` 全部探测过），
其余关卡的底图（呼噜噜村的瀑布、沃夫沼泽、雷尼尔村的熔岩心形、坦克尔村、西利村、各个工厂变体、两座岛、
缠怨谷、枫威瀑布……）**在镜像站上根本没有**，只在录像里能看到。这些关（约 32 张）现在仍用程序化地面 +
原作障碍矢量，只是也改成了 65×50 的格子。想补的话需要原客户端里那些 SWF（或原站别的镜像）。

## 10. 界面素材（资源 / 道具图标）

界面上那些「银币、积分、入梦棒棒糖、炸弹、捕兽夹」原来都是 `js/art_units.js` 里现画的，
和原作 HUD 对不上。原作把这一整套放在两个 SWF 里：

| 库 | 来源 | 里面有什么 |
|---|---|---|
| `material` | `gameUI_material.swf` | `UI_icon_coin / UI_icon_integral / UI_icon_exp / UI_icon_gold`（货币图标）、`UI_btn_*`（圆形按钮）、`UI_panel_*`（各种面板底板）、`UI_panel_tips_*`（气泡） |
| `item` | `gameUI_item.swf` | `rmbbt`（入梦棒棒糖）、`za_jinyaoshi/za_yinyaoshi/za_tongyaoshi`（钥匙）、`baoxiang*`（宝箱）、`baozhatong*`（爆炸筒）、`bushoujia*`（捕兽夹）、`dicicao*`（地刺）、`tiegao`（铁镐）、`sl1..4`（沙漏）、`hong1..5`（红宝石五档）… |

### 10.1 导出：按名字挑，不要全量

`gameUI_material.swf` 有 211 个符号、`gameUI_item.swf` 有 200 个，全量导出（`mode='all'`）
分别是 **858 KB / 3.0 MB** 的 JS —— 直接塞进 `index.html` 太重。
所以 `tools/export_assets.py` 里给这两个库写了显式的名字清单
（`UI_MATERIAL` / `UI_ITEM`），只导出**真的会用到**的符号，现在合计约 **640 KB**：

```bash
python tools/export_assets.py item material   # → assets/art/{item,material}.js + assets/svg/<lib>/*.svg
```

两个库都只要静态第一帧（`frames='0'`）：这些是图标，不需要时间线。
想找新符号的名字，可以直接翻 `tdsheep_swf/resource_symbols.tsv`（`file<TAB>id<TAB>name`），
或者把某个库临时改成 `mode='all'` 导出一次，再用 `python tools/svg_sheet.py <lib>` 把
`assets/svg/<lib>/*.svg` 拼成一张网页图册挑符号。

### 10.2 接入：符号 → data URL → `<img>`

`js/art_ui_original.js` 把原作符号画进一张 2× 背衬的小画布，再 `toDataURL()` 成 `<img src>`，
和原来 `Art.iconURL()` 的路子一样（矢量数据放大不发虚）：

```js
SV.Art.uiURL('UI_icon_coin', 26);           // material 先找，再找 item；找不到返回 null
UI.resIcon('rmbbt', 26, fallbackFn);        // 拿到原版就返回 <img>，没有就退回程序化那个
```

换掉的：`UI.coinImg / UI.ptImg / UI.candyImg`（顶栏 + 战利品条 + 商店 + 战场顶栏共用这些）、
`UI.bombImg()`、`UI.trapImg(tid)`、矿山面板的铁镐。
关掉：`window.SVA_ORIGINAL_ART = {ui: false}`。

### 10.3 截图核对

`tools/shot.html` 支持直接进战斗并摆几座塔，方便看界面：

```
tools/shot.html?go=battle&map=3&towers=8&pick=1     # 直接进第 4 张图的战斗，摆 8 座塔，选中第一座
tools/shot.html?go=hub&click=shop                   # 进大厅并点开商店（click 用 HUB_SPOTS 的 id）
```

⚠️ 无头 Chrome 的两个坑（都已在 `shot.html` 里处理）：
* `--virtual-time-budget` 会把战斗**快进到打完**（rAF 循环跑得比真实时间快得多），
  所以不 `start=1` 时会 `B.paused = true`，并且要用**小预算**截动态画面；
* 虚拟时间会让 CSS 动画停在半路，弹窗看起来是**半透明**的（像贴纸一样透出底图）。
  `shot.html` 默认往页面注入 `*{animation:none;transition:none}` 关掉动画；真机没这个问题。

## 11. 狼身上的道具（gameUI_wolf.swf）

客户端里还有一支 `gameUI_wolf.swf`，装的是**挂在狼身上**的东西，以前一直没接入：

| 符号 | 是什么 | 现在用在哪 |
|---|---|---|
| `balloon` | 红蓝两色气球 | **飞行狼**吊着它飘在半空（`js/art_original_pack.js`），地面留一个淡影子 |
| `spyWolf` | 161 帧：0~59 是**木桶**（伪装），60~117 是狼钻出来，118+ 是死亡 | 好友小屋「敲间谍狼」的小游戏 |
| `torch` / `hammer` / `aiming` / `BloodSlot` | 火把 / 锤子 / 瞄准线 / 血条 | 备用（原作里挂在这些狼身上） |
| `cannon` | 狼背着的小炮 | 暂未导出（单帧就 130×118、路径很多，先用不上） |

导出配置里 `spyWolf` 只挑了 4 个代表帧（`frames='0,60,100,140'`），全量导出会让
`assets/art/wolfui.js` 从 160 KB 涨到 6 MB。**所以 `wolfui.spyWolf` 的 frames 下标是
`0=木桶、1=钻出、2=钻出后期、3=倒地`**，不是 SWF 的原帧号，改的时候注意。

## 12. 狼的朝向 / 帧数（两个真实踩过的坑）

实机里狼看起来「朝向不对、一会儿一个样」，根因是这两条：

1. **每只狼的行走帧数都不一样**（实测 10~34 帧），而渲染器把列数写死成 `WALK_COLS = 24`。
   帧数 < 24 的狼（97 只里有 58 只）走到后半段时 `img.naturalWidth < (n+1)*CELL`，
   `SVAWolfOrigin.draw()` 返回 false，于是那一帧**掉回手搓狼**——同一只狼在两套画风之间闪，
   看起来就是「朝向/造型乱跳」。现在列数从图片宽度量出来（`naturalWidth / CELL`），
   帧号也不再在接入层取模。检查脚本：`tools/wolf_seq_check.html`（按帧整条铺开，空一格都看得见）。
2. **`js/data.js` 的键不一定等于原站文件名**（见 §1 那段），对不上就整只退回程序化绘制。
   现在 `js/art_wolf_origin.js` 的 `aliasOf()` 按「去 `D_/H_` 前缀 + 去 `_A/_B/_Z/B2/X` 后缀」
   找基础模型，另外给原站确实缺图的少数几只写了显式的 `EXTRA_ALIAS`
   （`bylX → byl2`，两只都叫「愤怒的搬运狼」；`liyuqil / lyql → xiaoliyuqil`，鲤鱼旗狼同族）。
   改这些规则时记得同步 `tools/wolf_coverage.py`（两边实现要一致）。
3. **往右走的狼脸朝左（2026-09-30）**。每只狼的 SWF 里有个 4 帧的朝向选择器（标签 d/l/u/r），
   原作省事，很多狼只画了一个侧面，另一侧是**同一份动画 `scaleX = -1` 镜像**出来的：
   62 只是 r 镜像 l，13 只是 l 镜像 r，只有 38 只两侧是各自画的。
   `tools/export_wolves.py` 烘图时只取了图元 id、丢掉了选择器上的矩阵，图集里这些狼的 l / r 两行就是同一个方向，
   于是「往右走脸朝左」（或反过来）。现在 `tools/wolf_flips.py` 扫出「哪只狼的哪一行要镜像」写成
   `assets/wolf/flips.js`，`js/art_wolf_origin.js` 画的时候按表水平翻转——不用重烘 18 MB 图集，
   因为烘图时每帧都按自己的包围盒居中进单元格，翻转后位置大小不变。
   另外地面狼以前只有左右两个朝向（`w.dir`），现在 `combat.js` 的 `moveWolf` 也像飞行狼一样记 `w.wdir`（d/l/u/r），
   往下走露正脸、往上走露背影（只影响画面，不进判定）。
   对照页：`tools/_work/wolf_face_lab.html`（`?noflip=1` 看修之前的样子）。

## 13. 还没对上的地方（2026-09-30 复盘）

图例：✅ 已对上　🟡 部分　❌ 没做　🔒 缺素材

| 项 | 状态 | 说明 |
|---|---|---|
| 大厅 / 世界地图整张插画 | ✅ | 原作 SWF 直接光栅化；世界地图旗标坐标自动标定 |
| 世界地图上关卡节点的样子 | ✅ | 原画上的交叉剑旗标本来就画在羊皮纸里；节点现在缩成编号牌 + 名字 + 状态，落在旗标中心，旗标露出来（`compactNodes`，`SVA_ORIGINAL_ART.worldNodes=false` 恢复大圆缩略图）。缩略图仍在右侧信息面板里 |
| 塔 × 5 档、墙、辅助建筑、障碍物 | ✅ | 矢量原样；现在原点在格心、比例 cs/65（§9.4） |
| 格子几何（65×50） | ✅ | §9.4。以前一直是正方形 |
| 战斗底图：有图的关卡（13 关） | ✅ | 逐关标定，羊村/出怪台落在正确的格子上 |
| 战斗底图：没图的关卡（约 32 关） | 🔒 | 镜像站没有这些 SWF；程序化替代，风格不同 |
| 第 6 关的峡谷、桥 | 🟡 | 原作是关卡专属底图，这里用 m5 + 程序化峡谷（cols 6–7）代替 |
| 狼：外观 | ✅ | 126/128 有原作模型（见 WOLF_VIDEO_CHECK.md） |
| 狼：玩具小丑 / 吸血鬼狼 | 🔒 | 原站没有模型；程序化 |
| 狼：血条 / 状态特效 / BOSS 名牌 | ✅ | 2026-09-30 修：`Art.drawWolfOverlay`（之前用了原作模型的狼没有血条） |
| 狼：受击闪白 / 隐身半透明 | ✅ | 同上 |
| 狼：相对大小、行走帧率/速度 | ❌ | 还没拿实拍逐只量 |
| 子弹（哨塔/散弹塔/炮塔/波动塔/镶嵌塔）与命中特效 | ✅ | §14。塔↔子弹的对应有一部分是**推断**的（原作配置在服务端），已在表里标明 |
| 狼身上的状态（烧/毒/减速/眩晕/诅咒/护盾/惊吓/沉默）、焦点箭头 | ✅ | §14，叠在原作狼模型上 |
| 狼的技能特效（召唤/瞬移/分身/治疗/复活/自爆/传送/乌云）、陷阱、炸弹、火山/核电厂爆发、Boss 出场圈 | ✅ | §14 |
| 技能图标（`gameUI_skill.swf`，狼的技能/抗性图标） | ✅ | `UI.skillTag` 在狼信息面板、图鉴、BOSS 介绍卡里显示原作图标 + 中文，缺符号退回文字 |
| 狼的死亡动画（倒地帧） | ✅ | §16.1：图集 `_dead` 行，随前后排序，飞行狼从空中落下，最后淡出 |
| `effect300` 死亡火花、`invasion` 出怪尘土 | ❌ | 没接（没找到确切的触发场合），死亡只有倒地动画 |
| 战斗 HUD（顶栏、左上头像+宝石格、右上罗盘小地图、底部功能栏、右下 BOSS 预览） | ❌ | 本作用自己的 DOM 面板；原作 HUD 是另一套布局（`gameUI_material.swf` 里有底板/按钮素材，没接） |
| 塔的攻击动作 / 炮口转向 | ❌ | 原作塔是静态图，本作也不转，但原作发射时有后坐/闪光帧没做 |
| 音效 / 战斗音乐 | ✅（对应表推断） | 35 个 mp3 已接入，见 `docs/ASSET_COLLECTION.md` §9.1；大厅 / 世界地图的音乐客户端里没有，仍是程序合成 |
| 标题画面 | ✅ | `first_install.jpg` 当底图（§9.2） |
| 狼图鉴描述 / 台词、塔介绍、宝石名 | ✅ | `assets/data/lore.js`（§9.3） |
| 战斗里狼头顶的台词气泡、BOSS 出场介绍卡 | ✅（触发场合推断） | §16.2 / §16.3。录像里能看到这两样；哪句台词在哪个场合说，原作没留说明 |
| 单文件版 `dist/` | ❌ | 只内联 JS/CSS（含音频、标题图这些 data URI），不含 `assets/wolf`、`assets/map` 的 PNG，所以单文件版里狼和底图会退回程序化 |

## 14. 子弹与战斗特效（2026-09-30）

素材：`assets/art/bullet.js`（25 个符号，全量）、`assets/art/effect.js`（**只导出 42 个用到的符号**，
整包 2.5 MB，单文件版会膨胀；清单在 `tools/export_assets.py` 的 `EFFECTS`，想多接一个把名字加进去再导出）。
代码：`js/art_fx_original.js`（映射表 + 画法）。引擎（`combat.js`）只发**语义事件**，不知道用哪个符号；
渲染器（`render.js` 的 `drawProjs` / `drawFx`、`art_chars.js` 的 `drawWolfOverlay`、`art_terrain.js` 的危险设施）
先问 `Art.origFx`，它返回 `true` 就是画好了，否则退回程序化画法。关掉：`window.SVA_ORIGINAL_ART.fx = false`。

### 14.1 一个真 bug：`swflib.py` 的 LineStyle2

带「填充线条」的 `LineStyle2` 被当成「有个数前缀的填充样式数组」来解析，字节全读错，
整个符号导出成空的。受害者：`bullet130`（镶嵌塔蓝色弹）和 `effect` 里约 65 KB 图元。修在 `parse_fill_style`。
影响面：旧解析器只让 4 个 SWF 报错（`gameUI_bullet` 1 处、`gameUI_effect` 2 处、`gameUI_material` 2 处、`gameUI_qqvip` 1 处；
`material` 出错的符号不在导出清单里，导出结果没变），**狼（`monster/`）和地图（`dynamic/`）不受影响**，不用重烘。
现在 149 个 SWF 的 `Doc.bad` 全是空的。

### 14.2 塔 × 宝石 → 子弹符号

| 塔 | 无宝石 | 红 | 蓝 | 绿 | 黄 | 紫 | 黑 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 哨塔、散弹塔 | 010 | 011 | 012 | 013 | 015 | 瞬发闪电（无弹） | 010 | 颜色一眼可见；**塔归属是推断** |
| 炮塔 | 020 | 021 | 022 | 023 | 025 | 024 | 026 | 火箭弹头颜色；炮塔速度慢、抛物线，火箭合理；**推断** |
| 波动塔 | 210 | 210+211 | 210+212 | 213 | 215 | 214 | 210 | **确定**：社区模拟器写明「波动塔（bullet210）」；宝石对应按颜色 |
| 镶嵌塔 | 不开火 | **宝石色大光点** | 大光点 | 大光点 | 全屏闪光 | 连锁闪电 | 紫色大光点 | 实机反馈：镶嵌塔打的是「宝石色的大光点」，不是炮弹。程序化发光球（`Art.orb`：宝石色光晕 + 近白核心 + 3 个拖尾残影，红/绿/蓝/黑四色）。原先用的 bullet110/120/130/140（带尾翼的小胶囊 + 乌鸦）像炮弹，不再用，符号仍留在 `bullet.js` 里 |

- 040/050/060 与 011/012/013 是**同一张图的副本**（尺寸、帧数都一样），没有单独使用。
- 数字规律：`bullet0T0` 与 `effect0T0` 成对（010 星火、020 炸开、030 火团、040 冲击环）；`bullet140`↔`effect140`（乌鸦羽毛）；
  `bullet21x` 是波动塔；`effect2xx` 是狼/机关一侧的爆炸和捕兽夹。`bullet100` 是**空符号**（没有画面，镶嵌塔无宝石时不开火）。
- 画法：素材原点在弹头中心；小球不转向，有方向的（火箭、胶囊、乌鸦、波）按飞行方向摆，往左飞就水平翻面而不是倒过来；
  炮弹沿抛物线切线转向；波动塔的 210/213 的 8 帧是「拖尾越拉越长」，按飞行进度播，其余按时间循环。
- 原作真实的弹速/命中半径/抛物线参数（社区模拟器里的 `BULLET_FLY`：哨塔 250、散弹 150、炮塔 100 且 fall=-10、镶嵌 180，波动塔 210 水平直线）
  **没有**接进引擎，引擎的弹速仍是本作自己的。

### 14.3 命中 / 技能 / 状态 → 特效符号

| 事件 | 符号 | 备注 |
|---|---|---|
| 哨塔/散弹塔命中 | effect010 | 暴击换 effectCrit |
| 炮弹落地 | effect030（垫底）+ effect020 | 按 `st.splash / 0.9` 放缩 |
| 波动塔穿透每只狼 | effect040 | 冲击环；子弹是水平飞出去的一道波（头 + 两个残影） |
| 镶嵌塔 红 / 黑 / 黄 命中 | effect030 / effect040 / allAttack | 黄宝石另有全屏 `allAttackAOE`（按射程放大） |
| 紫宝石闪电 / 连锁 | 程序化电弧线 + 每个落点 effectLinks | 没有闪电条素材 |
| 诅咒挂上 / 引爆 | effectCuss / effectCussBreak | |
| 狼：烧 / 毒 / 减速 / 眩晕 / 诅咒 / 护盾 / 惊吓 / 沉默 | statusBurn / Poison / Cold+MCold_SLOWF / Vertigo / Cuss / Shield / Intimidate / Silence | 比例跟狼的绘制宽度走（`u / 52.8`，原作狼格 96 px） |
| 焦点狼 | arrowhead | 头顶上下晃的橙色箭头，取代黄色圈 |
| 技能：护盾 / 召唤 / 治疗 / 复活 | signShield / signSummon+effectSummon / signCure+effectCure / effectRelive | `sign*` 是头顶的小图标 |
| 技能：瞬移 / 分身 / 传送 / 冲刺 / 乌云 / 自爆 | effectBlinkOut→In / effectMirror / teleport / effectRun / effectCloud+signCloud / effectSuicide | |
| 陷阱与炸弹 | 捕兽夹 effect220、地雷 effect310、炸弹墙 effect204 | effect201~204 是同一个爆炸的四档大小，只取最大的 |
| 火山喷发 / 核电厂脉冲 | pathBurn / effectHedian | 在压扁世界里画，要 `ay` 站直；反应炉没有对应素材 |
| Boss 出场 | effectBoss | |

### 14.4 引擎侧的改动（只改画面，不碰数值和随机数）

`combat.js`：新增 `P.fxHit`（`{type:'hit', tower, cname, crit, curse}`，场上特效超过 180 个就不再追加）；
`beam` 带上 `cname`；已有的 `ring` / `boom` / `blink` 打上 `kind`（`shield summon heal revive clamp bomb` /
`shell bomb mine burst cloud` / `out in mirror`）；Boss 生成时发 `{type:'boss'}`。
没有素材时，`render.js` 里 `hit` 退回一个小火花圈，其余沿用原来的程序化画法。

### 14.5 怎么核对

- `tools/fx_check.html?mode=fxgrid` 全部事件特效（15%/45%/75% 三个进度）；`mode=status` 一排狼各带一种状态；
  `mode=towers&type=sentry|scatter|cannon|pulse|inlay` 六色宝石各一座塔开火，截「弹道最多」的 4 帧。
  参数 `orig=0` 看程序化版本；无头 Chrome 里要用 `wait=`（默认 2.5 s）等狼的图集加载完，
  否则狼走的是手搓骨架兜底分支。
- `tools/_work/fx_sheet.html?lib=bullet|effect&filter=正则` 把符号所有帧按名字铺开（洋红十字 = 素材原点）。
- 46 关回归：每关摆 14 座带宝石的塔推演 14 秒并逐帧绘制——0 报错，同屏特效最多 17 个、弹丸 9 颗。

### 14.6 顺手补的一个洞

图集还没加载完时，狼走「手搓骨架」兜底分支，这条分支以前**没有血条也没有状态特效**。
现在 `art_original_pack.js` 的兜底分支也调 `Art.drawWolfOverlay`。

## 16. 死亡动画 / 台词气泡 / BOSS 介绍卡（2026-09-30）

对着本地的录像参考帧（`tools/_video/ref_open/`）看原作战斗界面，发现三样东西这边一直缺：
狼死后会倒地、狼头顶会冒台词气泡（录像里大灰狼的「这天气，适合吃羊」）、BOSS 波前会弹出「BOSS」介绍卡。
素材都在手头，接上：

### 16.1 狼的死亡动画

烘图时早就把每只狼的倒地帧烘进了 `assets/wolf/<id>_dead.png`（113 张，12~15 列，每 3 帧取 1），一直没人用。

* `combat.js` 的 `killWolf` 给 `die` 特效带上狼的外观快照（`def / dir / wdir / boss / elite / invis / lane`），ttl 0.95 s（BOSS 1.3 s）。只影响画面。
* `render.js` 把 `die` 特效放进「按 y 排序的可绘制对象」里（种类 `d`），跟活着的狼一起前后遮挡；画不出来（图集没加载完）时退回原来的小星星（`f.drawn` 标记）。
* `art_original_pack.js` 的 `Art.drawWolfDeath`：按 `f.t / f.ttl` 取 `_dead` 行的帧（`hold` 不循环），飞行狼从空中落到地上（前 45% 时间），最后 25% 淡出；朝向、镜像沿用 `flips.js`。
* `art_wolf_origin.js`：`deadColsOf(id)`、`draw` 的 `hold` 选项。

### 16.2 台词气泡（`js/wolf_talk.js`）

台词来自 `SVA_LORE.wolves[名字].q`。**哪一句在什么场合说，原作没留说明**，这里按几只狼的排列规律推断：

| 场合 | 取第几条 | 依据 |
|---|---|---|
| 出场 / 闲聊 | 前半段 | 小灰狼「我跑的很快哦」「我也有牙哦」，大灰狼「这天气，适合吃羊」（录像里就是走路时说的） |
| 挨打（血量跌破 70% / 30% 各一次） | 中段 | 小灰狼「哎呦疼啦」，大灰狼「好痛，别打啦~」 |
| 死亡 | 倒数第二条 | 小灰狼「呜555...」，大灰狼「不甘心呐」 |
| 偷到羊 | 最后一条 | 小灰狼「我先开动啦」，大灰狼「渍渍~小羊我来啦」 |

对得上的居多，不保证每只都对（比如法师狼的最后一条其实是召唤台词）。同屏最多 4 个（BOSS 5 个），每只狼同时只说一句，概率都不高，4× 速时不冒。
设置里「显示狼的台词气泡」可关（`G.save.settings.talk`），也可以 `SVA_ORIGINAL_ART.talk=false`。

### 16.3 BOSS 出场介绍卡

`bossWarning` 事件时（`BU.bossCard`）：「BOSS」缎带 + 大头像 + 名字 + 原作描述 + 抗性 / 技能图标 + 一句台词，最多并排 3 张。
原作会暂停战斗，这里不暂停，8 秒后自己收起，点 ✕ 也能关。

### 16.4 顺手修的两个 bug

* 上一轮接技能图标时 `js/ui_panels.js` 的狼图鉴详情里把 `const tags = []` 弄丢了，点开任何一只已发现的狼都会抛 `tags is not defined`，详情空白。补回。
* 大厅原画异步加载完会重画一次大厅，`每日签到` 被重复创建（叠了两层）；入口加了幂等保护。

### 16.5 狼头像（波次提示框 / 图鉴 / BOSS 卡…）改用原作模型

所有狼头像都走 `UI.wolfImg → Art.wolfIconURL`，以前用程序化狼画一次就缓存，而第一次画时原作图集多半还没加载完，
缓存下来的就永远是旧模型（表现为「下一波」提示框里全是旧狼）。现在（`js/art_ui_original.js`）：图集能画时用原作图集出图标
（取正面 `d` 行的行走帧）；还没加载好先用旧模型顶着，图集一到位 `<img>` 自动换成原作的（`SVAWolfOrigin.whenReady`）。
没有原作模型的玩具小丑、吸血鬼狼仍是旧模型。关掉：`SVA_ORIGINAL_ART = {wolf:false}`。
