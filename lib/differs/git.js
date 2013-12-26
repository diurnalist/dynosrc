var spawn = require('child_process').spawn,
  fs = require('fs'),
  async = require('async'),
  mkdirp = require('mkdirp'),
  crypto = require('crypto'),

  outDir = __dirname + '/../../tmp/';

function getChecksum (contents) {
  var checksum = crypto.createHash('md5');

  checksum.update(contents);

  return checksum.digest('hex');
}

function ensureExists (file, cb) {
  if (file.exists) {
    return cb(null, file.tmpPath);
  }

  fs.writeFile(file.tmpPath, file.contents, cb);
}

function cmd () {
  var args = Array.prototype.slice.call(arguments),
    cmd, cb,
    process,
    chunks = [];

  cmd = args.shift();
  cb = args.pop();
  process = spawn(cmd, args);

  process.stdout.on('data', function (chunk) {
    chunks.push(chunk.toString('utf8'));
  });

  process.stdout.on('end', function() {
    cb(null, chunks.join(''));
  });

  process.stderr.on('data', function (chunk) {
    console.error(chunk.toString('utf8'));
    cb(chunk, null);
  });

  return process.stdout;
}

function createDiffStream (v1, v2, cb) {
  return cmd('git', 'diff', '--no-index', v1.tmpPath, v2.tmpPath, cb);
}

function getFiles (name /*, file1, file2, ... */) {
  var fileContents = Array.prototype.slice.call(arguments, 1);

  return fileContents.reduce(function (files, contents) {
    var hash = getChecksum(contents);

    files.push({
      exists: false,
      contents: contents,
      hash: hash,
      tmpPath: outDir + name + '-' + hash
    });

    return files;
  }, []);
}

module.exports = function (asset, v1, v2, cb) {
  if (! v1) {
    // if diffing from nothing, 'diff' = contents of v2
    return cb(null, v2.toString('utf8'));
  }

  var id = asset.id,
    files = getFiles(id, v1, v2),
    paths;

  if (files[0].hash === files[1].hash) {
    return cb(null, '');
  }

  tmpPaths = files.map(function (f) { return f.tmpPath });

  // for each path, see if we can read it (is in cache?)
  async.map(tmpPaths, fs.exists, function (err, exists) {
    files[0].exists = exists[0];
    files[1].exists = exists[1];

    async.waterfall([
      function (next) {
        mkdirp(outDir, next);
      },
      function (res, next) {
        async.map(files, ensureExists, next);
      },
      function (res, next) {
        // if we make it here, we know the files are there
        createDiffStream(files[0], files[1], next);
      }
    ], cb);
  });
};