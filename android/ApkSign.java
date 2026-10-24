import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * tools/build_apk.py 用的签名小工具（apksig 是谷歌 apksigner 的库本体，从 Maven Central 下载）：
 *   java -cp apksig.jar android/ApkSign.java 输入.apk 输出.apk 密钥库 库密码 别名 密钥密码 minSdk
 * minSdk ≥ 24 只用 v2 签名（安卓 7.0 起都认 v2；目标 30+ 的 APK 必须有 v2），签完立即校验。
 */
public class ApkSign {
    public static void main(String[] a) throws Exception {
        File in = new File(a[0]), out = new File(a[1]);
        int minSdk = Integer.parseInt(a[6]);
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (InputStream s = new FileInputStream(a[2])) {
            ks.load(s, a[3].toCharArray());
        }
        PrivateKey key = (PrivateKey) ks.getKey(a[4], a[5].toCharArray());
        if (key == null) throw new IllegalArgumentException("密钥库里没有别名 " + a[4]);
        List<X509Certificate> certs = new ArrayList<>();
        for (Certificate c : ks.getCertificateChain(a[4])) certs.add((X509Certificate) c);

        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder("CERT", key, certs).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(in).setOutputApk(out)
                .setMinSdkVersion(minSdk)
                .setV1SigningEnabled(false)
                .setV2SigningEnabled(true)
                .setCreatedBy("tools/build_apk.py")
                .build().sign();

        ApkVerifier.Result r = new ApkVerifier.Builder(out).setMinCheckedPlatformVersion(minSdk).build().verify();
        for (ApkVerifier.IssueWithParams w : r.getWarnings()) System.out.println("签名警告：" + w);
        for (ApkVerifier.IssueWithParams e : r.getErrors()) System.out.println("签名错误：" + e);
        if (!r.isVerified() || !r.isVerifiedUsingV2Scheme()) throw new IllegalStateException("签名校验没通过");
        StringBuilder fp = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(certs.get(0).getEncoded())) fp.append(String.format("%02X:", b));
        System.out.println("签名校验通过（v2）。证书 SHA-256：" + fp.substring(0, fp.length() - 1));
    }
}
