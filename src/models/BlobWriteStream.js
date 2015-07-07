const {Writable} = require('stream');

class BlobWriteStream extends Writable {
  constructor(model) {
    super();

    this._model = model;
    this._buffers = [];
  }

  _write(chunk, encoding, next) {
    let buffer = Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk, encoding);
    this._buffers.push(buffer);    
    next();
  }

  end(chunk, encoding) {
    this._write(chunk, encoding, () => {
      this._model.put(Buffer.concat(this._buffers)).then((digest) => {
        this.emit('finish', digest);
      });
    })
  }
}


module.exports = BlobWriteStream;