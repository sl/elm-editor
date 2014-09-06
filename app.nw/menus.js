(function() {
  'use strict';

  var fs = require('fs');
  var gui = require('nw.gui');

  var win = gui.Window.get();
  var isMac = process.platform === 'darwin';
  var input = document.getElementById('input');
  var output = top.output;

  var currentWin = win;
  function focusWin(w) {
    currentWin = w;
    backMenuItem.enabled =
    forwardMenuItem.enabled = w === docWin;
  }

  var filePath = '';
  var fileContents = '';

  function setPath(path) {
    filePath = path;
    // win.title = (path || 'Untitled') + ' \u2014 Elm';
    win.title = path || 'Untitled';
  }

  function contents() {
    editor.save();
    return ('\ufeff' + input.value).slice(1);
  }
  function setContents(contents) {
    fileContents = contents;
    editor.setValue(contents);
    if (contents) {
      compile();
    } else {
      output.location = 'http://elm-lang.org/compile?input=main%20%3D%20plainText%20%22%22';
      clearTimeout(delay);
    }
  }

  function shouldClose() {
    return fileContents === contents() || confirm('Close without saving?');
  }

  function save() {
    var source = contents();
    fs.writeFile(filePath, source, {encoding: 'utf-8'}, function(err) {
      if (!err) fileContents = source;
    });
  }

  function saveAs() {
    var dialog = document.createElement('input');
    dialog.type = 'file';
    dialog.accept = '.elm';
    dialog.nwsaveas = 'untitled.elm';
    dialog.onchange = function() {
      setPath(dialog.files[0].path);
      save();
    };
    dialog.click();
  }

  function open(path) {
    console.log(path);
    setPath(path);
    setTimeout(function() {
      var data = fs.readFileSync(path, {encoding: 'utf8'});
      setContents(data);
    });
  }

  var docWin;
  function showDocs(url) {
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
    focusWin(docWin);
    docWin.on('close', function() {
      docWin.hide();
      // docWin = null;
      // this.close(true);
    });
    docWin.on('focus', function() {
      focusWin(docWin);
    });
  }
  document.getElementById('documentation').addEventListener('click', function(e) {
    var t = e.target;
    while (t) {
      if (t.tagName === 'A') {
        e.preventDefault();
        showDocs(t.href.replace(/^file:\/\//, 'http://elm-lang.org'));
        return;
      }
      t = t.parentNode;
    }
  });

  win.on('close', function() {
    if (!shouldClose()) return;
    if (docWin) docWin.close(true);
    this.close(true);
  });
  win.on('focus', function() {
    focusWin(win);
  });

  var mb = new gui.Menu({type: 'menubar'});
  mb.createMacBuiltin('Elm');

  var fileMenu = new gui.Menu;
  fileMenu.append(new gui.MenuItem({
    label: 'New',
    key: 'n',
    click: function() {
      if (!shouldClose()) return;
      setPath('');
      setContents('');
    }
  }));
  fileMenu.append(new gui.MenuItem({
    label: 'Open\u2026',
    key: 'o',
    click: function() {
      if (!shouldClose()) return;
      var dialog = document.createElement('input');
      dialog.type = 'file';
      dialog.accept = '.elm';
      dialog.onchange = function() {
        var path = dialog.files[0].path;
        open(path);
      };
      dialog.click();
    }
  }));
  fileMenu.append(new gui.MenuItem({
    label: 'Save',
    key: 's',
    click: function() {
      if (filePath) {
        save();
      } else {
        saveAs();
      }
    }
  }));
  fileMenu.append(new gui.MenuItem({
    label: 'Save As\u2026',
    key: 'S',
    click: function() {
      saveAs();
    }
  }));
  mb.insert(new gui.MenuItem({label: 'File', submenu: fileMenu}), isMac ? 1 : 0);

  var viewMenu = new gui.Menu;
  var fullScreenMenuItem = new gui.MenuItem({
    label: 'Enter Full Screen',
    key: 'f',
    modifiers: 'cmd-ctrl',
    click: function() {
      win.isFullscreen = !win.isFullscreen;
      fullScreenMenuItem.label = win.isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen';
    }
  })
  viewMenu.append(fullScreenMenuItem);
  viewMenu.append(new gui.MenuItem({type: 'separator'}));
  var backMenuItem = new gui.MenuItem({
    label: 'Back',
    // NSLeftArrowFunctionKey
    key: isMac ? '\uf702' : 'LEFT',
    modifiers: isMac ? 'ctrl-cmd' : 'alt',
    enabled: false,
    click: function() {
      if (currentWin === docWin) docWin.window.history.go(-1);
    }
  });
  var forwardMenuItem = new gui.MenuItem({
    label: 'Forward',
    // NSRightArrowFunctionKey
    key: isMac ? '\uf703' : 'RIGHT',
    modifiers: isMac ? 'ctrl-cmd' : 'alt',
    enabled: false,
    click: function() {
      if (currentWin === docWin) docWin.window.history.go(1);
    }
  });
  viewMenu.append(backMenuItem);
  viewMenu.append(forwardMenuItem);
  viewMenu.append(new gui.MenuItem({type: 'separator'}));
  viewMenu.append(new gui.MenuItem({
    label: 'Show Developer Tools',
    key: 'i',
    modifiers: isMac ? 'cmd-alt' : 'ctrl-shift',
    click: function() {
      currentWin.showDevTools();
    }
  }));

  mb.insert(new gui.MenuItem({label: 'View', submenu: viewMenu}), isMac ? 3 : 1);

  if (isMac) {
    var windowMenu = mb.items[4].submenu;
    windowMenu.remove(windowMenu.items[1]);
    var isZoomed = false;
    windowMenu.insert(new gui.MenuItem({
      label: 'Zoom',
      selector: 'performZoom:'
    }), 1);
    fileMenu.append(new gui.MenuItem({type: 'separator'}));
    fileMenu.append(new gui.MenuItem({
      label: 'Close',
      key: 'w',
      selector: 'performClose:'
    }));
  }
  var helpMenu = new gui.Menu;
  mb.append(new gui.MenuItem({label: 'Help', submenu: helpMenu}));
  helpMenu.append(new gui.MenuItem({
    label: 'Documentation',
    key: 'D',
    click: function() {
      showDocs('http://elm-lang.org/Learn.elm');
    }
  }));
  helpMenu.append(new gui.MenuItem({
    label: 'Standard Libraries',
    key: 'L',
    click: function() {
      showDocs('http://library.elm-lang.org/catalog/elm-lang-Elm/0.12.3/');
    }
  }));

  win.menu = mb;

}());
