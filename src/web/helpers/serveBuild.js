let path = require('path');
let mime = require('mime');

function serveBuild(registry) {
  return async function(req, res, next) {
    let filePath = req.path.replace(/^\//, '');
    let username = req.user && req.user.username;
    let bucketId = await registry.model.getMyBranchBuildBucketId(username);
    let file = await registry.model.getBucketFile(bucketId, filePath);

    if (file === null) {
      next();
      return;
    }

    res.set('ETag', file.digest);
    res.set('Content-Type', mime.lookup(filePath));
    res.send(file.buffer);
  }
}


module.exports = serveBuild;
