const fs = require("node:fs");

const marker = "// Art Atlas: explicit Codemagic release signing";
const releaseSigning = `
${marker}
android {
    signingConfigs {
        codemagicRelease {
            storeFile file(System.getenv("CM_KEYSTORE_PATH"))
            storePassword System.getenv("CM_KEYSTORE_PASSWORD")
            keyAlias System.getenv("CM_KEY_ALIAS")
            keyPassword System.getenv("CM_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.codemagicRelease
        }
    }
}

tasks.register("verifyCodemagicReleaseSigning") {
    doLast {
        def signing = android.buildTypes.release.signingConfig
        if (signing == null || signing.name != "codemagicRelease" ||
            signing.storeFile.canonicalPath != file(System.getenv("CM_KEYSTORE_PATH")).canonicalPath ||
            signing.keyAlias != System.getenv("CM_KEY_ALIAS")) {
            throw new GradleException("Release is not bound to the Codemagic upload key")
        }
        println("Release signing is bound to the Codemagic upload key.")
    }
}
`;

function configureAndroidReleaseSigning(source) {
  if (source.includes(marker)) {
    if (source.endsWith(releaseSigning)) return source;
    throw new Error("Existing Codemagic signing block was modified; refusing to append another block");
  }
  if (!/apply plugin:\s*["']com\.android\.application["']/.test(source)) {
    throw new Error("Expected the Expo Android application build.gradle");
  }
  // An explicit final DSL block avoids matching signingConfigs.release instead
  // of buildTypes.release, which previously left production signed with debug.
  return source.trimEnd() + "\n" + releaseSigning;
}

module.exports = { configureAndroidReleaseSigning };

if (require.main === module) {
  for (const name of ["CM_BUILD_DIR", "CM_KEYSTORE_PATH", "CM_KEYSTORE_PASSWORD", "CM_KEY_ALIAS", "CM_KEY_PASSWORD"]) {
    if (!process.env[name]) throw new Error(`Required signing environment variable is missing: ${name}`);
  }
  const path = `${process.env.CM_BUILD_DIR}/android/app/build.gradle`;
  fs.writeFileSync(path, configureAndroidReleaseSigning(fs.readFileSync(path, "utf8")));
}
