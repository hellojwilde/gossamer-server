const crypto = require('crypto');
const {getKey} = require('./Keys');

const BlobReadStream = require('./BlobReadStream');
const BlobWriteStream = require('./BlobWriteStream');

class BlobModel {
  constructor(registry) {
    this.pg = registry.pg;
    this.registry = registry;
  }

  async put(buffer) {
    let digest = this.getDigest(buffer);
    let exists = await this.exists(digest);

    if (!exists) {
      await this.pg.none(
        'insert into blobs(digest, file) values($1, $2)', 
        [digest, '\\x' + buffer.toString('hex')]
      );
    }

    return digest;
  }

  async exists(digest) {
    let results = await this.pg.oneOrNone(
      'select digest from blobs where digest=$1', 
      digest
    );

    return results !== null;
  }

  getDigest(buffer) {
    let hash = crypto.createHash('sha1');
    hash.update(buffer);
    return hash.digest('hex');
  }

  async get(digest) {
    let results = await this.pg.oneOrNone(
      'select file from blobs where digest=$1',
      digest
    );

    return results !== null ? new Buffer(results.file) : null;
  }

  createWriteStream() {
    return new BlobWriteStream(this);
  }

  createReadStream(digest) {
    return new BlobReadStream(this, digest);
  }
}

module.exports = BlobModel;
