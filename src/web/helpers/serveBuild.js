const CompositeBucketFileSystem = require('../../models/CompositeBucketFileSystem');

const mime = require('mime');

function serveBuild(registry) {
  return async function(req, res, next) {
    const username = req.user && req.user.username;
    const branchId = await registry.models.user.getBranch(username);
    const {buckets} = await registry.models.branch.getLatestBuild(branchId);
    const fileSystem = new CompositeBucketFileSystem(registry.models.bucket, buckets);
    
    try {
      const file = await fileSystem.readFile(req.path)
      res.set('Content-Type', mime.lookup(req.path));
      res.send(file);
    } catch(e) {
      res.status(404).end();
    }
  }
}

module.exports = serveBuild;
