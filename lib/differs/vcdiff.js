var diffable = require('vcdiff'),
  vcd = new diffable.Vcdiff(),
  encoding = 'utf-8';

vcd.blockSize = 3;

module.exports = function (asset, v1, v2, cb) {
  var diff = vcd.encode(v1.toString(encoding), v2.toString(encoding)),
    output = new Buffer(JSON.stringify(diff));

  cb(null, output);
};