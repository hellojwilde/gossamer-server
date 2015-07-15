const {getKey} = require('./Keys');
const {normalizeFilePath, getFilePathAncestors} = require('./Paths');

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

  exists(bucketId) {
    return this.redis.exists(getKey('bucket', bucketId));
  }

  async putFile(bucketId, filePath, buffer) {
    const digest = await this.blob.put(buffer);
    await this.putFileDigest(bucketId, filePath, digest);
  }

  putFileDigest(bucketId, filePath, digest) {
    const normalizedFilePath = normalizeFilePath(filePath);
    const ancestors = getFilePathAncestors(normalizedFilePath);

    return Promise.all([
      this.redis.hset(getKey('bucket', bucketId), normalizedFilePath, digest),
      this.redis.sadd(getKey('bucket', bucketId, 'ancestors'), ...ancestors)
    ]);
  }

  unlinkFile(bucketId, filePath) {
    return this.redis.hdel(
      getKey('bucket', bucketId),
      normalizeFilePath(filePath)
    );
  }

  existsFile(bucketId, filePath) {
    return this.redis.hexists(
      getKey('bucket', bucketId),
      normalizeFilePath(filePath)
    );
  }

  existsFileAncestor(bucketId, filePath) {
    return this.redis.sismember(
      getKey('bucket', bucketId, 'ancestors'),
      normalizeFilePath(filePath)
    );
  }

  getFileDigest(bucketId, filePath) {
    return this.redis.hget(
      getKey('bucket', bucketId),
      normalizeFilePath(filePath)
    );
  }

  async getFile(bucketId, filePath) {
    let digest = await this.getFileDigest(bucketId, filePath);

    if (!digest) {
      return null;
    }

    return await Promise.props({
      digest: digest, 
      buffer: this.blob.get(digest)
    });
  }

  async getMatchingFilePaths(bucketId, filePathPattern) {
    let results = [];
    let cursor = '0';

    let fetch = async () => {
      let [newCursor, newResults] = await this.redis.hscan(
        getKey('bucket', bucketId), 
        cursor,
        'match',
        filePathPattern
      );

      cursor = newCursor;
      newResults.forEach((result, idx) => {
        if (idx % 2 === 0){
          results.push(result);
        }
      });
    }

    await fetch();
    while (cursor != '0') {
      await fetch();
    }
    return results;
  }

  getAllFileDigests(bucketId) {
    return this.redis.hgetall(getKey('bucket', bucketId));
  }

  createWriteStream(bucketId, filePath) {
    let stream = this.blob.createWriteStream();

    stream.once('digest', (digest) => {
      this.putFileDigest(bucketId, filePath, digest);
    });

    return stream;
  }

  async createReadStream(bucketId, filePath) {
    let digest = await this.getDigest(bucketId, filePath);
    return this.blob.createReadStream(digest);
  }
}

module.exports = BucketModel;