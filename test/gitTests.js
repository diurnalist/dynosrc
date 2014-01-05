var test = require('tap').test;
var fs = require('fs');
var basename = require('path').basename;
var util = require('util');
var async = require('async');
var git = require('../lib/git');

git.setOutputDirectory(__dirname + '/../tmp/');

test("Bower test", function(t) {

  var bower = require('../lib/sources/bower');
  t.ok(bower, "Bower is a valid expression");

  bower.get({id: 'underscore'}, '', null, function(err, src) {
    t.ok(src.toString().indexOf('Underscore.js') > 0, 'Pulled file from bower');
    t.end();
  });

});

test("Checkout Tests", function(t) {

  var repo = git.getRepo('ModelFlow', 'ryanstevens');
  repo.clone().done(function(branch) {
    repo.checkout('master').done(function(branch) {
      console.log("Checked out branch " + branch);
      t.same(branch, "master");
      t.end();
    });
  });
});

test("Github raw tests", function(t) {
  t.plan(2);
  git.getGitHubRaw('ryanstevens/ModelFlow', 'package.json', '40efc16', function (err, res) {
    t.notOk(err, 'No errors');
    t.ok(res.length > 0, 'Should have some output');
    t.end();
  });
});

