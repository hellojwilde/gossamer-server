var config = require('../config');
var fs = require('fs');
var gunzip = require('gunzip-maybe');
var mkdirp = require('mkdirp');
var path = require('path');
var request = require('request');
var tar = require('tar-stream');

var Promise = require('bluebird');

function fetchGithubArchiveAndDeploy(expId, buildId, archiveUrl) {
  var buildPath = path.join(config.buildsPath, expId, ''+buildId);
  var extract = tar.extract();

  return new Promise(function(resolve, reject) {
    extract.on('entry', function(header, stream, next) {
      var partialPath = header.name.split(path.sep).slice(1).join(path.sep);
      var fullBuildPath = path.join(buildPath, partialPath);

      if (header.type === 'directory') {
        mkdirp(fullBuildPath, function(err) {
          if (err) { reject(); }
          next();
        });
      } else {
        stream.pipe(fs.createWriteStream(fullBuildPath));
        next();
      }
    });

    extract.on('finish', resolve);

    request(archiveUrl)
      .pipe(gunzip())
      .pipe(extract);
  }); 
}

module.exports = fetchGithubArchiveAndDeploy;