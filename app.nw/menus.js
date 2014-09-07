(function() {
  'use strict';

  var require = top.require;
  var process = top.process;

  var fs = require('fs');
  var gui = require('nw.gui');

  var win = gui.Window.get();
  var main = top.ElmEditorMain || win;
  var isMain = win.id === 1;
  var windows = isMain ? [win] : null;
  var editorWindows = isMain ? [win] : null;

  var isMac = process.platform === 'darwin';
  var input = document.getElementById('input');
  var output = top.output;

  var currentWin = win;
  function focusWin(w, initDoc) {
    currentWin = w;
    if (isMac && isMain) {
      backMenuItem.enabled =
      forwardMenuItem.enabled = w && w === docWin;
      saveMenuItem.enabled =
      saveAsMenuItem.enabled = w && w !== docWin;
      closeMenuItem.enabled =
      showDevToolsMenuItem.enabled =
      zoomMenuItem.enabled =
      minimizeMenuItem.enabled = w;
    }
    updateFullScreenLabel(initDoc);
  }

  function updateFullScreenLabel(initDoc) {
    if (isMac) fullScreenMenuItem.enabled = !!currentWin;
    fullScreenMenuItem.label = !initDoc && currentWin && currentWin.isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen';
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

  function openWindow(path) {
      var win = gui.Window.open('main.html', {
        title: 'Untitled',
        icon: 'logo.png',
        focus: true,
        toolbar: false,
        width: 960,
        height: 640
      });
      windows.push(win);
      editorWindows.push(win);
      focusWin(win, true);
      win.on('focus', function() {
        focusWin(win);
      });
      win.on('close', function() {
        if (!win.window.ElmEditor.shouldClose()) return;
        win.close(true);
        windows.splice(windows.indexOf(win), 1);
        editorWindows.splice(editorWindows.indexOf(win), 1);
        if (!windows.length) focusWin(null);
      });
      win.once('document-start', function() {
        win.window.ElmEditorMain = main;
      });
      if (path) {
        win.once('loaded', function() {
          win.window.ElmEditor.open(path);
        });
      }
      return win;
    }

  top.ElmEditor = {
    openDialog: function() {
      var dialog = document.createElement('input');
      dialog.type = 'file';
      dialog.accept = '.elm';
      dialog.onchange = function() {
        var path = dialog.files[0].path;
        if (contents() || filePath) {
          openWindow(path);
        } else {
          open(path);
        }
      };
      dialog.click();
    },
    save: function() {
      if (filePath) {
        save();
      } else {
        saveAs();
      }
    },
    saveAs: function() {
      saveAs();
    },
    quit: function() {
      for (var i = editorWindows.length; i--;) {
        if (!editorWindows[i].window.ElmEditor.shouldClose()) return;
      }
      process.exit(0);
    },
    getEditor: function() {
      return new Promise(function(resolve, reject) {
        if (currentWin && currentWin !== docWin) return resolve(currentWin);
        if (editorWindows.length) return resolve(editorWindows[0]);
        var w = openWindow();
        w.once('loaded', function() {
          resolve(w);
        });
      });
    },
    shouldClose: shouldClose,
    openWindow: openWindow,
    open: open,
    showDocs: showDocs
  };

  var docWin;
  function showDocs(url) {
    if (docWin) {
      docWin.window.location = url;
      if (windows.indexOf(docWin) === -1) {
        docWin.show();
        windows.push(docWin);
      }
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
        // label: 'Close Window',
        label: 'Close',
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

    windows.push(docWin);
    focusWin(docWin, true);
    docWin.on('close', function() {
      docWin.hide();
      docWin.closeDevTools();
      windows.splice(windows.indexOf(docWin), 1);
      if (windows.length) {
        windows[0].focus();
      } else {
        focusWin(null);
      }
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
        main.window.ElmEditor.showDocs('http://elm-lang.org/Learn.elm');
      }
    }));
    menu.append(new gui.MenuItem({
      label: 'Standard Libraries',
      key: 'L',
      modifiers: isMac ? 'cmd-shift' : 'ctrl-shift',
      click: function() {
        main.window.ElmEditor.showDocs('http://library.elm-lang.org/catalog/elm-lang-Elm/0.12.3/');
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

  if (isMain) {
    win.on('close', function() {
      if (!shouldClose()) return;
      win.hide();
      win.closeDevTools();
      windows.splice(windows.indexOf(win), 1);
      editorWindows.splice(editorWindows.indexOf(win), 1);
      focusWin(windows[0]);
    });
    win.on('focus', function() {
      focusWin(win);
    });
  }

  if (isMain || !isMac) {
    var mb = new gui.Menu({type: 'menubar'});
    if (isMac) {
      mb.createMacBuiltin('Elm');
      var appMenu = mb.items[0].submenu;
      appMenu.remove(appMenu.items[6]);
      appMenu.append(new gui.MenuItem({
        label: nwDispatcher.getNSStringFWithFixup('IDS_EXIT_MAC', 'Elm'),
        key: 'q',
        click: function() {
          main.window.ElmEditor.quit();
        }
      }));
    }

    var fileMenu = new gui.Menu;
    fileMenu.append(new gui.MenuItem({
      label: 'New',
      key: isMac ? 'n' : 'N',
      modifiers: isMac ? 'cmd' : 'ctrl',
      click: function() {
        main.window.ElmEditor.openWindow();
      }
    }));
    fileMenu.append(new gui.MenuItem({
      label: 'Open\u2026',
      key: isMac ? 'o' : 'O',
      modifiers: isMac ? 'cmd' : 'ctrl',
      click: function() {
        main.window.ElmEditor.getEditor().then(function(editor) {
          editor.window.ElmEditor.openDialog();
        });
      }
    }));
    var saveMenuItem = new gui.MenuItem({
      label: 'Save',
      key: isMac ? 's' : 'S',
      modifiers: isMac ? 'cmd' : 'ctrl',
      click: function() {
        currentWin.window.ElmEditor.save();
      }
    });
    fileMenu.append(saveMenuItem);
    var saveAsMenuItem = new gui.MenuItem({
      label: 'Save As\u2026',
      key: 'S',
      modifiers: isMac ? 'cmd' : 'ctrl-shift',
      click: function() {
        currentWin.window.ElmEditor.saveAs();
      }
    });
    fileMenu.append(saveAsMenuItem);
    fileMenu.append(new gui.MenuItem({type: 'separator'}));
    // fileMenu.append(new gui.MenuItem({
    //   label: 'New Window',
    //   key: isMac ? 'n' : 'N',
    //   modifiers: isMac ? 'cmd-shift' : 'ctrl-shift',
    //   click: function() {
    //     main.window.ElmEditor.openWindow();
    //   }
    // }));
    if (isMac) {
      var closeMenuItem = new gui.MenuItem({
        // label: 'Close Window',
        label: 'Close',
        key: 'w',
        selector: 'performClose:'
      });
      fileMenu.append(closeMenuItem);
    } else {
      fileMenu.append(new gui.MenuItem({
        // label: 'Close Window',
        label: 'Close',
        key: 'W',
        modifiers: 'ctrl',
        click: function() {
          win.close();
        }
      }));
      fileMenu.append(new gui.MenuItem({
        label: 'Quit',
        key: 'Q',
        modifiers: 'ctrl',
        click: function() {
          main.window.ElmEditor.quit();
        }
      }));
    }
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
    var showDevToolsMenuItem = new gui.MenuItem({
      label: 'Show Developer Tools',
      key: 'i',
      modifiers: isMac ? 'cmd-alt' : 'ctrl-shift',
      click: function() {
        currentWin.showDevTools();
      }
    });
    viewMenu.append(showDevToolsMenuItem);
    var viewMenuItem = new gui.MenuItem({label: 'View', submenu: viewMenu});
    if (isMac) {
      mb.insert(viewMenuItem, 3);
    } else {
      mb.append(viewMenuItem);
    }

    if (isMac) {
      var windowMenu = mb.items[4].submenu;
      var minimizeMenuItem = windowMenu.items[0];
      windowMenu.remove(windowMenu.items[1]);
      var zoomMenuItem = new gui.MenuItem({
        label: 'Zoom',
        selector: 'performZoom:'
      });
      windowMenu.insert(zoomMenuItem, 1);
    }

    var helpMenu = new gui.Menu;
    mb.append(new gui.MenuItem({label: 'Help', submenu: helpMenu}));
    addDocumentationItems(helpMenu);

    win.menu = mb;
  }

  if (isMain) {
    var argv = gui.App.argv;
    if (argv.length) {
      open(argv[0]);
      for (var i = 1, l = argv.length; i < l; i++) {
        openWindow(argv[i]);
      }
    }

    gui.App.on('open', function(file) {
      openWindow(file);
    });
  }

}());
