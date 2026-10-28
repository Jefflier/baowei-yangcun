// Google Play 版（带 AdMob 激励视频广告）的 Gradle 工程：用 Android Studio 打开 android/ 目录。说明见 docs/ANDROID_ADS.md
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "baowei-yangcun"
