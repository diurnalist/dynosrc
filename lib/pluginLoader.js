var fs = require('fs');

module.exports = function (dirname) {
  var files = fs.readdirSync(dirname);

  return files.reduce(function(exports, file) {
    var source, name;

    if (file !== 'index.js') {
      source = require(dirname + '/' + file);

      name = file.replace(/\.js$/, '');
      source.name = name;
      
      exports[name] = source;
    }

    return exports;
  }, {});
};