// go out to Assets right now
var async = require('async'),
  fs = require('fs');

module.exports = {
  get: function(asset, version, config, cb) {
    var searchDir = config.assetsDir.replace(/\/?$/, '/'),
      id = asset.id;

    if (! searchDir) {
      return next({
        error: 'SERVER_ERROR',
        description: 'Asset directory not defined'
      });
    }

    fs.readFile(searchDir + asset.id + '/' + version + '.js', cb);
  }
};