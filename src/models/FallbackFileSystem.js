const Promise = require('bluebird');
const {returnValue, returnNotImplemented} = require('../helpers/Return');

class FallbackFileSystem {
  constructor(fses) {
    this.fses = fses;
  }

  isSync() {
    return false;
  }

  join(...args) {
    return this.fses[0].join(...args);
  }

  readlink(filePath, callback) {
    return returnNotImplemented(callback, 'readlink', [filePath]);
  }

  createReadStream(filePath) {
    throw 'createReadStream is not implemented.';
  }
}

['stat', 'readFile'].forEach((methodName) => {
  FallbackFileSystem.prototype[methodName] = async function(...args) {
    const beforeCallback = args.slice(0, -1);
    const callback = args[args.length - 1];

    for (let fs of this.fses) {
      try {
        let result = await Promise.promisify(fs[methodName], fs)(...beforeCallback);
        return returnValue(callback, null, result);
      } catch(e) {}
    }

    return returnValue(
      callback, 
      `None of the fses could ${methodName}(${JSON.stringify(args)})`
    );
  };
});

module.exports = FallbackFileSystem;