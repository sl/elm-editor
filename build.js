var NwBuilder = require('node-webkit-builder');
var nw = new NwBuilder({
  files: './app.nw/**/**',
  platforms: ['win', 'osx'],
  macIcns: 'resources/Elm.icns',
  winIco: 'resources/Elm.ico'
});

nw.on('log',  console.log);

nw.build().catch(function(err) {
  console.error(err);
});
