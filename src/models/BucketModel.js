const {getKey} = require('./Keys');

const Promise = require('bluebird');

class BucketModel {
  constructor(registry) {
    this.config = registry.config;
    this.redis = registry.redis;
    this.registry = registry;
  }

  get blob() {
    return this.registry.models.blob;
  }

  bucketExists(bucketId) {
    return this.redis.exists(getKey('bucket', bucketId));
  }

  async put(bucketId, filePath, buffer) {
    let digest = await this.blob.put(buffer);
    await this.putDigest(bucketId, filePath, digest);
  }

  putDigest(bucketId, filePath, digest) {
    return this.redis.hset(getKey('bucket', bucketId), filePath, digest);
  }

  del(bucketId, filePath) {
    return this.redis.hdel(getKey('bucket', bucketId), filePath);
  }

  exists(bucketId, filePath) {
    return this.redis.hexists(getKey('bucket', bucketId), filePath);
  }

  getDigest(bucketId, filePath) {
    return this.redis.hget(getKey('bucket', bucketId), filePath);
  }

  async get(bucketId, filePath) {
    let digest = await this.getDigest(bucketId, filePath);

    if (!digest) {
      return null;
    }

    return await Promise.props({
      digest: digest, 
      buffer: this.blob.get(digest)
    });
  }

  async getMatchingPaths(bucketId, filePathPattern) {
    let fetch = cursor => this.redis.hscan(
      getKey('bucket', bucketId), 
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

  createWriteStream(bucketId, filePath) {
    let stream = this.blob.createWriteStream();

    stream.on('digest', (digest) => {
      this.putDigest(bucketId, filePath, digest);
    });

    return stream;
  }

  async createReadStream(bucketId, filePath) {
    let digest = await this.getDigest(bucketId, filePath);
    return this.blob.createReadStream(digest);
  }
}

module.exports = BucketModel;