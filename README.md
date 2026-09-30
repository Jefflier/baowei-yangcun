# 保卫羊村 · 怀旧服（单机复刻）

一款纯前端、无需安装、**双击 `index.html` 即可游玩**的迷宫式塔防游戏，复刻自《保卫羊村》怀旧服的核心玩法。
音效与战斗音乐用的是**原作的 35 个 mp3**（内联进 JS，缺了自动退回 Web Audio 程序化音效）；美术可以在**程序化绘制**与**原作矢量原画**之间切换（见下节「原版矢量美术」）。

> 推荐 Chrome / Edge。若双击后存档存不上（少数浏览器限制 file:// 存储），在本目录运行
> `python tools/devserver.py` 再访问 <http://localhost:8123/> 即可。
>
> 想发给朋友？`dist/保卫羊村怀旧服.html` 是打包好的**单文件版**（约 6.7 MB，无任何外部依赖，双击即玩；
> 里面内联了全部原版矢量资产、原作音效音乐和标题底图，所以比早期版本大）。
> 修改源码后可用 `python tools/build_single.py` 重新生成。
> 注意：单文件版只内联 JS/CSS，不含 `assets/wolf/*.png`（18.5 MB），所以单文件版里狼会用程序化美术；
> 想要原作狼，用源码目录运行 `index.html` 即可。

## 🐂 番外篇：牛来攻城

用同一套底子手搓的新塔防：**牛群攻打羊城**。路可以堵死，但牛会**撞墙破城**——寻路是羊村 Dijkstra 流场的加权版，
墙的剩余耐久就是通行代价，牛会自己权衡「绕远路」还是「撞开一堵墙」；撞城牛专挑最薄的墙撞。
12 种牛，建模致敬动画电影《牛来》的 SketchUp 方块风（牛来会被石头绊倒、直立行走的牛妈妈背着忽大忽小的杯子、
牛爸爸冲锋、飞天牛挂着原作气球飞过城墙、田单火牛阵、青牛精的金刚琢、狂暴后 T-pose 的牛魔王……；设置里可换回 Q 版「海报」牛）、
8 种塔（原作矢量五档外观）、城墙三级、草垛、盘龙柱 / 织女 / 牛郎像、三个城主技能、10 关 + 无尽模式。

- 双击 `niulai/index.html`，或者在本作标题页点「🐂 番外 · 牛来攻城」；单文件版 `dist/牛来攻城.html`（`python tools/build_niu.py` 生成）
- 详细说明见 [`niulai/README.md`](niulai/README.md)；无头平衡模拟 `node tools/niu_sim.js`

## 玩法概览

- 狼群从**出怪口（洞穴）**出发，沿**最短路线**冲向**羊村**。你要用**墙**把路线拉长，用**塔**消灭它们。
- 每清掉一波，**进度**上涨；进度满后击败**最终 BOSS** 通关。漏一只狼会扣「羊村生命」并**倒扣进度**，生命归零则失败。
- **不能把路完全堵死**；阶梯形、蛇形的绕路比直路更能利用塔的圆形射程。
- 每张图的狼等级 = `√(A + B × 进度)`，血量 = `(a + L(b + L·c)) × 波难度`（0.8~1.3，「小菜一碟」到「困难重重」），
  这些公式与 136 种狼的参数取自玩家整理的《羊村百科全书 V1.82》。

### 五种塔（造价/攻击曲线与原版数据一致）
| 塔 | 特点 |
|---|---|
| 哨塔 | 最便宜、单体、性价比之王，上限 100 级 |
| 散弹塔 | 同时打 3 个目标，**对空双倍**，追踪不 miss，上限 130 级 |
| 炮塔 | 仅对地，射程极大，范围溅射，上限 110 级 |
| 波动塔 | 贯穿一条直线最多 10 个目标，可打隐身，很贵 |
| 镶嵌塔 | 本身不攻击，镶嵌宝石后发挥威力，上限 60 级 |

塔可以**直接建成任意等级**（造价随等级增长）；到达等级上限 80% 时等级牌变金色。可升级、出售（退 80%）、搬迁（2% 手续费）、切换目标优先级、**点击狼集火（手操）**。

### 六色宝石 × 五种品质（碎片→晶体→宝石→精华→强化，3 合 1 合成）
红（燃烧/胆怯/高伤镶嵌）· 绿（中毒，不叠加取最高）· 黄（暴击/眩晕/光塔）· 紫（闪电、射程+、连锁闪电）· 蓝（减速，冰镶嵌最高 79%）· 黑（连击/诅咒沉默/超远炮/对空齐射）。
各塔 × 各宝石的具体效果与数值按论坛《塔与宝石详细介绍》实现。

