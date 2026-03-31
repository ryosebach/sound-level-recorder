const appJson = require("./app.json");

module.exports = () => {
  const config = appJson.expo;
  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
    },
    extra: {
      ...config.extra,
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? "",
    },
  };
};
