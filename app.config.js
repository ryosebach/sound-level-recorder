const appJson = require("./app.json");

module.exports = () => {
  const config = appJson.expo;
  return {
    ...config,
    extra: {
      ...config.extra,
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? "",
    },
  };
};
