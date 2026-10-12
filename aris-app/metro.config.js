const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

const metroResolver = require("metro-resolver");

// Direct 'page-mascot' to our universal React Native Mascot component
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "page-mascot": path.resolve(__dirname, "components/Mascot.tsx"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "page-mascot") {
    return {
      filePath: path.resolve(__dirname, "components/Mascot.tsx"),
      type: "sourceFile",
    };
  }
  return metroResolver.resolve(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
