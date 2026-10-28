// Google Play 版：和侧载版（python tools/build_apk.py）共用 android/ 下的源码、资源、清单和 version.properties，
// 多了 play/ 里的 AdMob 激励视频（play/java/.../Ads.java）和联网权限（play/AndroidManifest.xml）。
// 在 Android Studio 里选 playRelease，Build → Generate Signed App Bundle 出 .aab 上传 Google Play。步骤见 docs/ANDROID_ADS.md
import java.util.Properties

plugins {
    id("com.android.application") version "8.11.0"
}

fun props(name: String) = Properties().apply {
    file(name).takeIf { it.exists() }?.reader(Charsets.UTF_8)?.use { load(it) }
}
val ver = props("version.properties")
val upload = props("keystore.properties")   // 你自己的上传密钥，不要提交（已在 .gitignore 里），格式见 docs/ANDROID_ADS.md

// 谷歌官方的测试 ID：只出测试广告、没有收益
val testAppId = "ca-app-pub-3940256099942544~3347511713"
val testRewardedId = "ca-app-pub-3940256099942544/5224354917"
val admobAppId = providers.gradleProperty("admobAppId").get()
val admobRewardedId = providers.gradleProperty("admobRewardedId").get()

android {
    namespace = "com.baoweiyangcun.huaijiu"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.baoweiyangcun.huaijiu"     // 和 tools/build_apk.py 的 PACKAGE 一致
        minSdk = 26
        targetSdk = 37
        versionCode = ver.getProperty("versionCode").toInt()
        versionName = ver.getProperty("versionName")
    }

    buildFeatures { buildConfig = true }

    flavorDimensions += "store"
    productFlavors {
        create("play") { dimension = "store" }
    }

    sourceSets {
        getByName("main") {
            manifest.srcFile("AndroidManifest.xml")
            java.setSrcDirs(listOf("src"))
            res.setSrcDirs(listOf("res"))
        }
        getByName("play") {
            manifest.srcFile("play/AndroidManifest.xml")
            java.setSrcDirs(listOf("play/java"))
        }
    }

    signingConfigs {
        if (upload.isNotEmpty()) create("upload") {
            storeFile = file(upload.getProperty("storeFile"))
            storePassword = upload.getProperty("storePassword")
            keyAlias = upload.getProperty("keyAlias")
            keyPassword = upload.getProperty("keyPassword")
        }
    }

    buildTypes {
        // 调试版固定用测试 ID：开发时点自己的真广告会被 AdMob 判作弊
        getByName("debug") {
            manifestPlaceholders["admobAppId"] = testAppId
            buildConfigField("String", "ADMOB_REWARDED_ID", "\"$testRewardedId\"")
        }
        getByName("release") {
            manifestPlaceholders["admobAppId"] = admobAppId
            buildConfigField("String", "ADMOB_REWARDED_ID", "\"$admobRewardedId\"")
            if (upload.isNotEmpty()) signingConfig = signingConfigs.getByName("upload")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    "playImplementation"("com.google.android.gms:play-services-ads:24.4.0")
    "playImplementation"("com.google.android.ump:user-messaging-platform:3.1.0")   // 欧盟 / 英国等地区的广告同意表单
}

/** 游戏本体放进 assets/www/：和 tools/build_apk.py 打进侧载 APK 的是同一批文件，index.html 末尾插入 app.js */
abstract class StageWww : DefaultTask() {
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val game: ConfigurableFileCollection

    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val appJs: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Inject
    abstract val fs: FileSystemOperations

    @TaskAction
    fun stage() {
        fs.sync {
            into(outputDir.dir("www"))
            from(game) {
                filesMatching("index.html") {
                    filter { line: String -> line.replace("</body>", "<script src=\"app.js\"></script>\n</body>") }
                }
            }
            from(appJs)
            filteringCharset = "UTF-8"
        }
    }
}

val stageWww = tasks.register<StageWww>("stageWww") {
    // index.html 引用的样式和脚本，加上图片加载器按路径去取的 PNG（战斗底图 / 大厅与世界地图 / 狼图集）
    game.from(fileTree("..") {
        include("index.html", "css/style.css", "js/*.js")
        include("assets/art/*.js", "assets/audio/*.js", "assets/data/*.js", "assets/ui/*.js")
        include("assets/map/*.js", "assets/map/*.png", "assets/scene/*.js", "assets/scene/*.png")
        include("assets/wolf/*.js", "assets/wolf/*.png")
    })
    appJs.set(layout.projectDirectory.file("app.js"))
    outputDir.set(layout.buildDirectory.dir("generated/www"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(stageWww, StageWww::outputDir)
    }
}

// 正式版还在用测试 ID 就报错：上架后只会放测试广告、一分钱没有。真想用测试 ID 打正式版（比如自己试装）：加 -PallowTestAds=true
val usingTestIds = admobAppId == testAppId || admobRewardedId == testRewardedId
val allowTestAds = providers.gradleProperty("allowTestAds").isPresent
tasks.matching { it.name == "prePlayReleaseBuild" }.configureEach {
    doFirst {
        if (usingTestIds && !allowTestAds) {
            throw GradleException("android/gradle.properties 里的 admobAppId / admobRewardedId 还是谷歌的测试 ID，" +
                "换成你自己 AdMob 后台的 ID 再打正式版（只是自己试装可以加 -PallowTestAds=true）")
        }
    }
}
