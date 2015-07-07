const {Readable} = require('stream');

class BlobReadStream extends Readable {
  constructor(model, digest) {
    super();

    this._model = model;
    this._digest = digest;
    this._initialReadCalled = false;
  }

  _read() {
    if (this._initialReadCalled) {
      return;
    }

    this._initialReadCalled = true;
    this._model.get(this._digest).then((buffer) => {
      this.push(buffer);
      this.push(null);
    });
  }
}

module.exports = BlobReadStream;