### 其它建筑
墙 · 盘龙柱（+15% 攻速）· 牛郎雕像（+20% 攻击）· 织女雕像（+20% 射程）· 元宵灯楼 · 捕兽夹 · 地雷。辅助建筑**不计入面板造价**。

### 炸弹墙
炸弹是消耗品（商店、兑换码、任务可得，新存档送 3 枚）。战斗中按 `B` 或在建造栏选「炸弹」，再点一堵**墙**装上；也可以点墙后在右侧面板安装 / 手动引爆 / 拆除。
地面狼靠近（1.5 格内）会**自动引爆**：1.7 格范围伤害（普通狼 16% 最大生命，精英 9%，BOSS 5%，外加随波次增长的固定伤害）+ 1 秒眩晕，无视抗性；飞行狼不会触发。
每局最多同时装 6 枚；**没引爆的炸弹会返还**，出售墙也会返还，只有引爆的才消耗。竞技场里不可用。

### 兑换码
大厅右上角 🎁（或设置里）输入。支持两类：
- **内置口令**（不区分大小写）：`HUAIJIU`、`YANGCUN666`、`BAOZHA`、`XINSHOU`、`BAOSHI`；
- **礼包码**（`SV-` 开头，带校验，可设有效期）：用 `tools/codegen.html` 自己生成，发给朋友即可。
同一个码在同一个存档里只能兑换一次。这是单机游戏，校验盐写在源码里，只防输错，不防伪造。

### 地图与地形（46 张，来自原作 47 张图的布局与狼种配置）
四大陆：巴罗村 → … → 生命森林 →（防线/香树镇/远古冰川/缠怨谷/…）。
支持出怪口/羊村口多个、**传送门**、**传送带**（顺速逆缓）、**弹簧**、**火山**（燃烧狼、封塔）、**反应炉**（减速）、**核电厂**（电伤害 + 塔加速）、桥/河岸/沼地/铁路等可走不可建地形、特殊塔位。
苏兰德城为**无限进度**地图。

### 狼（132 种，含空军与 BOSS）
抗性（怕火/冰/毒、免疫电…）、技能：飞行、狂奔、闪烁、隐身、护盾、召唤、重生/转生、分身、群疗、自爆等。
随机 BOSS 每 15~40 波出现，掉落积分/宝石/大宝袋。

### 模式与养成
- **战役**：46 张图，等级/前置通关解锁，难度可选（休闲/普通/硬核）。
- **噩梦模式**：已通关的图可挑战，最多 110 波，狼种随机，每 10 波 BOSS，噩梦宝箱结算（消耗棒棒糖）。
- **引狼**：额外引一批狼刷银币与经验。**智能绕路**：一键自动放墙拉长路线；**挂机助手**：自动造塔升级。
- 战斗里狼会**冒台词气泡**、死亡时播**原作倒地动画**，BOSS 波前弹出**介绍卡**；世界地图上关卡是原画里的**旗标**（编号牌 + 名字叠在上面）。
- **宝石工坊**（合成）、**矿山**（离线挖矿，力量影响品质）、**好友小屋**（雇苦工、敲间谍狼小游戏）、
  **商店**、**训练营**（狼卡养成 + 3 个技能槽）、**竞技场**（自动对战 + 翻牌奖励）、
  **每日签到 / 每日任务 / 50+ 成就**、**羊村百科**（塔、宝石、狼图鉴、攻略心得）。
- 布阵**自动保存**，可一键载入上次布阵；支持**布阵分享码**导入/导出、**存档导入/导出**。

## 操作

| 操作 | 说明 |
|---|---|
| `1`–`5` | 选择哨塔/散弹/炮/波动/镶嵌 |
| `Q` | 墙（在地图上按住鼠标拖动可连续造墙） |
| `B` | 炸弹（点一堵墙装上） |
| 鼠标左键 | 建造 / 选中建筑 / 选中狼集火 |
| 鼠标右键、`Esc` | 取消 |
| `空格` | 暂停 |　`F` 切换 1x/2x/4x |
| `U` | 升级选中塔 |　`S`/`Del` 出售 |　`M` 搬迁 |
| `Ctrl` + 点塔 | 快速升 1 级 |　`Shift` + 建造 连续建造 |
| `P` / `G` | 显示走狼路线 / 网格 |

