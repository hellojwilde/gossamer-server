const Promise = require('bluebird');

const fs = Promise.promisifyAll(require('fs'));
const npm = Promise.promisifyAll(require('npm'));
const path = require('path');
const tmp = Promise.promisifyAll(require('tmp'));
const readdirRecursiveAsync = Promise.promisify(require('recursive-readdir'));

async function fetchNodePackages(configObject, bucketFileSystem) {
  let [prefix, cleanupCallback] = await tmp.dirAsync({unsafeCleanup: true});

  let modulesPath = path.join(prefix, 'node_modules');
  let modulesConfigPath = path.join(prefix, 'package.json');
  let modulesConfigFile = JSON.stringify(configObject);

  await fs.writeFileAsync(modulesConfigPath, modulesConfigFile);
  await npm.loadAsync({production: true, global: false});
  npm.prefix = prefix;

  await Promise.promisify(npm.commands.install)();
  await Promise.each(readdirRecursiveAsync(modulesPath), (filePath) => {
    return new Promise((resolve, reject) => {
      let bucketFilePath = path.relative(modulesPath, filePath);
      let bucketWriteStream = bucketFileSystem.createWriteStream(bucketFilePath);

      bucketWriteStream.on('finish', resolve);
      fs.createReadStream(filePath).pipe(bucketWriteStream);
    });
  });
  
  // XXX this currently errors...need to figure out where the bug in node-tmp is
  cleanupCallback();
}

module.exports = fetchNodePackages;