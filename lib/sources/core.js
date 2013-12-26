var fs = require('fs'),
  topLevelDir = __dirname + '/../../';

module.exports = {
  get: function(asset, version, config, cb) {
    fs.readFile(topLevelDir + asset.id + '.js', next);
  }
};