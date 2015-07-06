let npm = require('npm');
let tmp = require('tmp');

let Promise = require('bluebird');

const tmpDirPromise = function(options) {
  let cleanupCallback;

  return Promise.promisify(tmp.dir)(options)
    .spread(function(path, done) {
      cleanupCallback = done;
      return path;
    })
    .disposer(() => cleanupCallback && cleanupCallback());
}

const npmLoadPromise = Promise.promisify(npm.load);
const npmInstallPromise = Promise.promisify(npm.install);

function fetchNodePackages(configObject, fileSystem) {
  return Promise.using(tmpDirPromise({unsafeCleanup: true}), async function(path) {
    await npmLoadPromise(configObject);

    let [installedModules, idealTree] = await npmInstallPromise(['.']);
    console.log(installedModules, idealTree);
  });
}

module.exports = fetchNodePackages;