## 与原版的差异（诚实说明）
- 原作是联网 Flash 游戏（好友、PvP 竞技场、公会等）；本作是**离线单机**，好友与对手为虚拟 NPC，竞技场为自动模拟对战。
- 数值大体沿用原版数据（造价、塔伤害、宝石系数、狼参数），但移速/射程/攻速采用换算（攻速 ×2 与论坛工具口径一致），
  并为前期地图提供血量缓坡与难度选项，避免新手挫败。
- 「爆炸箱」「金字塔行进方向」等极少数地形机制做了简化。炸弹墙的伤害与触发规则是按玩法描述自行设计的，并非原版数值。
- 兑换码在本地校验，没有服务器；礼包码不能防止重复领取到多个存档。
- 音效与战斗音乐是原作的 mp3，但「哪个事件放哪个声音」原作代码里没抠出来，对应表是按文件名和听感推的；大厅与世界地图的音乐原作客户端里没有，用程序合成的循环曲。

## 原版矢量美术（羊 / 塔 / 机关 · 以及手搓的狼）

从原作客户端的 SWF 里把矢量原画解出来了，和程序化美术可以一键切换：

| 模型 | 来源 | 说明 |
|---|---|---|
| **大厅（羊村）** | `gameUI_dynamic_TheStronghold.swf` | **原作整张插画**（雪季羊村：矿山洞、驯化营、竞技场、书形图鉴、华表广场、去前线牌），可点建筑按插画上的位置重排 |
| **世界地图** | `gameUI_dynamic_TheWorld.swf` | **原作四块大陆的羊皮纸地图**，关卡节点直接摆在原作旗标的位置（旗标坐标自动标定，每章旗标数＝该章关卡数 11/14/12/9） |
| 羊（7 种表情/状态） | `gameUI_sheep.swf` | **矢量原样**，含 36 帧动画 |
| 五种塔 × 五档外观（石/蓝/黄/红/金） | `gameUI_tower.swf` | **矢量原样**，25 帧；镶嵌塔的塔身是空的，宝石层是原画那颗红宝石按六色改的色（30 帧）；镶嵌的宝石画在塔身插槽里，塔顶挂原作气泡等级牌 |
| 盘龙柱/牛郎/织女/元宵灯楼/石墙/遗迹等建筑与机关 | `gameUI_tower.swf` | **矢量原样** |
| 障碍物（4 种树 / 4 种石头 / 火山 / 反应炉 / 核电厂）、爆炸箱、弹簧 | `gameUI_tower.swf`、`gameUI_landform.swf` | **矢量原样** |
| **战斗底图**（12 张地形原画 + 2 张防线图） | `gameUI/dynamic/m*.swf`、`mfx1/2.swf` | **原作整张原画**（羊村、出怪台、树石都烘在图里）。**格子是 65×50 的长方形**，`assets/map/register.js` 逐关记录「棋盘左上角在原画里的位置」，已标定 13 关；其余关卡的原画镜像站没有，仍用程序化地面（详见 `docs/ART_PIPELINE.md` §9.4） |
| 特效 / 技能图标 / 子弹 | `gameUI_effect/skill/bullet.swf` | **矢量原样**（effect 只导出用到的 42 个 / skill 42 / bullet 25）；子弹与战斗特效已接进战斗（`js/art_fx_original.js`），技能图标还没接 |
| 界面素材（银币/积分/棒棒糖等资源图标、道具图标、按钮底板） | `gameUI_material.swf`、`gameUI_item.swf` | **矢量原样**；顶栏资源、矿山/商店/工坊里的道具图标换成原版，缺符号时自动退回程序化绘制 |
| 狼（130 / 132 种） | 原站 `gameUI/dynamic/<id>.swf` | **原作矢量原样**：每只 4 个朝向（d/l/u/r）行走 + 死亡动画，已烘成 `assets/wolf/*.png`。服务端会用同一套模型跑多个变体（`sdys_A`→`sdys`、`yll_B`→`yll`、`D_glykl`→`glykl`…），接入层按名字自动回退；只有 `wjxcl_B`（玩具小丑）和 `xxgl_B`（吸血鬼狼）原站确实没有模型，退回程序化绘制 |
| 狼身上的道具 | `gameUI_wolf.swf` | **矢量原样**：气球（飞行狼吊着飘）、间谍狼（好友小屋敲间谍狼的木桶）、火把、锤子、瞄准线、血条 |

