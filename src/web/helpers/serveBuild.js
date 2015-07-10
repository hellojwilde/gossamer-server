const path = require('path');
const mime = require('mime');

function serveBuild(registry) {
  return async function(req, res, next) {
    const username = req.user && req.user.username;
    const branchId = await registry.models.user.getBranch(username);
    const {bucketId, overlays} = await registry.models.branch.getLatestBuild(branchId);

    const filePath = req.path.replace(/^\//, '');
    const filePathSegments = filePath.split('/').reduce((valid, seg) => {
      return seg.length > 0 ? valid.concat(seg) : valid;
    }, []);

    let relevantBucketId = bucketId;
    let relevantFilePath = filePathSegments.join('/');

    if (filePathSegments.length && overlays[filePathSegments[0]]) {
      relevantBucketId = overlays[filePathSegments[0]];
      relevantFilePath = filePathSegments.slice(1).join('/');
    }

    const file = await registry.models.bucket.get(relevantBucketId, relevantFilePath);

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
