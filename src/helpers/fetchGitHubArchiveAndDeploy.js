let fs = require('fs');
let gunzip = require('gunzip-maybe');
let mkdirp = require('mkdirp');
let path = require('path');
let request = require('request');
let tar = require('tar-stream');
let exec = require('child_process').exec;
let replaceStream = require('replacestream');

let Promise = require('bluebird');

function fetchGitHubArchiveAndDeploy(config, expId, buildId, archiveUrl) {
  let buildPath = path.join(config.buildsPath, expId, ''+buildId);
  let extract = tar.extract();
  
  let filesPromise = new Promise(function(resolve, reject) {
    extract.on('entry', function(header, stream, next) {
      let partialPath = header.name.split(path.sep).slice(1).join(path.sep);
      let fullBuildPath = path.join(buildPath, partialPath);

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
              latestBuildIdUrl: config.publicUrl + '/api/v1/my/latest',
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

module.exports = fetchGitHubArchiveAndDeploy;