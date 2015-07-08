const crypto = require('crypto');
const {getKey} = require('./Keys');

const BlobReadStream = require('./BlobReadStream');
const BlobWriteStream = require('./BlobWriteStream');

class BlobModel {
  constructor(registry) {
    this.redis = registry.redis;
    this.registry = registry;
  }

  async put(buffer) {
    let digest = this.getDigest(buffer);
    let exists = await this.exists(digest);

    if (!exists) {
      await this.redis.set(getKey('blob', digest), buffer);
    }
    
    return digest;
  }

  exists(digest) {
    return this.redis.exists(getKey('blob', digest));
  }

  getDigest(buffer) {
    let hash = crypto.createHash('sha1');
    hash.update(buffer);
    return hash.digest('base64');
  }

  get(digest) {
    return this.redis.getBuffer(getKey('blob', digest));
  }

  createWriteStream() {
    return new BlobWriteStream(this);
  }

  createReadStream(digest) {
    return new BlobReadStream(this, digest);
  }
}

module.exports = BlobModel;
