const Promise = require('bluebird');

const emptyFunction = () => {};
const returnValue = (callback, err, result) => {
  callback && callback(err, result);
  if (err && !callback) {
    throw err;
  }
  return result;
}

class FallbackFileSystem {
  constructor(fses) {
    this.fses = fses;
  }

  isSync() {
    return false;
  }
}

['join', 'stat', 'readlink', 'readFile', 'createReadStream']
  .forEach((methodName) => {
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