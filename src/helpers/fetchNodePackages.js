const fs = require('fs');
const npm = require('npm');
const path = require('path');
const tmp = require('tmp');

const Promise = require('bluebird');

const fsWriteFilePromise = Promise.promisify(fs.writeFile);
const tmpDirPromise = Promise.promisify(tmp.dir);
const npmLoadPromise = Promise.promisify(npm.load);
const readdirPromise = Promise.promisify(require('recursive-readdir'));

async function fetchNodePackages(configObject, fileSystem) {
  let [prefix, cleanupCallback] = await tmpDirPromise({unsafeCleanup: true});

  // Load our configuration and call the install command.
  await fsWriteFilePromise(path.join(prefix, 'package.json'), JSON.stringify(configObject));
  await npmLoadPromise({production: true, global: false});
  npm.prefix = prefix;
  await Promise.promisify(npm.commands.install)();

  // Copy the temporary files that we just installed into a bucket.
  let modulesPrefix = path.join(prefix, 'node_modules');
  await Promise.each(readdirPromise(modulesPrefix), (filePath) => {
    return new Promise((resolve, reject) => {
      let localFilePath = path.relative(modulesPrefix, filePath);
      let localWriteStream = fileSystem.createWriteStream(localFilePath);

      localWriteStream.on('finish', resolve);
      fs.createReadStream(filePath).pipe(localWriteStream);
    });
  });
  
  // XXX this currently fails...need to figure out where the bug in node-tmp
  // cleanupCallback();
}

module.exports = fetchNodePackages;