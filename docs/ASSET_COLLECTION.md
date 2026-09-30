# 原作素材收集（SWF 之外）：音频 / 背景图 / 游戏设定 / 数值

> 前几轮把原作客户端的 **SWF**（羊、狼、塔、地形、界面、大厅、世界地图、战斗底图）挖得差不多了，
> 这份文档记的是「SWF 之外」那一批：**原作音效与音乐**、**官网静态图**、
> **客户端配置里的设定文案**、以及**社区整理的数值与地图布局**。
>
> 一目了然的可视化清单：`tools/collect_check.html`（音频可直接试听）。

## 1. 这轮新增了什么

| 类别 | 数量 | 体积 | 落在哪 |
|---|---:|---:|---|
| 原作音效 / 音乐 mp3 | 35 | 0.25 MB | `tdsheep_swf/gameSound_*.mp3` |
| 原站静态图（背景、logo、按钮、弹窗素材） | 34 | 0.33 MB | `tdsheep_swf/extra/` |
| 漏抓的界面 SWF | 1 | 51 KB | `tdsheep_swf/gameUI_loading.swf` |
| 社区整理的数值 + 47 张地图布局 | 53 | 19.1 MB | `tdsheep_swf/community/` |
| 客户端配置解析出的设定 JSON | 6 | 0.47 MB | `tdsheep_swf/data/` |

## 2. 原作音频（这部分最意外）

**怎么找到的**：客户端 AS3 里 `com.kingdowin.TDSheep.sound.SoundManager` 把音效地址拼成
`<base>/gameSound/<名字>.mp3`，而 `<名字>` 全部写在 `com.kingdowin.TDSheep.ado.GlobalString` 的
`SOUND_*` / `MUSIC_*` 常量里。把常量表挖出来（`tools/abc_dump_strings.py` 转储、
`tools/abc_strings.py` 单类查看），再按名字去镜像站探测，就全都命中了。

用到的工具链：

```bash
python tools/abc_dump_strings.py tdsheep_swf/MainClass.swf tools/_work/abc_strings.txt
python tools/abc_strings.py tdsheep_swf/MainClass.swf SoundManager   # 看单个类
python tools/probe_mirror.py --audio --quick                         # 按名字表探测并下载
```

**拿到的 35 个文件**：

| 类型 | 文件 |
|---|---|
| 音效（29） | `allAttack` `bigFire` `bigHit` `blast` `build` `buildUp` `burn` `clamp` `cold` `countDown` `fail` `gem` `gold` `lightning` `magicFire` `magicHit` `miss` `passMap` `poison` `reward` `sheep` `slow` `smallFire` `smallHit` `stab` `teleport` `win` `wolfComing` `wolfDie` |
| 战斗音乐（6） | `fight001` `fight004` `fight005` `fight010` `fight011` `fight012` |

常量表里还有 3 个名字**服务端确实没有**（HTTP 404）：`crit`、`beatBack`、`button`。
客户端里只有这 6 首战斗曲，大厅/地图背景音乐的名字不在客户端常量里，所以没找到。

> 这 35 个 mp3 已经接进游戏了（§9.1）：`tools/export_sounds.py` 把它们按响度归一化后 base64 内联进
> `assets/audio/sounds.js`，`dist/` 单文件版也带着走。程序化音效留作兜底。

## 3. 原站静态图（背景 / logo / 按钮 / 弹窗素材）

镜像站根目录旁边就是原官网用的 `static/images/`。目录列表被禁（403），只能按名字猜，
这轮补到了 34 张：

| 文件 | 是什么 |
|---|---|
| `first_install.jpg` (760×471) | **首次安装 / 入口宣传图**：原版标题字 + 扛炮的狼 + 三座炮塔 + 小羊 + 绿草坡。可以直接当标题画面底图 |
| `logo.jpg` / `logo.gif` | 原版「保卫羊村」标题字 logo（含炸弹装饰） |
| `b_01…b_10`（各两个版本，20 张） | 官网页首按钮：保卫羊村 / 邀请 / 充值 / 邀请好友 / 免费礼物 / 帮助 / 论坛 / 空间 / QQ充值 / QQ安全锁 |
| `nav.png` | 官网导航条 |
| `bottom.jpg` / `bottom.gif` | 官网页脚横条（合作方 logo 一栏） |
| `ztxbg.jpg` / `z_but.png` / `z_close.png` / `z_bottom.png` | 「分享微博」弹窗的底图、按钮、关闭叉 |
| `feed_weibo.jpg` | 微博分享用的小图（羊头 + logo） |
| `dpicture2.png` / `dpicture4.png` / `bg.png` | 分隔条 / 极细横线之类的小素材 |

