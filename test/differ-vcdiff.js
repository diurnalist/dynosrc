var test = require('tap').test,
  fs = require('fs'),
  vcdiffer = require('../lib/differs/vcdiff');

test('VCDiff', function (t) {
  var str1 = "abcdefighjklmnop",
    str2 = "abcdefihgjklmnop",
    asset = {id: 'test'};

  vcdiffer(asset, str1, str2, function (err, diff) {
    t.notOk(err, 'No errors');
    t.ok(diff, 'Got a diff back');
    t.ok(diff.length > 1, 'Diff has contents');

    t.end();
  });
});

test('VCDiff can handle large files', function (t) {
  var str1 = fs.readFileSync(__dirname + '/assets/jquery/1.9.1.js'),
    str2 = fs.readFileSync(__dirname + '/assets/jquery/1.10.2.js');

  vcdiffer({id: 'jquery'}, str1, str2, function (err, diff) {
    t.notOk(err, 'No errors');
    t.ok(diff, 'Got a diff back');
    t.ok(diff.length > 1, 'Diff has contents');

    t.end();
  });
});
