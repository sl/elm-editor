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

  var currentWin = win;
  function focusWin(w, init, initDoc) {
    currentWin = w;
    if (!w && !isMac) {
      process.exit(0);
    }
    if (isMac) {
      backMenuItem.enabled =
      forwardMenuItem.enabled = w && w === docWin;
      saveMenuItem.enabled =
      saveAsMenuItem.enabled =
      closeFileMenuItem.enabled =
      closeAllFilesMenuItem.enabled =
      nextTabMenuItem.enabled =
      previousTabMenuItem.enabled = w && w !== docWin;
      closeMenuItem.enabled =
      showDevToolsMenuItem.enabled =
      zoomMenuItem.enabled =
      minimizeMenuItem.enabled = w;
      updateFileMenuItems(init ? !initDoc : w && w.window.ElmEditor && w.window.ElmEditor.getSelectedFile());
    }
    updateFullScreenLabel(init);
  }

  function focusOpenWin() {
    if (windows.length) {
      windows[0].focus();
    } else {
      focusWin(null);
    }
  }

  function updateFullScreenLabel(init) {
    if (isMac) fullScreenMenuItem.enabled = !!currentWin;
    fullScreenMenuItem.label = !init && currentWin && currentWin.isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen';
  }

  function updateFileMenuItems(enable) {
    compileMenuItem.enabled =
    hotSwapMenuItem.enabled = !!enable;
    if (typeof enable === 'object') {
      updateHintMenuItem(enable.hintAvailable, enable.hintVerbose);
    } else {
      updateHintMenuItem(false, false);
    }
  }

  function updateHintMenuItem(available, verbose) {
    hintMenuItem.enabled = available;
    hintMenuItem.label = available && verbose ? 'Collapse Hint' : 'Expand Hint';
  }

  function shouldClose() {
    return files.every(function(file) {
      return file.shouldClose();
    });
  }

  function updateTitle() {
    win.title = selectedFile ? selectedFile.path || 'untitled' : 'Elm';
  }

  function openWindow(path) {
    return new Promise(function(resolve, reject) {
      var win = gui.Window.open('main.html', {
        title: 'Elm',
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
      win.once('loaded', function() {
        if (path) {
          win.window.ElmEditor.addFile(path);
        }
        resolve(win);
      });
    });
  }

  function editorCommand(name) {
    return function() {
      if (currentWin && currentWin.window.ElmEditor) {
        currentWin.window.ElmEditor[name]();
      }
    };
  }

  top.ElmEditor = {
    openDialog: function() {
      var dialog = document.createElement('input');
      dialog.type = 'file';
      dialog.accept = '.elm';
      dialog.multiple = true;
      document.body.appendChild(dialog);
      dialog.onchange = function() {
        [].forEach.call(dialog.files, function(f) {
          addFile(f.path);
        });
      };
      dialog.click();
      setTimeout(function() {
        document.body.removeChild(dialog);
      });
    },
    save: function() {
      if (selectedFile) selectedFile.save();
    },
    saveAs: function() {
      if (selectedFile) selectedFile.saveAs();
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
        if (editorWindows.length) {
          editorWindows[0].focus();
          return resolve(editorWindows[0]);
        }
        resolve(openWindow());
      });
    },
    close: function() {
      if (selectedFile) {
        closeFile(selectedFile);
      } else {
        win.close();
      }
    },
    closeAll: function() {
      for (var i = files.length; i--;) {
        var f = files[i];
        closeFile(f);
        if (files.indexOf(f) !== -1) return;
      }
    },
    selectNextFile: function() {
      var i = files.indexOf(selectedFile);
      if (i === -1) return;
      selectFile(files[(i + 1) % files.length]);
    },
    selectPreviousFile: function() {
      var i = files.indexOf(selectedFile);
      if (i === -1) return;
      selectFile(files[(i + files.length - 1) % files.length]);
    },
    ensureFile: function() {
      if (!files.length) addFile();
    },
    getSelectedFile: function() {
      return selectedFile;
    },
    compile: function() {
      if (selectedFile) selectedFile.compile();
    },
    hotSwap: function() {
      if (selectedFile) selectedFile.hotSwap();
    },
    toggleVerbose: function() {
      if (selectedFile) selectedFile.toggleVerbose();
    },
    shouldClose: shouldClose,
    updateFileMenuItems: updateFileMenuItems,
    updateHintMenuItem: updateHintMenuItem,
    addFile: addFile,
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

    windows.push(docWin);
    focusWin(docWin, true, true);
    docWin.on('close', function() {
      docWin.hide();
      docWin.closeDevTools();
      windows.splice(windows.indexOf(docWin), 1);
      focusOpenWin();
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

  if (isMain) {
    win.on('close', function() {
      if (!shouldClose()) return;
      win.hide();
      win.closeDevTools();
      windows.splice(windows.indexOf(win), 1);
      editorWindows.splice(editorWindows.indexOf(win), 1);
      focusOpenWin();
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
        main.window.ElmEditor.getEditor().then(function(editor) {
          editor.window.ElmEditor.addFile();
        });
      }
    }));
    fileMenu.append(new gui.MenuItem({
      label: 'Open\u2026',
      key: isMac ? 'o' : 'O',
      modifiers: isMac ? 'cmd' : 'ctrl',
      click: function() {
        main.window.ElmEditor.getEditor().then(function(editor) {
          editor.window.ElmEditor.ensureFile();
          editor.window.ElmEditor.openDialog();
        });
      }
    }));
    var saveMenuItem = new gui.MenuItem({
      label: 'Save',
      key: isMac ? 's' : 'S',
      modifiers: isMac ? 'cmd' : 'ctrl',
      click: editorCommand('save')
    });
    fileMenu.append(saveMenuItem);
    var saveAsMenuItem = new gui.MenuItem({
      label: 'Save As\u2026',
      key: 'S',
      modifiers: isMac ? 'cmd' : 'ctrl-shift',
      click: editorCommand('saveAs')
    });
    fileMenu.append(saveAsMenuItem);
    fileMenu.append(new gui.MenuItem({type: 'separator'}));
    var closeFileMenuItem = new gui.MenuItem({
      label: 'Close File',
      key: isMac ? 'w' : 'W',
      modifiers: isMac ? 'cmd' : 'ctrl',
      click: editorCommand('close')
    });
    fileMenu.append(closeFileMenuItem);
    var closeAllFilesMenuItem = new gui.MenuItem({
      label: 'Close All Files',
      key: isMac ? 'w' : 'W',
      modifiers: isMac ? 'cmd-alt' : 'ctrl-alt',
      click: editorCommand('closeAll')
    });
    fileMenu.append(closeAllFilesMenuItem);
    fileMenu.append(new gui.MenuItem({type: 'separator'}));
    fileMenu.append(new gui.MenuItem({
      label: 'New Window',
      key: isMac ? 'n' : 'N',
      modifiers: isMac ? 'cmd-shift' : 'ctrl-shift',
      click: function() {
        main.window.ElmEditor.openWindow().then(function(editor) {
          editor.window.ElmEditor.addFile();
        });
      }
    }));
    if (isMac) {
      var closeMenuItem = new gui.MenuItem({
        label: 'Close Window',
        key: 'W',
        selector: 'performClose:'
      });
      fileMenu.append(closeMenuItem);
    } else {
      fileMenu.append(new gui.MenuItem({
        label: 'Close Window',
        key: 'W',
        modifiers: 'ctrl-shift',
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
    var hintMenuItem = new gui.MenuItem({
      label: 'Expand Hint',
      key: 'H',
      enabled: false,
      modifiers: isMac ? 'cmd-shift' : 'ctrl',
      click: editorCommand('toggleVerbose')
    });
    viewMenu.append(hintMenuItem);
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

    var nextTabMenuItem = new gui.MenuItem({
      label: 'Select Next Tab',
      key: isMac ? '}' : 'TAB',
      modifiers: isMac ? 'cmd' : 'ctrl',
      click: editorCommand('selectNextFile')
    });
    var previousTabMenuItem = new gui.MenuItem({
      label: 'Select Previous Tab',
      key: isMac ? '{' : 'TAB',
      modifiers: isMac ? 'cmd' : 'ctrl-shift',
      click: editorCommand('selectPreviousFile')
    });
    if (isMac) {
      var windowMenu = mb.items[4].submenu;
      var minimizeMenuItem = windowMenu.items[0];
      windowMenu.remove(windowMenu.items[1]);
      var zoomMenuItem = new gui.MenuItem({
        label: 'Zoom',
        selector: 'performZoom:'
      });
      windowMenu.insert(zoomMenuItem, 1);
      windowMenu.insert(nextTabMenuItem, 3);
      windowMenu.insert(previousTabMenuItem, 4);
      windowMenu.insert(new gui.MenuItem({type: 'separator'}), 5);
    }

    var projectMenu = new gui.Menu;
    var compileMenuItem = new gui.MenuItem({
      label: 'Compile',
      key: isMac ? '\r' : 'ENTER',
      modifiers: isMac ? 'cmd' : 'ctrl',
      enabled: false,
      click: editorCommand('compile')
    });
    projectMenu.append(compileMenuItem);
    var hotSwapMenuItem = new gui.MenuItem({
      label: 'Hot Swap',
      key: isMac ? '\r' : 'RETURN',
      modifiers: isMac ? 'cmd-shift' : 'ctrl-shift',
      enabled: false,
      click: editorCommand('hotSwap')
    });
    projectMenu.append(hotSwapMenuItem);
    var projectMenuItem = new gui.MenuItem({label: 'Project', submenu: projectMenu});
    if (isMac) {
      mb.insert(projectMenuItem, 4);
    } else {
      mb.append(projectMenuItem);
    }

    if (!isMac) {
      var windowMenu = new gui.Menu;
      windowMenu.append(nextTabMenuItem);
      mb.append(new gui.MenuItem({label: 'Window', submenu: windowMenu}));
    }

    var helpMenu = new gui.Menu;
    mb.append(new gui.MenuItem({label: 'Help', submenu: helpMenu}));
    addDocumentationItems(helpMenu);

    win.menu = mb;
  }

  var files = [];
  var selectedFile;

  function selectFile(file) {
    if (selectedFile) {
      selectedFile.tab.classList.remove('selected');
      selectedFile.content.style.display = 'none';
    }
    if (selectedFile = file) {
      file.tab.classList.add('selected');
      file.content.style.display = 'block';
      file.focus();
    }
    if (isMain || !isMac) {
      updateFileMenuItems(file);
    } else {
      main.window.ElmEditor.updateFileMenuItems(file);
    }
    updateTitle();
  }

  function closeFile(file, notWindow) {
    if (!file.shouldClose()) return;
    var i = files.indexOf(file);
    files.splice(i, 1);
    tabContainer.removeChild(file.tab);
    contentContainer.removeChild(file.content);
    if (file === selectedFile) {
      selectFile(files[i] || files[i - 1]);
    }
    if (!notWindow && isMac && !files.length) {
      win.close();
    }
  }

  var contentContainer = document.querySelector('.content');
  var tabContainer = document.querySelector('.tabs');
  function addFile(path) {
    if (path && files.length === 1 && !files[0].path && !files[0].getContents()) {
      closeFile(files[0], true);
    }
    var file = new File(path);
    tabContainer.appendChild(file.tab);
    contentContainer.appendChild(file.content);
    files.push(file);
    selectFile(file);
    return file;
  }

  function File(path) {
    this.tab = document.createElement('div');
    this.tab.className = 'tab';

    this.setPath(path);
    this.fileContents = '';

    this.content = document.createElement('iframe');
    this.content.src = 'tab.html';
    this.content.onload = function() {
      this.window = this.content.contentWindow.input;
      this.output = this.content.contentWindow.input.output;
      this.input = this.window.document.getElementById('input');
      this.editor = this.window.editor;

      this.editorFocused = true;
      this.editor.display.input.addEventListener('blur', this.onEditorFocus.bind(this));
      this.editor.display.input.addEventListener('focus', this.onEditorBlur.bind(this));

      this.window.document.getElementById('documentation').addEventListener('click', this.onDocumentationClick);
      this.window.updateHint = this.updateHint.bind(this);

      if (path) {
        var data = fs.readFileSync(path, {encoding: 'utf8'});
        this.setContents(data);
      }
    }.bind(this);
  }

  File.prototype.hideCursor = function() {
    this.editor.display.wrapper.classList.remove('CodeMirror-focused');
  };

  File.prototype.showCursor = function() {
    this.editor.display.wrapper.classList.add('CodeMirror-focused');
  };

  File.prototype.focus = function() {
    if (this.editor) this.editor.focus();
  };

  File.prototype.windowFocus = function() {
    if (this.editorFocused) this.showCursor();
  };

  File.prototype.onEditorFocus = function() {
    this.editorFocused = false;
    this.hideCursor();
  };

  File.prototype.onEditorBlur = function() {
    this.editorFocused = true;
    this.showCursor();
  };

  File.prototype.onDocumentationClick = function(e) {
    var t = e.target;
    while (t) {
      if (t.tagName === 'A') {
        if (!/^javascript:/.test(t.href)) {
          e.preventDefault();
          main.window.ElmEditor.showDocs(t.href.replace(/^file:\/\//, 'http://elm-lang.org'));
        }
        return;
      }
      t = t.parentNode;
    }
  };

  File.prototype.updateHint = function(available, verbose) {
    this.hintAvailable = !!available;
    this.hintVerbose = !!verbose;
    if (isMac) {
      main.window.ElmEditor.updateHintMenuItem(this.hintAvailable, this.hintVerbose);
    } else {
      updateHintMenuItem(this.hintAvailable, this.hintVerbose);
    }
  };

  File.prototype.compile = function() {
    if (this.window.compile) this.window.compile();
  };

  File.prototype.hotSwap = function() {
    if (this.window.hotSwap) this.window.hotSwap();
  };

  File.prototype.toggleVerbose = function() {
    if (this.window.toggleVerbose) this.window.toggleVerbose();
  }

  File.prototype.save = function() {
    if (this.path) {
      this.write();
    } else {
      this.saveAs();
    }
  };

  File.prototype.saveAs = function() {
    var dialog = document.createElement('input');
    dialog.type = 'file';
    dialog.accept = '.elm';
    dialog.nwsaveas = 'untitled.elm';
    document.body.appendChild(dialog);
    dialog.onchange = function() {
      this.setPath(dialog.files[0].path);
      updateTitle();
      this.write();
    }.bind(this);
    dialog.click();
    setTimeout(function() {
      document.body.removeChild(dialog);
    });
  };

  File.prototype.write = function() {
    var source = this.getContents();
    fs.writeFile(this.path, source, {encoding: 'utf-8'}, function(err) {
      if (!err) this.fileContents = source;
    }.bind(this));
  };

  File.prototype.setPath = function(path) {
    this.path = path || '';
    this.displayName = path ? path.split('/').pop() : 'untitled';
    this.displayPath = path || 'untitled';

    this.tab.textContent = this.displayName;
    this.tab.title = this.path;
  };

  File.prototype.shouldClose = function() {
    return this.fileContents === this.getContents() || confirm('Close "' + this.displayName + '" without saving?');
  };

  File.prototype.getContents = function() {
    if (!this.editor) return '';
    this.editor.save();
    return ('\ufeff' + this.input.value).slice(1);
  };

  File.prototype.setContents = function(contents) {
    this.fileContents = contents;
    this.editor.setValue(contents);
    this.window.clearTimeout(this.window.delay);
    if (contents) {
      this.window.compile();
    } else {
      this.output.location = 'http://elm-lang.org/compile?input=main%20%3D%20plainText%20%22%22';
    }
  };

  tabContainer.addEventListener('click', function(e) {
    if (!e.target.classList.contains('tab')) return;
    var i = [].indexOf.call(tabContainer.children, e.target);
    if (i === -1) return;
    selectFile(files[i]);
  });

  if (isMain) {
    var argv = gui.App.argv;
    if (argv.length) {
      addFile(argv[0]);
      for (var i = 1, l = argv.length; i < l; i++) {
        addFile(argv[i]);
      }
    } else {
      addFile();
    }

    gui.App.on('open', function(file) {
      getEditor().then(function(editor) {
        editor.window.ElmEditor.addFile(file);
      });
    });
  }

  win.on('focus', function() {
    if (selectedFile) selectedFile.windowFocus();
    document.body.classList.add('focused');
  });
  win.on('blur', function() {
    if (selectedFile) selectedFile.hideCursor();
    document.body.classList.remove('focused');
  });

}());
