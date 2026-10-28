# Google Play 版（带激励视频广告）

安卓 App 有两个版本，共用 `android/` 下的源码、资源和 `android/version.properties`：

| | 侧载版 | Google Play 版 |
|---|---|---|
| 怎么打包 | `python tools/build_apk.py` → `dist/保卫羊村怀旧服.apk` | Android Studio 打开 `android/`，变体 `playRelease` → `.aab` |
| 广告 | 没有 | AdMob 激励视频（`android/play/java/.../Ads.java`） |
| 权限 | 无 | 联网、广告 ID（为了放广告） |
| 签名 | 仓库里公开的 `android/sideload.keystore` | 你自己的上传密钥（不要提交），Google Play 再用应用签名密钥重签 |

两个版本包名相同、签名不同，不能互相覆盖安装；从侧载版换到商店版，先在「设置」里导出存档码，装好后再导入。

## 玩家看到的

大厅右上角多一个 **📺** 按钮（红点是今天剩余次数）。点开选一样奖励，看完一段广告就发：

| 奖励 | 数量 |
|---|---|
| 银币 | 4000 + 村长等级 × 150 |
| 炸弹 | 3 个 |
| 棒棒糖 | 2 根 |

- 每天最多领 5 次，第二天刷新；中途关掉广告不发奖励、也不算次数。
- 只在大厅放，战斗里不打断。
- 欧盟 / 英国等地区第一次打开会先弹广告同意表单（Google UMP），「设置」里有「广告隐私选项」可以随时改。
- 奖励内容和次数在 `android/app.js` 的 `REWARDS`、`LIMIT`；最高广告分级（现在是 PG）在 `Ads.java`。

## 一次性准备

### 1. AdMob

1. 在 <https://admob.google.com> 注册，添加应用（平台选 Android；还没上架就先选「未在应用商店上架」，上架后再关联）。
2. 在这个应用下新建一个**激励广告**单元。
3. 把**应用 ID**（`ca-app-pub-…~…`）和**广告单元 ID**（`ca-app-pub-…/…`）填进 `android/gradle.properties` 的 `admobAppId`、`admobRewardedId`。
   - 调试版（`playDebug`）不管填什么都用谷歌的测试 ID，开发时只会看到「Test Ad」。**别点自己的真广告**，会被判无效流量、封号。
   - 正式版（`playRelease`）还是测试 ID 时构建会直接报错，免得把只出测试广告的包传上去。
4. AdMob →「隐私权和消息」：创建并发布 **GDPR** 消息（欧盟 / 英国用户的同意表单）；面向美国的话再加「美国州级法规」消息。不建的话这些地区基本没有广告。
5. 上架以后在 Play 商品详情里填开发者网站，在网站根目录放 `app-ads.txt`（内容照 AdMob 后台给的那一行，形如
   `google.com, pub-你的发布商编号, DIRECT, f08c47fec0942fa0`）。没有它 AdMob 会限制广告投放。

### 2. 上传密钥

```bash
keytool -genkeypair -keystore upload.jks -storetype PKCS12 -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

把 `upload.jks` 放到 `android/` 下，新建 `android/keystore.properties`（这两个文件都已在 `.gitignore` 里，**不要提交、要备份好**）：

```properties
storeFile=upload.jks
storePassword=你设的库密码
keyAlias=upload
keyPassword=你设的密钥密码
```

上传到 Google Play 时选用「Play 应用签名」，Google 保管真正的应用签名密钥；上传密钥丢了可以申请重置。
**不要**用仓库里的 `sideload.keystore` 当上传密钥：它的密码是公开的。

### 3. 打包

- Android Studio：打开 `android/` 目录 → 左下 Build Variants 选 `playRelease` → Build → Generate Signed App Bundle。
- 命令行：`cd android && ./gradlew bundlePlayRelease`（Windows 用 `gradlew.bat`），产物在 `android/build/outputs/bundle/playRelease/`。
- 先在手机上试：选 `playDebug` 直接运行，📺 里能看到测试广告、能领到奖励就说明接通了。
- 每次发新版把 `android/version.properties` 的 `versionCode` 加 1。

Android Studio 提示升级 Android Gradle 插件 / Gradle 可以直接点升级。

## Google Play Console 要填的

- **隐私权政策网址**：用了广告 SDK 必须有。模板在 [`docs/privacy-policy.md`](privacy-policy.md)，改好联系方式后放到能公开访问的网页上（比如 GitHub Pages）。
- **广告**：选「包含广告」。
- **广告 ID**：选「使用」，用途选「广告或营销」。
- **数据安全**：AdMob 会收集设备 ID 等数据，按 Google 的说明填：<https://developers.google.com/admob/android/privacy/play-data-disclosure>。游戏自己的存档只在手机本地，不上传。
- **目标受众**：如果勾选了 13 岁以下，App 要遵守 Google Play 的「家庭政策」，广告必须按儿童定向处理。这需要改 `Ads.java`（`setTagForChildDirectedTreatment`），告诉我再改。
- **知识产权**：商品详情里用到原作名称和美术，Google 收到投诉时会要你出示授权，授权文件留好备查。
- **新开的个人开发者账号**要先做「封闭测试」（至少 12 个测试人员连续 14 天），之后才能申请正式发布。

## 上架前还要自己改的

`README.md` 末尾和游戏「设置」面板底部（`js/ui_panels.js`）都写着「非商业的粉丝复刻，与原作运营方无关」。
带广告的版本不再是非商业的，请按你拿到的授权改成合适的说明（比如授权方要求的署名）。