- 资产：`assets/svg/**`（SVG 原画）、`assets/art/*.js`（画布可直接回放的图元数据）、
  `assets/scene/*.png`（大厅与世界地图插画）、`assets/map/*.png`（战斗底图）
- 狼的精灵图：`assets/wolf/<id>.png`（4 向 × 24 帧行走）+ `<id>_dead.png`，由
  `powershell -ExecutionPolicy Bypass -File tools/build_wolves.ps1` 从原作 SWF 烘出来，
  再 `python tools/optimize_wolf_png.py 255` 量化
- 渲染器：`js/art_original.js`（`SVAArt`，Path2D + 渐变还原）
- 狼渲染器：`js/art_wolf_origin.js`（读精灵图）
- 接入层：
  * `js/art_original_pack.js` —— **塔、羊、狼**（狼优先用原作图集，缺图时退回手搓骨架、再退回程序化绘制）
  * `js/art_fx_original.js` —— **子弹、命中/技能特效、狼身状态**（映射表见 docs/ART_PIPELINE.md §14；`SVA_ORIGINAL_ART.fx=false` 退回程序化）
  * `js/art_units_original.js` —— **墙、盘龙柱/牛郎/织女/元宵灯楼、树木石头、火山/反应炉/核电厂、爆炸箱、弹簧**
  * `js/art_map_original.js` + `assets/map/register.js`（逐关标定，`tools/map_register.py` 生成）+ `assets/map/fields.js`（未标定关卡的旧式场地对齐）—— **战斗底图**
  * `js/art_scene_pack.js` + `assets/scene/` —— **大厅、世界地图**插画与关卡节点摆位
  * `js/art_ui_original.js` + `assets/art/{material,item}.js` —— **界面资源/道具图标**（`UI.resIcon(name, size, fallback)`）
  * `js/wolf_talk.js` —— **狼头顶的台词气泡**（台词来自原作配置；触发场合是推断的，设置里可关）；死亡动画用图集 `_dead` 行（`Art.drawWolfDeath`）；BOSS 波前的介绍卡见 `js/ui_battle.js` 的 `BU.bossCard`
  * 想整体关掉原版美术：`window.SVA_ORIGINAL_ART = {tower:false,sheep:false,wolf:false,units:false,scene:false,map:false,ui:false}`
- 狼的血条 / 状态特效 / BOSS 名牌：`Art.drawWolfOverlay`（`js/art_chars.js`），程序化狼与原作狼共用
- 手搓狼：`js/art_wolf.js`（8 向、行走/待机/攻击/死亡、按狼名猜配色的 `palFor()`；
  造型按 B 站实机视频抽帧 + `tools/silhouette.py` 量化的比例复原：头部占整体高度约 72%）
- 重新生成资产：`python tools/export_assets.py`（矢量）、`python tools/build_maps.py`（战斗底图）、
  `python tools/build_scene.py`（大厅与世界地图）
- 原站素材（`https://tdsheep.tdsheepvillage.com/static/images/swf/`）：
  `python tools/fetch_site_assets.py` 会按 `xmlFile/initXML.xml` + `js/data.js` 把所有 SWF 抓齐
  （`--probe` 只看不下载），`python tools/wolf_coverage.py` 报告还有哪些狼没有原图集

## 原作素材收集（SWF 之外：音频 / 背景图 / 设定 / 数值）

除了 SWF，这一轮把原站和社区里能找到的东西都收进来了，清单见
[`docs/ASSET_COLLECTION.md`](docs/ASSET_COLLECTION.md)，可视化收集台在 `tools/collect_check.html`（音频可直接试听）。

| 类别 | 内容 | 位置 |
|---|---|---|
| **原作音效 / 音乐（35 个 mp3）** | 音效 29 个 + 战斗音乐 6 首。名字是从客户端 `GlobalString` 的 `SOUND_*` / `MUSIC_*` 常量里挖出来的。**已接进游戏**（`js/audio.js`） | `tdsheep_swf/gameSound_*.mp3` → `assets/audio/sounds.js` |
| 原站静态图（34 张） | `first_install.jpg`（**入口宣传图，已用作标题底图**）、标题字 logo、首页按钮、导航条、分享弹窗素材 | `tdsheep_swf/extra/` |
| 游戏设定 | `xmlFile_*.xml` 解析成 JSON：狼图鉴 763 条（名字 + 描述 + 台词）、界面文案 961 条、引导 59 步（含坐标）、地图名、难度档、建筑/宝石说明。**狼的描述与台词、塔的原作介绍、宝石原作名已接进羊村百科**（`assets/data/lore.js`） | `tdsheep_swf/data/` |
| 社区数值 + 地图布局 | 《羊村百科全书 V1.82》整理出的 `data.js`（塔/狼/宝石系数）+ **47 张地图布局图** | `tdsheep_swf/community/` |

