const {normalizeFilePath, getFilePathSegment} = require('./Paths');

class CompositeFileSystem {  
  constructor(fileSystemConfigs) {
    this.base = null;
    this.overlays = [];

    (fileSystemConfigs || []).forEach(({folder, fs}) => {
      if (folder) {
        this.overlays[folder] = fs;
      } else {
        this.base = fs;
      }
    });
  }

  isSync() {
    return false;
  }
}

['join', 'stat', 'readlink', 'readFile', 'createReadStream'].forEach((methodName) => {
  CompositeFileSystem.prototype[methodName] = function(filePath, ...rest) {
    const normalizedFilePath = normalizeFilePath(filePath);
    const folder = getFilePathSegment(normalizedFilePath, 0);
    const fileSystem = this.overlays[folder] || this.base;

    return fileSystem[methodName](normalizedFilePath, ...rest);
  };
});

module.exports = CompositeFileSystem;