const BucketModel = require('./BucketModel');

class BucketModelWriteTransform extends BucketModel {
  constructor(model, transform) {
    super(model.registry);
    this.transform = transform;
  }

  putBucketFile(bucketId, filePath, buffer, optDigest) {
    super.putBucketFile(bucketId, filePath, this.transform(filePath, buffer));
  }
}

module.exports = BucketModelWriteTransform;