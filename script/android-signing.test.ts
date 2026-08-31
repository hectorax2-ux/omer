import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { configureAndroidReleaseSigning } from "./configure-codemagic-android.cjs";

// Expo's generated signing/buildTypes layout, including the debug default.
const source = `apply plugin: "com.android.application"
android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}
`;

describe("Codemagic release signing", () => {
  test("preserves generated debug configuration and explicitly binds only release", () => {
    const result = configureAndroidReleaseSigning(source);
    expect(result.startsWith(source)).toBe(true);
    expect(result.slice(source.length)).toContain("buildTypes {\n        release {\n            signingConfig signingConfigs.codemagicRelease");
    expect(result.slice(source.length)).not.toContain("debug {");
    expect(result).toContain("android.buildTypes.release.signingConfig");
  });

  test("an existing signingConfigs.release cannot capture the debug build type", () => {
    const existing = source.replace("    signingConfigs {", "    signingConfigs {\n        release { storeFile file('previous.keystore') }");
    const result = configureAndroidReleaseSigning(existing);
    expect(result.startsWith(existing)).toBe(true);
    expect(result.slice(existing.length)).toContain("signingConfig signingConfigs.codemagicRelease");
    expect(result.slice(existing.length)).not.toContain("signingConfig signingConfigs.debug");
  });

  test("reapplying configuration does not duplicate signing blocks", () => {
    const configured = configureAndroidReleaseSigning(source);
    expect(configureAndroidReleaseSigning(configured)).toBe(configured);
  });

  test("unexpected files or modified appended configuration fail closed", () => {
    expect(() => configureAndroidReleaseSigning("android {}")).toThrow();
    expect(() => configureAndroidReleaseSigning(configureAndroidReleaseSigning(source) + "// changed")).toThrow();
  });

  test("workflow verifies both the effective Gradle configuration and final AAB", () => {
    const workflow = parse(readFileSync(new URL("../codemagic.yaml", import.meta.url), "utf8")).workflows["android-production"];
    const configure = workflow.scripts.find((step: { name: string }) => step.name === "Configure Android release signing");
    const build = workflow.scripts.find((step: { name: string }) => step.name === "Build signed Android App Bundle");
    expect(configure.script).toContain("node script/configure-codemagic-android.cjs");
    expect(configure.script).not.toContain("source.replace");
    expect(build.script).toContain("set -euo pipefail");
    expect(build.script).toContain(":app:verifyCodemagicReleaseSigning :app:bundleRelease");
    expect(build.script.indexOf("verify-android-bundle.sh")).toBeGreaterThan(build.script.indexOf(":app:bundleRelease"));
    expect(build.script.indexOf("cp app/build/outputs/bundle/release/app-release.aab")).toBeGreaterThan(build.script.indexOf("verify-android-bundle.sh"));
    expect(workflow.artifacts).toContain("build/verified-android/*.aab");
    expect(workflow.artifacts).not.toContain("android/app/build/outputs/**/*.aab");
  });
});
