const Promise = require('bluebird');

const fs = Promise.promisifyAll(require('fs'));
const npm = Promise.promisifyAll(require('npm'));
const path = require('path');
const readdirRecursiveAsync = Promise.promisify(require('recursive-readdir'));
const rmdirAsync = Promise.promisify(require('rmdir'));
const tmp = Promise.promisifyAll(require('tmp'));

async function fetchNodePackages(configObject, bucketFileSystem) {
  let [prefix, cleanupCallback] = await tmp.dirAsync();

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

  console.log('cleaning up' + prefix);
  
  await Promise.all([
    fs.unlinkAsync(modulesConfigPath),
    rmdirAsync(modulesPath)
  ]);

  console.log('(cleaned up');

  cleanupCallback();
}

module.exports = fetchNodePackages;