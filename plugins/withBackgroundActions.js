const { withAndroidManifest } = require("expo/config-plugins");

const SERVICE_NAME = "com.asterinet.react.bgactions.RNBackgroundActionsTask";

/**
 * Expo config plugin that explicitly declares the RNBackgroundActionsTask
 * service with foregroundServiceType="microphone".
 *
 * The library's own AndroidManifest registers the service without a
 * foregroundServiceType. On Android 14+ (targetSDK 34+) this causes
 * MissingForegroundServiceTypeException. By declaring the service here
 * with the correct type, the manifest merger picks up our attributes
 * via tools:replace.
 */
module.exports = function withBackgroundActions(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return modConfig;

    if (!application.service) {
      application.service = [];
    }

    // Remove any existing entry to avoid duplicates
    application.service = application.service.filter((s) => s.$?.["android:name"] !== SERVICE_NAME);

    // Add the service with foregroundServiceType
    application.service.push({
      $: {
        "android:name": SERVICE_NAME,
        "android:foregroundServiceType": "microphone",
      },
    });

    return modConfig;
  });
};
