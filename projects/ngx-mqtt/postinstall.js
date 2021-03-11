const path = require("path");
const fs = require("fs");
const semver_1 = require("semver");
if (process.env["MQTT_DISABLE_HOOK"]) {
  console.info("NGX-MQTT: postinstall hook disabled, MQTT_DISABLE_HOOK");
  return 0;
}

let f =
  "../../node_modules/@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/browser.js";
const cwd = process.cwd();
const packageJsonPath = path.join(
  cwd,
  "node_modules/@angular/core/package.json"
);
if (fs.existsSync(packageJsonPath)) {
  const content = fs.readFileSync(packageJsonPath, "utf-8");
  if (content) {
    const { version } = JSON.parse(content);
    if (version) {
      let semv = new semver_1.SemVer(version);
      if (semv.gt('0.1100.0')) {
        f =
          "../../node_modules/@angular-devkit/build-angular/src/webpack/configs/browser.js";
      }
    }
  }
}

fs.readFile(f, "utf8", function (err, data) {
  if (err) {
    console.error(err);
    throw err;
  }
  // at some moment angular-cli tam disabled node polyfills and stubs in webpack
  // from:
  // node: false
  // to:
  // node: {global: true}
  const result = data.replace(/node: false/g, "node: {global: true}");
  fs.writeFile(f, result, "utf8", function (err) {
    if (err) {
      console.error(err);
      throw err;
    }
  });
});