拼图预览：`python tools/extra_sheet.py` → `tools/_preview/extra_sheet.png`。

另外补下了一个一直漏掉的 `gameUI/loading.swf`（52 KB）：它是**加载界面 UI**
（`UI_loading` 类，含 `bar_mc` 进度条、`timeout_btn`、`loadingAD_mc` 广告占位）。
标题里的 `loadingAD_001.swf`（主包内嵌引用）镜像站上没有。

## 4. 游戏设定：客户端配置解析

`tdsheep_swf/xmlFile_*.xml` 是原作客户端的配置，`tools/export_config_data.py` 把它们解析成
`tdsheep_swf/data/*.json`：

| 输出 | 内容 |
|---|---|
| `config_names.json` | `xmlFile_config.xml` 的 2919 条，按前缀分组 + 原始数组 |
| `strings_cn.json` | `xmlFile_string_cn.xml` 的 961 条界面文案（id → 字符串） |
| `guide.json` | 新手引导：59 个步骤，**带高亮圈坐标**（`t/x/y/w/h/r/xx/yy/s`） |
| `dream.json` | 噩梦模式引导 11 步 |
| `init_manifest.json` | 启动清单（客户端固定加载的 16 支 SWF + 4 支 XML） |
| `summary.json` | 统计数字（文档与收集台引用它） |

### 4.1 ⚠️ 这份 config.xml 是「被裁过的」

镜像站上的 `config.xml` 文件头写着 `<!--xpath#//@s-->`——**只保留了 `s="文案"` 属性，
数值属性在镜像端就被剥掉了**。所以它是一张「名称 / 文案字典」，**不是数值表**。
真正的数值（塔造价曲线、狼血量系数、宝石系数）是服务端下发的，这个站上拿不到；
原 Qzone CDN 早已下线，Internet Archive 上也没存档（CDX 只查到 3 条无关记录，
见 `tools/probe_web_archive.py`）。目前最全的数值来源是下一节的社区资料。

### 4.2 配置里有什么（前 15 组）

| 前缀 | 条数 | 内容 |
|---|---:|---|
| `wolfs_` | 763 | **狼图鉴**：名字 + 图鉴描述 + 战斗台词，扁平排列 |
| `task_` | 551 | 任务名与说明 |
| `return_msg_config_` | 256 | 服务端返回码 → 提示语 |
| `card_` | 240 | 狼卡 / 道具卡 |
| `camp_wolfs_` | 232 | 驯化营里狼说的话 |
| `skill_` | 198 | 技能名与说明 |
| `tame_` | 192 | 驯化系统文案 |
| `wc_` | 86 | 狼卡描述（如「驯化狼卡，使用后可获得一只一星阿呆狼…」） |
| `feed_gift_` | 64 | 好友动态模板 |
| `gem_` | 60 | 宝石名与说明 |
| `snarp_` | 46 | 竞技场相关 |
| `umaps_` | 38 | **主图名（原作顺序）** |
| `msg_templates_` | 33 | 系统消息模板 |
| `barrier_` | 26 | 障碍物名与说明 |
| `building_` | 20 | 建筑名 + 说明（哨塔/散弹/炮/镶嵌/波动/墙/元宵灯楼/织女/牛郎/盘龙柱） |

`dmaps_` 10 条是噩梦模式专属图名单，`wolf_hard_ness_` 6 条就是本作那六档难度
（小菜一碟 → 困难重重）。

### 4.3 狼图鉴（`wolfs_`）

763 条是**扁平**的：[名字][图鉴描述][台词…][名字][图鉴描述][台词…]……
`tools/make_collect_page.py` 按已知狼名（本作 `js/data.js` 132 只 + 社区 `YC_DATA`）切块，
再补 12 个「原作叫法不同」的名字，切成 **135 块**。例如：

```
暴走狼    速度很快，红血时会暴走
          暴走族入场，各位让道！
          带着墨镜就是有范儿
          速度再快也抚平不了羊儿给我的创伤
          嘿，羊儿们 给暴走哥哥笑一个
          嘿，看我的滑板冲刺吧！！

大犬蠢仪狼  为人狡猾偏执，小时曾偷男生内裤而被老师严惩，从此性格大变……
          别怕，我身上不带核辐射 / 看我优雅的小碎步 / …
```

