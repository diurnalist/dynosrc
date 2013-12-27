var fs = require('fs'),
  _ = require('underscore'),
  topLevelDir = __dirname + '/../../';

module.exports = {
  get: function(asset, version, config, cb) {
    fs.readFile(topLevelDir + asset.id + '.js', function (err, contents) {
      if (err) {
        return cb(err);
      }

      cb(null, new Buffer(_.template(contents.toString('utf-8'), config.globals())));
    });
  }
};