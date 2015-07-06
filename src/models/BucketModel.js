const {getKey} = require('./Keys');

const Promise = require('bluebird');

class BucketModel {
  constructor(registry) {
    this.config = registry.config;
    this.redis = registry.config;
    this.registry = registry;
  }

  get blob() {
    return this.registry.models.blob;
  }

  async putBucketFile(bucketId, filePath, buffer, optDigest) {
    let digest = optDigest || this.blob.getDigestForBuffer(buffer);
    let exists = await this.blob.exists(digest);

    if (!exists) {
      await this.blob.put(digest, buffer);
    }

    await this.redis.hset(getKey('bucket', bucketId), filePath, digest);
  }

  delBucketFile(bucketId, filePath) {
    return this.redis.hdel(getKey('bucket', bucketId), filePath);
  }

  getBucketFileExists(bucketId, filePath) {
    return this.redis.hexists(getKey('bucket', bucketId), filePath);
  }

  getBucketFileDigest(bucketId, filePath) {
    return this.redis.hget(getKey('bucket', bucketId), filePath);
  }

  async getBucketFile(bucketId, filePath) {
    let digest = await this.getBucketFileDigest(bucketId, filePath);

    if (!digest) {
      return null;
    }

    return await Promise.props({
      digest: digest, 
      buffer: this.blob.getBuffer(digest)
    });
  }

  async getBucketPathsMatching(bucketId, filePathPattern) {
    let fetch = cursor => this.redis.hscan(
      this.getKey('bucket', bucketId), 
      cursor,
      filePathPattern
    );

    let [cursor, results] = await fetch(0);

    while (cursor !== 0) {
      let [newCursor, newResults] = await fetch(cursor);

      results = results.concat(newResults);
      cursor = newCursor;
    }

    return results;
  }
}

module.exports = BucketModel;