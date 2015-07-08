const {Writable} = require('stream');

class BlobWriteStream extends Writable {
  constructor(model) {
    super();

    this._model = model;
    this._buffers = [];

    this.on('finish', async () => {
      let digest = await this._model.put(Buffer.concat(this._buffers));
      this.emit('digest', digest);
    });
  }

  _write(chunk, enc, next) {
    let buffer = Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk, enc);
    this._buffers.push(buffer);    
    next();
  }
}


module.exports = BlobWriteStream;