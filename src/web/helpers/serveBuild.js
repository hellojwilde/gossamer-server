let path = require('path');
let mime = require('mime');

function getTransformedFileBuffer(filePath, file, options) {
  switch (filePath) {
    case 'main.js':
      return file.buffer.toString().replace(
        '{/* INJECTED_UPDATER_INFO */}',
        JSON.stringify({
          latestBuildIdUrl: options.config.publicUrl + '/api/v1/my/latest',
          buildId: options.build.join('/')
        })
      );
    default:
      return file.buffer;
  }
}

function serveBuild(registry) {
  return async function(req, res, next) {
    let filePath = req.path.replace(/^\//, '');

    let build = await registry.model.getMyBranchBuild(req.user && req.user.username);
    let bucketId = registry.model.getBranchBuildBucketId(...build);
    let file = await registry.model.getBucketFile(bucketId, filePath);

    if (file === null) {
      next();
      return;
    }

    res.set('ETag', file.digest);
    res.set('Content-Type', mime.lookup(filePath));
    res.send(getTransformedFileBuffer(filePath, file, {
      build: build,
      config: registry.config
    }));
  }
}


module.exports = serveBuild;
