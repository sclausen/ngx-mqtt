var rimraf = require('rimraf');
var prefixes = [
  './src/index',
  './src/mqtt.model',
  './src/mqtt.module',
  './src/mqtt.service',
  './tests/mqtt.service.spec'
];
var suffixes = ['.js', '.d.ts', '.metadata.json', '.js.map'];
var list = [];

prefixes.forEach(function(prefix) {
  suffixes.forEach(function(suffix) {
    list.push(prefix + suffix);
  });
});

rimraf.sync("{" + list.join(",") + ",bundles,coverage,documentation}");