两点要说明：

- **镜像站上的 `config.xml` 是被裁过的**（文件头 `<!--xpath#//@s-->`，只剩 `s="文案"` 属性），
  所以它是名称字典而不是数值表；带数值的原文件只在服务端，原 Qzone CDN 已下线、Internet Archive 上也没存档。
  数值以社区整理的 `data.js` 为准。
- 音频的接法、事件对应表和标题画面 / 设定文案的接入见 `docs/ASSET_COLLECTION.md` §9。
  关掉原作音频：`window.SVA_SOUND_ORIGINAL = false`；关掉标题底图：`window.SVA_ORIGINAL_ART = {title:false}`。

- 校验台：`tools/original_lab.html`（全部原版矢量）、`tools/original_art_lab.html`（接入后的塔与羊）、
  `tools/wolf_lab.html`（狼，含与原作截图的并排对照）、`tools/scene_check.html`（同屏比例）
  以及 `tools/wolf_seq_check.html`（按帧铺开，查每只狼的行走帧数）、`tools/battle_check.html`（战斗画面，可直接指定第几张图）、
  `tools/wolf_all_check.html`（全部狼正面/侧面铺开）、`tools/wolf_video_check.html`（**跟 B 站实机录像逐只核对**）、
  `tools/collect_check.html`（**原作素材收集台**：音频试听 / 背景图 / 设定字典 / 地图布局）、
  `tools/shot.html`（大厅/世界地图/战斗界面截图，`?go=hub&click=shop` 可以直接打开某个面板，`&js=` 能在游戏窗口里跑脚本）

完整的方法、数据来源、格式说明与已知差距见 [`docs/ART_PIPELINE.md`](docs/ART_PIPELINE.md)。
想去掉原版资源、回到纯程序化美术：删掉 `index.html` 里 `assets/art/*.js` 那几行，
或设置 `window.SVA_ORIGINAL_ART = {tower:false, sheep:false, wolf:false}`。

