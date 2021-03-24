const fs = require('fs');
if (process.env.MQTT_DISABLE_HOOK) {
  console.info('NGX-MQTT: postinstall hook disabled, MQTT_DISABLE_HOOK');
  return 0;
}

const mqttPackageJsonPath = require.resolve('mqtt/package.json');

const mqttPackageJson = require(mqttPackageJsonPath);
mqttPackageJson.main = 'dist/mqtt.js';
fs.writeFile(mqttPackageJsonPath, JSON.stringify(mqttPackageJson), 'utf8', function (err) {
  if (err) {
    console.error(err);
    throw err;
  }
});
