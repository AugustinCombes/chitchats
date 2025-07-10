const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure public path for GitHub Pages
if (process.env.EXPO_PUBLIC_BASE_PATH) {
  config.transformer = {
    ...config.transformer,
    publicPath: process.env.EXPO_PUBLIC_BASE_PATH,
  };
}

module.exports = config;