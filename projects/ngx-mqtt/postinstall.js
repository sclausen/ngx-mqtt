if (process.env['MQTT_DISABLE_HOOK']) {
  console.info('NGX-MQTT: postinstall hook disabled, MQTT_DISABLE_HOOK')
  return 0;
}

const fs = require('fs');
const f = '../../node_modules/@angular-devkit/build-angular/src/webpack/configs/browser.js';

fs.readFile(f, 'utf8', function (err,data) {
  if (err) {
    console.error(err);
    throw err;
  }
  // at some moment angular-cli tam disabled node polyfills and stubs in webpack
  // from:
  // node: false
  // to:
  // node: {global: true}
  const result = (data.replace(/node: false/g, "node: {global: true}"));
  fs.writeFile(f, result, 'utf8', function (err) {
    if (err) {
      console.error(err);
      throw err;
    }
  });
});
