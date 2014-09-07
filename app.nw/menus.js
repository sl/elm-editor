(function() {
  'use strict';

  var fs = require('fs');
  var gui = require('nw.gui');

  var win = gui.Window.get();
  var isMac = process.platform === 'darwin';
  var input = document.getElementById('input');
  var output = top.output;

  var currentWin = win;
  function focusWin(w, initDoc) {
    currentWin = w;
    backMenuItem.enabled =
    forwardMenuItem.enabled = w === docWin;
    updateFullScreenLabel(initDoc);
  }

  function updateFullScreenLabel(initDoc) {
    fullScreenMenuItem.label = !initDoc && currentWin.isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen';
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
    clearTimeout(delay);
    if (contents) {
      compile();
    } else {
      output.location = 'http://elm-lang.org/compile?input=main%20%3D%20plainText%20%22%22';
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
      icon: 'logo.png',
      focus: true,
      width: 960,
      height: 720
    });

    if (!isMac) {
      var mb = new gui.Menu({type: 'menubar'});

      var fileMenu = new gui.Menu;
      fileMenu.append(new gui.MenuItem({
        label: 'Close Window',
        key: 'W',
        modifiers: 'ctrl',
        click: function() {
          docWin.close();
        }
      }));
      mb.append(new gui.MenuItem({label: 'File', submenu: fileMenu}));

      var viewMenu = new gui.Menu;
      viewMenu.append(backMenuItem);
      viewMenu.append(forwardMenuItem);
      viewMenu.append(new gui.MenuItem({type: 'separator'}));
      viewMenu.append(new gui.MenuItem({
        label: 'Show Developer Tools',
        key: 'I',
        modifiers: 'ctrl-shift',
        click: function() {
          docWin.showDevTools();
        }
      }));
      mb.append(new gui.MenuItem({label: 'View', submenu: viewMenu}));

      var goMenu = new gui.Menu;
      addDocumentationItems(goMenu);
      mb.append(new gui.MenuItem({label: 'Go', submenu: goMenu}));

      docWin.menu = mb;
    }

    focusWin(docWin, true);
    docWin.on('close', function() {
      docWin.hide();
      win.focus();
      // docWin = null;
      // this.close(true);
    });
    docWin.on('focus', function() {
      focusWin(docWin);
    });
  }

  function addDocumentationItems(menu) {
    menu.append(new gui.MenuItem({
      label: 'Documentation',
      key: 'D',
      modifiers: isMac ? 'cmd-shift' : 'ctrl-shift',
      click: function() {
        showDocs('http://elm-lang.org/Learn.elm');
      }
    }));
    menu.append(new gui.MenuItem({
      label: 'Standard Libraries',
      key: 'L',
      modifiers: isMac ? 'cmd-shift' : 'ctrl-shift',
      click: function() {
        showDocs('http://library.elm-lang.org/catalog/elm-lang-Elm/0.12.3/');
      }
    }));
  }

  document.getElementById('documentation').addEventListener('click', function(e) {
    var t = e.target;
    while (t) {
      if (t.tagName === 'A') {
        if (!/^javascript:/.test(t.href)) {
          e.preventDefault();
          showDocs(t.href.replace(/^file:\/\//, 'http://elm-lang.org'));
        }
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
  if (isMac) {
    mb.createMacBuiltin('Elm');
  }

  var fileMenu = new gui.Menu;
  fileMenu.append(new gui.MenuItem({
    label: 'New',
    key: isMac ? 'n' : 'N',
    modifiers: isMac ? '' : 'ctrl',
    click: function() {
      if (!shouldClose()) return;
      setPath('');
      setContents('');
    }
  }));
  fileMenu.append(new gui.MenuItem({
    label: 'Open\u2026',
    key: isMac ? 'o' : 'O',
    modifiers: isMac ? '' : 'ctrl',
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
    key: isMac ? 's' : 'S',
    modifiers: isMac ? '' : 'ctrl',
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
    modifiers: isMac ? '' : 'ctrl-shift',
    click: function() {
      saveAs();
    }
  }));
  var fileMenuItem = new gui.MenuItem({label: 'File', submenu: fileMenu});
  if (isMac) {
    mb.insert(fileMenuItem, 1);
  } else {
    mb.append(fileMenuItem);
  }

  var viewMenu = new gui.Menu;
  var fullScreenMenuItem = new gui.MenuItem({
    label: 'Enter Full Screen',
    key: isMac ? 'f' : 'F11',
    modifiers: isMac ? 'cmd-ctrl' : '',
    click: function() {
      currentWin.isFullscreen = !currentWin.isFullscreen;
      updateFullScreenLabel();
    }
  });
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
  if (isMac) {
    viewMenu.append(backMenuItem);
    viewMenu.append(forwardMenuItem);
    viewMenu.append(new gui.MenuItem({type: 'separator'}));
  }
  viewMenu.append(new gui.MenuItem({
    label: 'Show Developer Tools',
    key: 'i',
    modifiers: isMac ? 'cmd-alt' : 'ctrl-shift',
    click: function() {
      currentWin.showDevTools();
    }
  }));
  var viewMenuItem = new gui.MenuItem({label: 'View', submenu: viewMenu});
  if (isMac) {
    mb.insert(viewMenuItem, 3);
  } else {
    mb.append(viewMenuItem);
  }

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
  } else {
    fileMenu.append(new gui.MenuItem({type: 'separator'}));
    fileMenu.append(new gui.MenuItem({
      label: 'Quit',
      key: 'Q',
      modifiers: 'ctrl',
      click: function() {
        win.close();
      }
    }));
  }
  var helpMenu = new gui.Menu;
  mb.append(new gui.MenuItem({label: 'Help', submenu: helpMenu}));
  addDocumentationItems(helpMenu);

  win.menu = mb;

}());
