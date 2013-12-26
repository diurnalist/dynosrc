// go out to fixtures right now
var _ = require('underscore'),
  async = require('async'),
  esformatter = require('esformatter'),
  fs = require('fs'),
  mkdirp = require('mkdirp'),
  errors = require('./errors');

function getDiffable(input) {
  var str = input.toString('utf8'),
    // this is a simple heuristic Webkit uses to detect whether it wants
    // to try automatically de-obfuscating source
    likelyMinified = _.any(str.split('\n'), function(line) {
      return line.length > 500;
    });

  if (likelyMinified) {
    return esformatter.format(str);
  }

  return new Buffer(str, 'utf8');
}

function toPatchObject(id, fromVersion, toVersion, contents) {
  return {
    id: id,
    from: fromVersion,
    to: toVersion,
    contents: contents
  };
}

function getVersion(version, asset, config) {
  return version === 'HEAD'
    ? (config.dev
      // dev mode uses epoch versions to ensure diffs always happen
      ? 'DEV-' + Date.now()
      : asset.head)
    : version;
}

function getFromSource(source, asset, version, config, cb) {
  if (! version) {
    // no version defined, exit early w/ null contents
    return cb(null, null);
  }

  var outDir = config.outputDir.replace(/\/?$/, '/'),
    tag, cachePath, sourceVersion;

  // store inside subfolder by source
  outDir += source.name + '/';
  tag = source.tag
    ? source.tag(asset, config)
    // default implementation
    : asset.id.replace(/\//g, '.');
    
  cachePath = outDir + tag + '#' + version;

  // DEV versions should proxy to source HEAD
  sourceVersion = (config.dev && /^DEV-\d+/.test(version))
    ? asset.head
    : version;

  async.waterfall([
    function(next) {
      // do we have it already?
      // this is kind of more complex than 'needed' b/c i want
      // to avoid reading the entire file to do this check
      fs.open(cachePath, 'r', function(err, fd) {
        if (err) {
          return err.code === 'ENOENT'
            ? next(null, false) // OK case, file not found
            : next(err); // error case
        }

        fs.close(fd);
        next(null, true);
      });
    },
    function(exists, next) {
      if (exists) {
        return fs.readFile(cachePath, next);
      }

      async.waterfall([
        function(next) {
          // ensure availability of output dir
          mkdirp(outDir, next);
        },
        function(made, next) {
          // find source file
          source.get(asset, sourceVersion, config, next);
        },
        function(contents, next) {
          var diffable = getDiffable(contents);

          fs.writeFile(cachePath, diffable);
          next(null, diffable);
        }
      ], next);
    }
  ], cb);
}

function checkDiffCache(id, config, fromVersion, toVersion, cb) {
  var diffDir = config.outputDir.replace(/\/?$/, '/') + 'diffs/',
    fileName = diffDir + id+"#"+fromVersion+"#"+toVersion;

  fs.exists(fileName, function(exists) {
    if (exists) {
      fs.readFile(fileName, 'utf8', function(err, data) {
        cb(null, toPatchObject(id, fromVersion, toVersion, data));
      })
    }
    else cb(function writeCb(patchObj) {
      mkdirp(diffDir, function() {
        fs.createWriteStream(fileName, {encoding : 'utf8'})
          .end(patchObj.contents);
      })
    });
  })
}

module.exports = function(id, from, to, config, cb) {
  var asset,
    fromVersion,
    toVersion;

  asset = config.get(id);

  fromVersion = getVersion(from, asset, config);
  toVersion = getVersion(to, asset, config);

  if (! toVersion) {
    // if trying to patch to HEAD, error originates b/c the asset
    // does not have the `HEAD` shortcut defined
    var toHead = (to === 'HEAD');
    
    return cb({
      error: toHead ? 'SERVER_ERROR' : 'INVALID_REQUEST',
      description: toHead
        ? 'Missing HEAD configuration for asset'
        : 'Missing `to` version'
    });
  }

  console.log('Patching ' + id + '@' + (fromVersion || '(none)') 
    + ' to ' + toVersion);

  checkDiffCache(id, config, fromVersion, toVersion, function(cacheCb, patchFromCache) {

    //this tells us not to call cacheCb cause it found the file :)
    if (patchFromCache) return cb(null, patchFromCache);

    if (fromVersion === toVersion) {
      return cb(null, toPatchObject(id, fromVersion, toVersion, ''));
    }

    async.waterfall([
      // get the source files to compare
      function(next) {
        var source = config.getSource(asset.source);

        async.parallel([
          getFromSource.bind(null, source, asset, fromVersion, config),
          getFromSource.bind(null, source, asset, toVersion, config)
        ], next);
      },
      // generate the patch
      function(sources, next) {
        var fromSrc = sources[0],
          toSrc = sources[1],
          differ = config.getDiffer(asset.differ);

        if (! fromSrc) {
          return next(null, toSrc);
        }

        differ(asset, fromSrc, toSrc, next);
      },
      // output in structured format
      function(patch, next) {
        console.log(arguments);
        var patchObj = toPatchObject(id, fromVersion, toVersion, patch);
        //cache it
        cacheCb(patchObj);
        next(null, patchObj);
      }
    ], cb);

  });

};