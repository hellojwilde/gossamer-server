const CompositeFileSystem = require('./CompositeFileSystem');
const BucketFileSystem = require('./BucketFileSystem');

class CompositeBucketFileSystem extends CompositeFileSystem {
  constructor(model, fileSystemConfigs) {
    super(fileSystemConfigs.map(({folder, bucketId}) => ({
      folder: folder,
      fs: new BucketFileSystem(model, bucketId)
    })))
  } 
}

module.exports = CompositeBucketFileSystem;