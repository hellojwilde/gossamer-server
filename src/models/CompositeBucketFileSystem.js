const BucketFileSystem = require('./BucketFileSystem');
const BucketFileSystemWithPrefix = require('./BucketFileSystemWithPrefix');

const {
  normalizeFilePath, 
  getFilePathSegment,
  getFilePathSlice
} = require('./Paths');


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
        this.overlays[folder] = new BucketFileSystemWithPrefix(fs);
      }
    });
  }

  isSync() {
    return false;
  }
}

// we only implement the read-only methods.

['join', 'stat', 'readlink', 'readFile', 'createReadStream', 'readdir']
  .forEach((methodName) => {
    CompositeBucketFileSystem.prototype[methodName] = function(filePath, ...rest) {
      const normalizedFilePath = normalizeFilePath(filePath);
      const overlay = this.overlays[getFilePathSegment(normalizedFilePath, 0)];
      const fileSystem = overlay || this.base;

      return fileSystem[methodName](normalizedFilePath, ...rest);
    };
  });

module.exports = CompositeBucketFileSystem;