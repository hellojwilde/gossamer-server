const {Writable} = require('stream');

class BucketWriteStream extends Writable {
  constructor(model, bucketId, filePath) {
    super();

    this.model = model;
    this.bucketId = bucketId;
    this.filePath = filePath;
    this.buffers = [];

    this.on('finish', this._finish.bind(this));
  }

  _write(chunk, encoding, next) {
    if (!Buffer.isBuffer(chunk)) {
      chunk = new Buffer(chunk, encoding);
    }

    this.buffers.push(chunk);    
    next();
  }

  _finish() {
    return this.model.putBucketFile(
      this.bucketId,
      this.filePath,
      Buffer.concat(this.buffers)
    );
  }
}


module.exports = BucketWriteStream;