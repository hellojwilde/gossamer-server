let fs = require('fs');
let gunzip = require('gunzip-maybe');
let request = require('request');
let tar = require('tar-stream');

let Promise = require('bluebird');

function fetchGitHubArchive(archiveUrl, fileSystem) {
  return new Promise(function(resolve, reject) {
    let extract = tar.extract();
    let filePaths = [];

    extract.on('entry', function(header, stream, next) {
      if (header.type !== 'file') {
        stream.resume();
        next();
        return;
      }

      // Strip the top level directory from the tar that GitHub creates
      let filePath = header.name.split('/').slice(1).join('/');
      let writeStream = fileSystem.createWriteStream(filePath);

      filePaths.push(filePath);
      stream.pipe(writeStream);
      writeStream.on('finish', next);
    });

    extract.on('finish', () => resolve(filePaths));

    request(archiveUrl)
      .pipe(gunzip())
      .pipe(extract);
  });
}

module.exports = fetchGitHubArchive;