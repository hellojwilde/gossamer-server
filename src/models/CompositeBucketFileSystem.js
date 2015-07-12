const BucketFileSystem = require('./BucketFileSystem');

const {
  normalizeFilePath, 
  getFilePathSegment,
  getFilePathSlice
} = require('./Paths');

const emptyFunction = () => {};
const returnValue = (callback, err, result) => {
  callback && callback(err, result);
  if (err && !callback) {
    throw err;
  }
  return result;
}

class CompositeBucketFileSystem {  
  constructor(model, fileSystemConfigs) {
    this.base = null;
    this.overlays = {};

    (fileSystemConfigs || []).forEach((config) => {
      const fs = new BucketFileSystem(model, config.bucketId);
      const folder = config.folder || null;

      if (folder === null) {
        this.base = fs;
      } else {
        this.overlays[folder] = fs;
      }
    });
  }

  isSync() {
    return false;
  }
}

// we only implement the read-only methods.

['join', 'stat', 'readlink', 'readFile', 'createReadStream']
  .forEach((methodName) => {
    CompositeBucketFileSystem.prototype[methodName] = function(filePath, ...rest) {
      const normalizedFilePath = normalizeFilePath(filePath);
      const overlay = this.overlays[getFilePathSegment(normalizedFilePath, 0)];

      if (overlay) {
        return overlay[methodName](
          getFilePathSlice(normalizedFilePath, 1),
          ...rest
        );
      }

      return this.base[methodName](normalizedFilePath, ...rest);
    };
  });

CompositeBucketFileSystem.prototype.readdir = async function(filePath, callback) {
  const normalizedFilePath = normalizeFilePath(filePath);
  const overlaySegment = getFilePathSegment(normalizedFilePath, 0);
  const overlay = this.overlays[overlaySegment];

  if (overlay) {
    const overlayContents = await overlay[methodName](
      getFilePathSlice(normalizedFilePath, 1),
      emptyFunction
    );

    return returnValue(
      callback,
      null, 
      overlayContents.map(content => '/' + overlaySegment + content)
    );
  }

  const contents = await this.base[methodName](normalizedFilePath, emptyFunction);
  return returnValue(callback, null, contents);
}

module.exports = CompositeBucketFileSystem;