补进去的 12 个名字：困囧狼、年兽、笨•狼灯、火•炎•焱、暴怒狼、梦幻小精灵、恶魔狼、
圣诞小狼王、圣诞灰狼、驯鹿宝宝狼、圣诞老狼王、超级年兽
（本作/社区里叫「困狼」「火・炎・焱」等，写法不一样，不补就会被并进上一只狼的台词里）。

切块是**启发式**的，个别块可能多带或少带一行，用的时候留意。

## 5. 数值与地图布局（社区整理）

社区工具 [tdsheepvillage-lineup](https://github.com/AC-ake/tdsheepvillage-lineup)
把《保卫羊村百科全书 V1.82.xlsx》和《保卫羊村全地图布局参考 2026.7.pdf》整理成了
`data.js` + 47 张地图布局图。已抓全到 `tdsheep_swf/community/`（53 个文件 / 19.1 MB）：

```
data.js              window.YC_DATA：towers / wolfs / gems / maps / typeName / baseRange…
maps/map_00..46.png  47 张地图布局参考图（每格的地块类型、出入口、传送、弹簧、火山…）
_build/extract_data.py  提取脚本（数据从 xlsx/pdf 怎么来的，写在里面）
index.html           社区布阵工具本体（含走狼路线、模拟出狼的实现）
version.json         V1.6 / 2026-09-29
```

本作的 `js/data.js`（`window.SVD`）与它同源：狼 132 条、地图 46 张。
两边**地图顺序不一样**（本作按关卡顺序，原作的 `umaps_` 是另一套顺序），
拿原作 `umaps_` 对照时注意别按序号硬套。

### 5.1 论坛也翻过了（没有数值）

`www.tdsheepvillage.com` 和 `www.kingdowin.com` 是**同一个 Discuz 的两块域名**（fid 1~4 内容一模一样），
`tools/forum_scan.py` 把各版块的帖子都列了一遍，也抓了正文，缓存落在 `tools/_refs/forum/`：

| 帖子 | 内容 | 结论 |
|---|---|---|
| 7331【新手攻略】羊村扫盲攻略 | 注册/养成/机制问答 | 玩家笔记，可当设定参考 |
| 8468【脚本发布】羊村挂机助手 1.0 | 图像识别挂机脚本（转到了 GitHub `AC-ake/tdsheepvillage-afk`） | 只有截图模板，**没有数值表** |
| 1033 自动升塔脚本 | 同样是 OpenCV 图像识别脚本 | 同上 |
| 8465 福利阵 / 引狼号 | 玩家好友链接 | 与数值无关 |

论坛里没有《百科全书》的附件，也没有带数值的配置表 —— 数值还是只能以社区 `data.js` 为准。

## 6. 还没拿到的东西

| 目标 | 情况 |
|---|---|
| 带数值的 `config.xml` 原文件 | 镜像站已裁掉数值属性；原 CDN 下线、无存档。**只能靠社区 xlsx 整理的 `data.js`** |
| 《保卫羊村百科全书 V1.82.xlsx》原表 | 社区仓库里没有（在上游作者本地），论坛需要登录/附件权限 |
| `loadingAD_001.swf` 加载广告 | 主包里内嵌引用了，镜像站上没有 |
| 大厅 / 世界地图的季节变体 | 镜像站上只有 TheStronghold / TheWorld 及驯化营、竞技场版本（雪季插画已经在用） |
| `crit` / `beatBack` / `button` 三个音效 | 服务端 404 |
| 大厅/地图背景音乐 | 名字不在客户端常量里，只找到 6 首战斗曲；大厅和世界地图仍用程序化的轻量 BGM |
| 「哪个事件放哪个声音」的对应表 | 写在原客户端 AS 代码里，没抠出来。§9.1 的表是按文件名和听感对的（推断） |

## 9. 接进游戏了什么

| 素材 | 接到哪 | 怎么接的 |
|---|---|---|
| 35 个音效 / 音乐 mp3 | `js/audio.js` | §9.1 |
| `first_install.jpg` | 标题画面底图 | §9.2 |
| 狼图鉴描述 + 战斗台词 | 羊村百科 → 狼图鉴 | §9.3 |
| 塔的原作介绍 / 宝石原作名 | 羊村百科 → 防御塔、宝石工坊 → 宝石说明 | §9.3 |

### 9.1 音效与音乐

`python tools/export_sounds.py` → `assets/audio/sounds.js`（`window.SVA_SOUND`，mp3 的 base64，336 KB）。
内联成 JS 是因为游戏要能 `file://` 双击运行、单文件版也不能带外部文件，`fetch` 都用不了。
导出时用 ffmpeg `volumedetect` 量每个文件的响度，写进「归一化增益」：这批文件音量差得很远
（`smallFire` 峰值 −30 dB，`fight011` 已经削顶到 0 dB）。音效峰值拉到 −3 dBFS（封顶 +24 dB），
音乐平均响度拉到 −20 dB 且峰值不超过 −1 dBFS。游戏里再按事件乘一个混音音量。

**事件 → 声音（推断，改 `js/audio.js` 里的 `SMAP` 即可）：**

| 游戏事件 | 原作文件 | 备注 |
|---|---|---|
| 建塔 / 卖塔 / 升级 / 镶宝石 | `build` / `gold`(×0.8 速) / `buildUp` / `gem` | |
| 拿银币、开宝箱 | `gold` / `reward` | |
| 哨塔、散弹塔出手 | `smallFire`（散弹升调 1.25×） | 出手声很轻，攒着放 |
| 炮塔出手、炮弹落地 | `bigFire`、`blast` | |
| 波动塔 / 镶嵌塔出手 | `magicFire` | |
| 紫宝石闪电 / 黄宝石全场闪光 | `lightning` / `allAttack` | |
| 命中 | `smallHit`；暴击 `bigHit`；波动 / 诅咒 `magicHit` | 炮塔命中不放（`blast` 已经有了） |
| 镶嵌塔命中：红 / 蓝 / 绿 | `burn` / `cold` / `poison` | |
| 狼死亡 / 偷到羊 / 新一波 / BOSS 预警 | `wolfDie` / `sheep` / `wolfComing` / `wolfComing`(×0.7 速) | |
| 捕兽夹 / 地雷 / 自爆 | `clamp` / `blast` / `blast` | |
| 狼闪烁 / 传送 / 召唤 | `teleport` | 护盾、复活放 `magicHit`，群疗放 `gem` |
| 通关 / 竞技场获胜 / 失败 | `passMap` / `win` / `fail` | |

没用上的：`slow`（没有「减速」这个事件）、`stab`（本作没有地刺）、`miss`（狼不会闪避）、`countDown`。
`click` / `hover` / `error` 原作根本没有（`button` 服务端 404），仍是程序化的。

**战斗音乐**：6 首 fight 曲都只有 8~14 秒（11 kHz 单声道，很糙）。普通战斗把 `001 / 004 / 005 / 010`
按关卡号起头轮播，每首至少放 45 秒（整数个循环）再淡入淡出换下一首；BOSS 用 `011`，竞技场用 `012`
（这两首最满最响）。这个分配纯属推断。大厅、世界地图、结算仍是程序化 BGM。

**特效驱动的音效**：引擎只往 `B.fx` 里推特效，不碰音频。UI 每帧调 `Audio.scanFx(B.fx)`，
给没处理过的特效打上 `snd` 标记并按类型发声（`hit` / `boom` / `ring` / `blink` / `tele` / `curse`）。
出手（`shoot`）、击杀、漏怪、炸弹这些引擎本来就有事件的不在这里重复放。同类音效有最小间隔，同时发声上限 20 路。

**关掉**：`window.SVA_SOUND_ORIGINAL = false`（全部回到程序化音效，战斗乐也是）。

### 9.2 标题画面

`python tools/export_ui_images.py` → `assets/ui/images.js`（`window.SVA_UI.title`，data URI）。
`js/art_title_original.js` 包住 `Scene.build/draw` 的 `'title'` 分支：按宽度铺满 1280、顶端对齐，
底部压一层暗角。原图自带「保卫羊村」标题字，所以给 `#scr-title` 加 `.orig` 类，
由 `css/style.css` 隐藏文字标题、把「怀旧服」徽章挪到标题字下面、把按钮挪到草坡留白处。
图没加载完就还是程序化羊村场景。关掉：`window.SVA_ORIGINAL_ART = {title:false}`。

原图只有 760×471，放大 1.68 倍后有点糊，但它本来就是扁平矢量风，看得过去。

`bottom.jpg`（官网玩法横条：访问好友 / 抢占矿山 / 设计防线…）没有用：它介绍的是原作的联网社交玩法，
本作是单机复刻，放进玩法说明会误导。

### 9.3 设定文案

`python tools/export_lore.py` → `assets/data/lore.js`（`window.SVA_LORE`，22 KB）：

| 内容 | 数量 | 用在哪 |
|---|---|---|
| 狼的图鉴描述 + 战斗台词 | 132 只狼里 130 只（104 个名字，去重后 349 条台词） | 狼图鉴点开一只已发现的狼：描述 + 台词气泡 |
| 塔的原作介绍 | 5 塔 + 墙 | 防御塔页每张卡片下面一行「原作介绍」 |
| 宝石原作名 + 属性 | 6 色 × 5 档 | 宝石工坊「宝石说明」每色下面一行 |

狼名对不上的处理：原作写法和本作不一样的加了别名（困狼↔困囧狼、圣殿骑士↔圣殿勇士、
火・炎・焱↔火•炎•焱、驯鹿狼宝↔驯鹿宝宝狼、灰狼宝宝（蓝/黄）↔限定灰狼宝宝）；
`wolfs_` 里没有的 15 只从 `camp_wolfs_`（驯化营）里补；同名多块取台词最多的一块
（原作配置里 光能狼 / 电狼巴克利 / 驾驶员柯丽德 各有一块复制粘贴的占位，靠这条规则去掉）。
仍然没有文案的只有 **变异杨六狼**、**魔法阿呆** 两只。

台词在原作里对应出场 / 被打 / 死亡等不同场合，顺序没留说明，所以这里只当一组台词展示，不区分场合，
也没有做成战斗里的对话气泡。

**没用上的**：`guide.json` 的新手引导 59 步讲的是原作联网玩法（苦工、好友、背包），跟本作的操作流程对不上，
本作自己的 3 步引导保留；`strings_cn.json` 的界面文案同理；`snarp_` / `barrier_` 是原作的陷阱 / 障碍物说明，
本作对应的机制不一样。

## 7. 复现命令

```bash
# 1) 镜像站：背景图 / 音效 / 漏抓的 SWF（先 --list / --probe 只看不下载）
python tools/probe_mirror.py --list                  # 全部候选（含音频，比较慢）
python tools/probe_mirror.py --only-image            # 只扫静态图
python tools/probe_mirror.py --audio --quick         # 只扫 gameSound/
python tools/probe_mirror.py                         # 下载命中的

# 2) 社区数值与地图布局
python tools/fetch_community_data.py --list
python tools/fetch_community_data.py

# 3) 客户端配置 → JSON
python tools/export_config_data.py

# 4) 可视化收集台
python tools/make_collect_page.py        # -> tools/collect_check.html
python tools/extra_sheet.py              # -> tools/_preview/extra_sheet.png

# 5) 接进游戏（生成 assets/ 下的内联资源；改了素材或映射后重跑）
python tools/export_sounds.py            # -> assets/audio/sounds.js
python tools/export_ui_images.py         # -> assets/ui/images.js
python tools/export_lore.py              # -> assets/data/lore.js
python tools/build_single.py             # 单文件版
```

## 8. 相关文件

| 文件 | 作用 |
|---|---|
| `tools/probe_mirror.py` | 按候选路径探测镜像站（XML / SWF / 静态图 / 音频），支持分组与合并清单 |
| `tools/fetch_community_data.py` | 抓社区 lineup 仓库（数值 + 地图布局 + 提取脚本） |
| `tools/probe_web_archive.py` | 查 Internet Archive 上原 CDN 的存档清单 |
| `tools/forum_scan.py` | 扫怀旧论坛（两个域名）的版块与帖子正文，缓存到 `tools/_refs/forum/` |
| `tools/abc_dump_strings.py` | 把 SWF 里所有 DoABC 字符串常量池转成文本，便于 grep |
| `tools/export_config_data.py` | `xmlFile_*.xml` → `tdsheep_swf/data/*.json` |
| `tools/make_collect_page.py` | 生成 `tools/collect_check.html` |
| `tools/extra_sheet.py` | 把 `tdsheep_swf/extra/` 的图拼成图册 |
| `tools/export_sounds.py` | mp3 → `assets/audio/sounds.js`（base64 内联 + 响度归一化增益） |
| `tools/export_ui_images.py` | 标题底图 → `assets/ui/images.js` |
| `tools/export_lore.py` | 狼图鉴 / 塔介绍 / 宝石名 → `assets/data/lore.js` |
| `tools/collect_check.html` | **收集台**：音频试听 + 图片 + 设定字典 + 地图布局 + 差距说明 |
