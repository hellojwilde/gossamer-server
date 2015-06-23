let fs = require('fs');
let gunzip = require('gunzip-maybe');
let mkdirp = require('mkdirp');
let path = require('path');
let request = require('request');
let tar = require('tar-stream');
let replaceStream = require('replacestream');

let Promise = require('bluebird');

function fetchArchiveAndShip(registry, expId, buildId, archiveUrl) {
  let extract = tar.extract();
  
  return new Promise(function(resolve, reject) {
    extract.on('entry', function(header, stream, next) {
      if (header.type !== 'file') {
        stream.resume();
        next();
        return;
      }

      // strip the top level directory from the tar that github creates
      let filePath = header.name.split('/').slice(1).join('/');
      let writeStream = registry.model
        .getExpBuildWritableStream(expId, buildId, filePath)
        .on('finish', next);

      if (filePath === 'main.js') {
        stream
          .pipe(replaceStream(
            '{/* INJECTED_UPDATER_INFO */}',
            JSON.stringify({
              latestBuildIdUrl: registry.config.publicUrl + '/api/v1/my/latest',
              buildId: [expId, buildId].join('/')
            })
          ))
          .pipe(writeStream);
      } else {
        stream.pipe(writeStream);
      }
    });

    extract.on('finish', resolve);

    request(archiveUrl)
      .pipe(gunzip())
      .pipe(extract);
  });
}

module.exports = fetchArchiveAndShip;