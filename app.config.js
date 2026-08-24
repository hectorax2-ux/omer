const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod, withInfoPlist } = require("@expo/config-plugins");

const permissionUsageDescriptions = {
  photos: "Art Atlas lets you choose images from your library for profile photos and art uploads.",
  camera: "Art Atlas uses the camera so you can capture profile or artwork photos.",
  tracking: "Art Atlas may use your device identifier to improve ad relevance. You can decline this permission."
};

const googleTestPublisherId = "3940256099942544";
const testAndroidAppId = `ca-app-pub-${googleTestPublisherId}~3347511713`;
const testIosAppId = `ca-app-pub-${googleTestPublisherId}~1458002511`;
const blockedAndroidPermissions = [
  "android.permission.RECORD_AUDIO",
  "android.permission.READ_CONTACTS",
  "android.permission.WRITE_CONTACTS",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.SYSTEM_ALERT_WINDOW"
];

function isProductionBuild() {
  return process.env.EXPO_PUBLIC_APP_CHANNEL === "production";
}

function requireProductionAdMobAppId(platform, value) {
  if (value && !value.includes(googleTestPublisherId)) {
    return value;
  }

  if (isProductionBuild()) {
    throw new Error(
      platform === "android"
        ? "Production build requires a real EXPO_PUBLIC_ADMOB_ANDROID_APP_ID. Google test IDs are not allowed."
        : "Production build requires a real EXPO_PUBLIC_ADMOB_IOS_APP_ID. Google test IDs are not allowed."
    );
  }

  return platform === "android" ? testAndroidAppId : testIosAppId;
}

function resolveAdMobAppId(platform) {
  return requireProductionAdMobAppId(
    platform,
    platform === "android"
      ? process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID?.trim()
      : process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim()
  );
}

function withStoreReleaseHardening(config) {
  config.android = {
    ...config.android,
    softwareKeyboardLayoutMode: "resize",
    permissions: (config.android?.permissions || []).filter((permission) => !blockedAndroidPermissions.includes(permission)),
    blockedPermissions: Array.from(new Set([
      ...(config.android?.blockedPermissions || []),
      ...blockedAndroidPermissions
    ]))
  };

  config.ios = {
    ...config.ios,
    infoPlist: {
      ...(config.ios?.infoPlist || {}),
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false
      }
    }
  };

  return withInfoPlist(withAndroidManifest(config, (nextConfig) => {
    const manifest = nextConfig.modResults.manifest;
    manifest.$ = {
      ...(manifest.$ || {}),
      "xmlns:tools": "http://schemas.android.com/tools"
    };
    manifest["uses-permission"] = (manifest["uses-permission"] || []).filter((permission) => {
      const name = permission.$?.["android:name"];
      return !blockedAndroidPermissions.includes(name);
    });

    const app = manifest.application?.[0];
    if (app?.["meta-data"]) {
      app["meta-data"].forEach((item) => {
        const name = item.$?.["android:name"];
        if (
          name === "com.google.android.gms.ads.APPLICATION_ID" ||
          name === "com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT"
        ) {
          item.$ = {
            ...(item.$ || {}),
            "tools:replace": "android:value"
          };
        }
      });
    }

    return nextConfig;
  }), (nextConfig) => {
    delete nextConfig.modResults.NSMicrophoneUsageDescription;
    nextConfig.modResults.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: false
    };
    return nextConfig;
  });
}

function withIosModularHeaders(config) {
  return withDangerousMod(config, ["ios", (nextConfig) => {
    const podfilePath = path.join(nextConfig.modRequest.platformProjectRoot, "Podfile");
    const podfile = fs.readFileSync(podfilePath, "utf8");

    if (podfile.includes("use_modular_headers!")) {
      return nextConfig;
    }

    fs.writeFileSync(
      podfilePath,
      podfile.replace(/(platform :ios,.*\n)/, "$1use_modular_headers!\n")
    );
    return nextConfig;
  }]);
}

module.exports = ({ config }) => withStoreReleaseHardening({
    ...config,
    plugins: [
      ...(config.plugins || []).filter((plugin) => plugin !== "expo-notifications" && !(Array.isArray(plugin) && plugin[0] === "expo-notifications")),
      [
        "expo-notifications",
        {
          mode: isProductionBuild() ? "production" : "development",
          icon: "./assets/notification-icon.png",
          color: "#D9B865",
          defaultChannel: "art-atlas-general"
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: permissionUsageDescriptions.photos,
          cameraPermission: permissionUsageDescriptions.camera
        }
      ],
      "expo-tracking-transparency",
      "expo-iap",
      "react-native-nitro-google-signin",
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: resolveAdMobAppId("android"),
          iosAppId: resolveAdMobAppId("ios"),
          userTrackingUsageDescription: permissionUsageDescriptions.tracking,
          delayAppMeasurementInit: true
        }
      ],
      withIosModularHeaders,
      withStoreReleaseHardening
    ],
    android: {
      ...config.android,
      googleServicesFile: "./google-services.json",
      permissions: [
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE"
      ],
      blockedPermissions: blockedAndroidPermissions
    },
    ios: {
      ...config.ios,
      googleServicesFile: "./GoogleService-Info.plist",
      usesAppleSignIn: true,
      infoPlist: {
        ...(config.ios?.infoPlist || {}),
        NSPhotoLibraryUsageDescription: permissionUsageDescriptions.photos,
        NSCameraUsageDescription: permissionUsageDescriptions.camera,
        NSPhotoLibraryAddUsageDescription: "Art Atlas can save selected images to your library when you choose to export or share artwork.",
        NSUserTrackingUsageDescription: permissionUsageDescriptions.tracking,
        ITSAppUsesNonExemptEncryption: false,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false
        }
      }
    }
});
