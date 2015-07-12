const Promise = require('bluebird');

const fs = Promise.promisifyAll(require('fs'));
const npm = Promise.promisifyAll(require('npm'));
const path = require('path');
const readdirRecursiveAsync = Promise.promisify(require('recursive-readdir'));
const rmdirAsync = Promise.promisify(require('rmdir'));
const tmp = Promise.promisifyAll(require('tmp'));

async function fetchNodePackages(configFileBuffer, bucketFileSystem) {
  const [prefix, cleanupCallback] = await tmp.dirAsync();
  const modulesPath = path.join(prefix, 'node_modules');
  const modulesConfigPath = path.join(prefix, 'package.json');

  await fs.writeFileAsync(modulesConfigPath, configFileBuffer);
  await npm.loadAsync({production: false, global: false});
  npm.prefix = prefix;

  await Promise.promisify(npm.commands.install)();
  await Promise.each(readdirRecursiveAsync(modulesPath), (filePath) => {
    return new Promise((resolve, reject) => {
      const bucketFilePath = path.relative(modulesPath, filePath);
      const bucketWriteStream = bucketFileSystem.createWriteStream(bucketFilePath);

      bucketWriteStream.on('finish', resolve);
      fs.createReadStream(filePath).pipe(bucketWriteStream);
    });
  });
  
  await Promise.all([
    fs.unlinkAsync(modulesConfigPath),
    rmdirAsync(modulesPath)
  ]);

  cleanupCallback();
}

module.exports = fetchNodePackages;