(function() {
  'use strict';

  var gui = top.require('nw.gui');
  var docWin;
  document.getElementById('documentation').addEventListener('click', function(e) {
    var t = e.target;
    while (t) {
      if (t.tagName === 'A') {
        e.preventDefault();
        var url = t.href.replace(/^file:\/\//, 'http://elm-lang.org');
        if (docWin) {
          docWin.window.location = url;
          docWin.show();
          docWin.focus();
          return;
        }
        docWin = gui.Window.open(url, {
          position: 'center',
          focus: true,
          width: 960,
          height: 720
        });
        docWin.on('close', function() {
          docWin = null;
          this.close(true);
        });
        return;
      }
      t = t.parentNode;
    }
  });

}());
