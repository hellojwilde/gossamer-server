const crypto = require('crypto');
const {getKey} = require('./Keys');

class BlobModel {
  constructor(registry) {
    this.redis = registry.redis;
    this.registry = registry;
  }

  getDigestForBuffer(buffer) {
    let hash = crypto.createHash('sha1');
    hash.update(buffer);
    return hash.digest('base64');
  }

  put(digest, buffer) {
    return this.redis.set(getKey('blob', digest), buffer);
  }

  exists(digest) {
    return this.redis.exists(getKey('blob', digest));
  }

  getBuffer(digest) {
    return this.redis.getBuffer(getKey('blob', digest));
  }
}

module.exports = BlobModel;
