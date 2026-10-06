const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Metro's default is one transform worker per CPU core. On some Windows
// machines that crashes Node with a native segmentation fault (exit code
// 0xC0000005 / 139) the first time a bundle is requested, which would kill
// `expo start` as soon as a phone scans the QR code. A single worker is
// slower on a cold cache but does not crash. Remove this line to restore the
// default if your machine is unaffected. Only applied on Windows, where it
// was seen; other platforms keep Metro's default.
if (process.platform === "win32") {
  config.maxWorkers = 1;
}

module.exports = config;