## 目录
```
index.html          入口
css/style.css       样式
js/data.js          游戏数据（由调研资料生成：造价/攻击曲线、宝石系数、132 种狼、46 张图）
js/core.js          工具、地图模型、寻路（Dijkstra 流场）
js/battle.js        战斗引擎 A：建造/经济/波次/掉落
js/combat.js        战斗引擎 B：塔与宝石效果/弹道/伤害/狼的状态与技能
js/ai.js            自动布阵、智能绕路、平衡模拟
js/art_terrain.js   程序化美术：地形 / 装饰 / 羊村
js/art_units.js     程序化美术：宝石 / 墙 / 雕像 / 机关 / 炸弹 / 图标
js/art_chars.js     程序化美术：狼（Q 版双足，132 只各有造型）/ 羊（多种表情）/ 五种防御塔（随等级进阶外观）
js/render.js        战斗渲染
js/scene.js         标题/大厅/世界地图场景
js/audio.js         音效与音乐：原作 mp3（assets/audio/sounds.js）+ Web Audio 程序化兜底
js/game.js          存档、等级、解锁、战斗生命周期
js/codes.js         兑换码（内置口令 + 带校验的礼包码，无依赖）
js/features.js      签到/任务/成就/矿山/好友/商店/兑换
js/camp.js          训练营与竞技场逻辑
js/ui_*.js          界面
js/art_original.js      原版矢量渲染器（Path2D 回放 assets/art 的图元）
js/art_original_pack.js 把原版矢量接进 drawTower / drawSheep（可开关）
js/art_title_original.js 标题画面：原作入口宣传图当底图
js/wolf_talk.js     狼的台词气泡（原作配置里的台词）
assets/audio/       sounds.js：原作 35 个 mp3（base64 内联 + 响度归一化）
assets/ui/          images.js：标题底图（data URI）
assets/data/        lore.js：狼图鉴描述 / 台词、塔介绍、宝石原作名
js/art_wolf.js      手搓狼模型（8 向 / 走路 / 状态 / 配色）
assets/art/*.js     原作矢量图元数据（由 tools/export_assets.py 从原客户端 SWF 导出）
assets/svg/**       同上，SVG 原画
tdsheep_swf/        原作客户端静态资源（SWF/XML/音频）与解析笔记
  monster/          狼的模型 SWF（112 只）
  gameSound_*.mp3   原作音效与战斗音乐（35 个）
  extra/            原站静态图（背景/logo/按钮/弹窗素材）+ 探测清单
  community/        社区整理的数值 data.js 与 47 张地图布局图
  data/             xmlFile_*.xml 解析出的设定 JSON（狼图鉴/文案/引导/地图名）
docs/ART_PIPELINE.md     模型复原管线说明（来源、工具、格式、差距）
docs/ASSET_COLLECTION.md SWF 之外的素材收集（音频/背景图/设定/数值）
tools/              开发辅助：sim.html（无头平衡模拟）、gallery.html / art_lab.html（美术图库与放大预览）、
                    original_lab.html / original_art_lab.html / wolf_lab.html / scene_check.html（原版矢量校验台）、
                    export_assets.py / swflib.py / swf_svg.py（SWF 解包与导出）、
                    probe_*.py / fetch_refs.py / montage.py / crop_zoom.py（资源探测与参考图工具）、
                    probe_mirror.py（原站非 SWF 素材探测：静态图/音频/配置）、
                    fetch_community_data.py（社区数值与地图布局）、probe_web_archive.py（查 Internet Archive）、
                    forum_scan.py（扫怀旧论坛找资料帖）、
                    abc_dump_strings.py（SWF 字符串常量池转储）、export_config_data.py（xmlFile_*.xml → JSON）、
                    make_collect_page.py / extra_sheet.py（素材收集台与图册）、
                    export_sounds.py / export_ui_images.py / export_lore.py（音频 / 标题图 / 设定文案 → assets/ 内联资源）、
                    wolf_flips.py（扫出哪些狼的哪个朝向要水平镜像 → assets/wolf/flips.js）、
                    svg_sheet.py（把导出的 SVG 拼成图册，挑符号用）、
                    fetch_site_assets.py（一键抓齐原站 SWF）/ wolf_coverage.py（狼图集覆盖率）、
                    codegen.html（兑换码生成）、devserver.py（无缓存开发服务器）、build_single.py（打包单文件）
                    video_wolf_grab.py / wolf_video_match.py / wolf_video_cards.py / wolf_video_report.py /
                    wolf_video_make_page.py（B站录像抽帧 → 抠狼 → 跟模型逐个比对 → 出核对页）、
                    map_match_frames.py（录像帧 ↔ 战斗底图 SIFT 匹配）/ map_register.py（逐关标定 → assets/map/register.js）/
                    shot_levels.ps1（无头 Chrome 批量截战斗画面）、
                    fx_check.html（子弹/特效/狼身状态对照页）
dist/               打包产物（单文件版）：保卫羊村怀旧服.html、牛来攻城.html
niulai/             番外篇《牛来攻城》（见 niulai/README.md）；tools/niu_sim.js / niu_trace.js / build_niu.py 是它的工具
```

## 测试与质量
- 引擎规则单测（建造/出售/升级/宝石返还/雕像/搬迁/堵路拒绝…）、132 种狼逐个跑 60 秒无异常、UI 冒烟、全战役 46 图解锁链与结算流程自动化通关测试均已通过。
- 性能：84 只狼 + 26 座塔同屏约 7 ms/帧（狼使用精灵缓存）。
- 竞技场难度按玩家当前狼队自动标定：4 个对手强度分别为「狼队刚好能赢的最大防线」的 0.4 / 0.7 / 1.0 / 1.5 倍（前三个必赢，最后一个需要变强）。

## 资料来源与致谢
- [保卫羊村怀旧论坛](https://www.tdsheepvillage.com/forum.php?mod=forumdisplay&fid=2)：新手攻略、塔与宝石进阶帖、竞技场/噩梦/矿山机制。
- 羊村百科全书 V1.82 / 保卫羊村 Wiki（经社区工具 [tdsheepvillage-lineup](https://github.com/AC-ake/tdsheepvillage-lineup) 整理的公开数据）：造价与攻击表、狼参数、地图网格。
- 《保卫羊村》原作及其玩家社区。本项目为非商业粉丝作品，与原作运营方无关。
