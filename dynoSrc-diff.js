/**
 * dynoSrc-diff
 */

(function (dynoSrc) {

var patchers = {
  'vcdiff': {
    regex: /^\[/,
    /*
     * Applies VCDiff patch
     */
    patch: function (oldStr, patch) {
      var vcdiff = JSON.parse(patch);

      if (vcdiff.length === 0) {
        return oldStr;
      }

      var output = [], i;
      for (i = 0; i < vcdiff.length; i += 1) {
        if (typeof vcdiff[i] === 'number') {
            output.push(oldStr.substring(vcdiff[i], vcdiff[i] + vcdiff[i + 1]));
            i += 1;
        } else if (typeof vcdiff[i] === 'string') {
            output.push(vcdiff[i]);
        }
      }

      return output.join('');
    }
  },
  'context': {
    regex: /^@@ -\d+,\d+ \+\d+,\d+ @@$/m,
    /*
     * Applies context patch. Taken from jsdiff. :D
     */
    patch: function (oldStr, patch) {
      var diffstr = patch.split('\n');
      var diff = [];
      var remEOFNL = false,
          addEOFNL = false;

      // i = 4 in order to skip diff headers.
      for (var i = 4; i < diffstr.length; i++) {
        if(diffstr[i][0] === '@') {
          var meh = diffstr[i].split(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
          diff.unshift({
            start:meh[3],
            oldlength:meh[2],
            oldlines:[],
            newlength:meh[4],
            newlines:[]
          });
        } else if(diffstr[i][0] === '+') {
          diff[0].newlines.push(diffstr[i].substr(1));
        } else if(diffstr[i][0] === '-') {
          diff[0].oldlines.push(diffstr[i].substr(1));
        } else if(diffstr[i][0] === ' ') {
          diff[0].newlines.push(diffstr[i].substr(1));
          diff[0].oldlines.push(diffstr[i].substr(1));
        } else if(diffstr[i][0] === '\\') {
          if (diffstr[i-1][0] === '+') {
            remEOFNL = true;
          } else if(diffstr[i-1][0] === '-') {
            addEOFNL = true;
          }
        }
      }

      var str = oldStr.split('\n');
      for (i = diff.length - 1; i >= 0; i--) {
        var d = diff[i];
        for (var j = 0; j < d.oldlength; j++) {
          if(str[d.start-1+j] !== d.oldlines[j]) {
            return false;
          }
        }
        Array.prototype.splice.apply(str,[d.start-1,+d.oldlength].concat(d.newlines));
      }

      if (remEOFNL) {
        while (!str[str.length-1]) {
          str.pop();
        }
      } else if (addEOFNL) {
        str.push('');
      }
      return str.join('\n');
    }
  }
};

/**
 * Replace the `add` function with a version that can detect contextual
 * diffs and apply patches before storing in the browser and evaluating.
 * @override add
 */
var oldAdd = dynoSrc.add;
dynoSrc.add = function add (name, version, src, andEval) {
  var srcToAdd = src;

  for (var k in patchers) {
    if (patchers[k].regex.test(src)) {
      srcToAdd = patchers[k].patch(this.storage.get(name) || '', src);
      break;
    }
  }

  return oldAdd.call(this, name, version, srcToAdd, andEval);
};

})(window.dynoSrc);
