var config = require('../config');
var fs = require('fs');
var gunzip = require('gunzip-maybe');
var mkdirp = require('mkdirp');
var path = require('path');
var request = require('request');
var tar = require('tar-stream');
var exec = require('child_process').exec;
var replaceStream = require('replacestream');

var Promise = require('bluebird');

function fetchGithubArchiveAndDeploy(expId, buildId, archiveUrl, apiBaseUrl) {
  var buildPath = path.join(config.buildsPath, expId, ''+buildId);
  var extract = tar.extract();

  var filesPromise = new Promise(function(resolve, reject) {
    extract.on('entry', function(header, stream, next) {
      var partialPath = header.name.split(path.sep).slice(1).join(path.sep);
      var fullBuildPath = path.join(buildPath, partialPath);

      if (header.type === 'directory') {
        mkdirp(fullBuildPath, function(err) {
          if (err) { reject(); }
          next();
        });
      } else if (partialPath === 'main.js') {
        stream
          .pipe(replaceStream(
            '{/* INJECTED_UPDATER_INFO */}',
            JSON.stringify({
              latestBuildUrl: apiBaseUrl + '/api/v1/my/latest',
              buildId: [expId, buildId].join('/')
            })
          ))
          .pipe(fs.createWriteStream(fullBuildPath));

        next();
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

  return filesPromise.then(function() {
    return Promise.promisify(exec)('npm install', {cwd: buildPath});
  });
}

module.exports = fetchGithubArchiveAndDeploy;