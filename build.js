var NwBuilder = require('node-webkit-builder');
var nw = new NwBuilder({
  files: './app.nw/**/**', // use the glob format
  platforms: ['win', 'osx'],
  macIcns: 'resources/Elm.icns',
  winIco: 'resources/Elm.ico'
});

// Log stuff you want
nw.on('log',  console.log);

// Build returns a promise
nw.build().catch(function(err) {
  console.error(err);
});
