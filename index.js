var async = require('async'),
  _ = require('underscore'),
  fs = require('fs'),

  patchit = require('./lib/patchit'),
  middleware = require('./lib/middleware'),
  errors = require('./lib/errors'),
  pluginLoader = require('./lib/pluginLoader'),
  sources = {},
  differs = {},

  clientLib = _.template(fs.readFileSync(__dirname + '/dynoSrc-core.js').toString()),
  packageVersion = require('./package.json').version,

  jsSafeString = function(str) {
    return str.replace(/\\/g, '\\\\')
      .replace(/\u0008/g, '\\b')
      .replace(/\t/g, '\\t')
      .replace(/\r?\n/g, '\\n')
      .replace(/\f/g, '\\f')
      .replace(/\r/g, '\\r')
      .replace(/'/g, '\\\'')
      .replace(/"/g, '\\"');
  },
  formatters = {
    'json': function(patch) {
      var json = {
        id: patch.id,
        from: patch.from || null,
        to: patch.to
      };

      if (patch.from) {
        json.diff = patch.contents;
      } else {
        json.raw = patch.contents;
      }

      return json;
    },
    'js': function(patch) {
      if (patch.contents) {
        return config.scriptAddFn + '('
          + '"' + patch.id + '",'
          + '"' + patch.to + '",'
          + '"' + jsSafeString(patch.contents) + '"'
          + ');';
      } else {
        return config.scriptLoadFn + '('
          + '"' + patch.id + '",'
          + '"' + patch.to + '"'
          + ');';
      }
    },
    'script': function(patch) {
      return '<script>' + this.js(patch) + '</script>';
    }
  },

  blacklistedKeys = ['assets', 'defaults', 'get', 'getSource', 'globals'],
  config = {
    dev: false,
    
    // client-shared config options
    cookieName: '_ds',
    cookiePairSeparator: '|',
    cookieRevSeparator: '@',
    localStoragePrefix: 'dynosrc.',
    scriptAddFn: 'dynoSrc.add',
    scriptLoadFn: 'dynoSrc.load',
    plugins: ['cookie', 'diff'],
    version: packageVersion,
    
    maxAge: 2592000,

    outputDir: __dirname + '/tmp',
    assetsDir: '',

    assets: {},
    defaults: {
      source: 'asset',
      differ: 'git'
    },
    get: function(id) {
      var asset = this.assets[id];

      if (! asset) {
        // check aliases
        asset = _.find(this.assets, function(a) {
          return a.alias && a.alias === id;
        }) || {id: id}; // fallback
      }
      
      return _.extend({}, this.defaults, asset);
    },
    getSource: function(name) {
      if (! sources[name]) {
        throw new Error('Source ' + name + ' not defined!');
      }

      return sources[name];
    },
    getDiffer: function (name) {
      if (! differs[name]) {
        throw new Error('Differ ' + name + ' not defined!');
      }

      return differs[name];
    },
    globals: function() {
      return _.omit(this, blacklistedKeys);
    }
  };

function onPatch(fmt, cb, err, res) {
  if (err) {
    var niceError = err.error && errors[err.error];
    return cb(_.extend(niceError || {}, err));
  }

  var formatter = (formatters[fmt] || formatters['json']).bind(formatters);

  return cb(null, formatter(res));
}

function DynoSrc(globals) {
  this.config = _.clone(config, true);

  if (globals) {
    this.globals(globals);
  }

  this.config.plugins.forEach(function(plugin) {
    this.asset('dynoSrc-' + plugin, {
      source: 'core',
      // tie asset to npm version so if package is updated, updated core lib
      // assets will be automatically delivered to clients
      head: packageVersion
    });
  }, this);

  // there is a hole where `sources` are techincally going to be shared
  // amongst all instances but that should be OK for now
}

_.extend(DynoSrc.prototype, {
  factory: function(globals) {
    // return new instance
    var instance = new DynoSrc(globals);
    return instance;
  },
  globals: function(options) {
    _.extend(this.config, _.omit(options, blacklistedKeys));
  },
  defaults: function(defaults) {
    _.extend(this.config.defaults, defaults);
  },
  asset: function(id, conf) {
    this.config.assets[id] = _.extend({id: id}, this.config.assets[id], conf);
  },
  assets: function (assets) {
    _.each(assets, function(conf, id) {
      this.asset(id, conf);
    }, this);
  },
  patch: function (id, from, to, format, cb) {
    var cb = _.last(arguments),
      fmt = arguments.length === 5 ? arguments[3] : 'json';

    if (arguments.length < 4) {
      return cb('Missing required fields');
    }

    return patchit(id, from, to, this.config, onPatch.bind(null, fmt, cb));
  },
  getPatches : function (req, options, cb) {
    var format = options.format || 'script',
      desiredPatches = options.patches
        ? options.patches.concat(this.config.plugins.map(function(p) { return 'dynoSrc-' + p; }))
        : null,
      patches = req.getDynoSrcPatches(desiredPatches);

    return async.parallel(_.map(patches, function(patch) {
      return this.patch.bind(this, patch.id, patch.from, patch.to, format);
    }, this), cb);
  },
  getClientLib : function (raw) {
    // TODO: minification support
    var tmplData = this.config.globals();

    tmplData.plugins = JSON.stringify(_.map(tmplData.plugins, function (name) {
      return 'dynoSrc-' + name;
    }));

    var clientJs = clientLib(tmplData);

    return raw
      ? clientJs
      : ['<script>', clientJs, '</script>'].join('\n');
  },
  middleware: middleware,
  defineSource: function (name, source) {
    if (sources[name]) {
      throw new Error('Source ' + name + ' already exists!');
    }

    sources[name] = source;
  },
  readMe : function(cb) {
    fs.readFile(__dirname + '/README.md', 'utf8', cb);
  }
});

// load all plugins
sources = pluginLoader(__dirname + '/lib/sources');
differs = pluginLoader(__dirname + '/lib/differs');

// create a default instance
module.exports = new DynoSrc();
