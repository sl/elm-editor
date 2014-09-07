var fs = require('fs');
var exec = require('child_process').exec;
var NwBuilder = require('node-webkit-builder');

var nw = new NwBuilder({
  files: './app.nw/**/**',
  platforms: ['win', 'osx'],
  macIcns: 'resources/Elm.icns',
  macPlist: 'resources/Info.plist',
  winIco: 'resources/Elm.ico'
});

nw.on('log',  console.log);

nw.build().then(function() {
  fs.createReadStream('resources/ElmDocument.icns').pipe(fs.createWriteStream('build/Elm/osx/Elm.app/Contents/Resources/file.icns'));
  if (process.platform === 'darwin') {
    exec('cd build/Elm/win; rm -f ../../Elm-win.zip; zip -r ../../Elm-win.zip *');
    exec('cd build/Elm/osx; rm -f ../../Elm-mac.zip; zip -r ../../Elm-mac.zip Elm.app/*');
  }
}).catch(function(err) {
  console.error(err);
});
