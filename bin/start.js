#!/usr/bin/env node

var child = require('child_process');
var path = require('path');

var app = child.spawn('/Applications/B2G.app/Contents/MacOS/graphene', [
  '--profile', './.profile', '--start-manifest=http://localhost:3000/my/manifest.webapp'
], {
  stdio: 'inherit',
  uid: process.getuid(),
  gid: process.getgid()
});

var exit = function(code) {
  app.kill();
  process.exit(code);
}

process.on('SIGINT', exit);
app.on('close', exit);