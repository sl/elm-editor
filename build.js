var fs = require('fs');
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
}).catch(function(err) {
  console.error(err);
});
