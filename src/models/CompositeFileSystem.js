const {
  normalizeFilePath, 
  getFilePathSegment,
  getFilePathSlice
} = require('./Paths');

class CompositeFileSystem {  
  constructor(fileSystemConfigs) {
    this.base = null;
    this.overlays = [];

    (fileSystemConfigs || []).forEach(({folder, fs}) => {
      if (folder) {
        this.overlays.push({folder: normalizeFilePath(folder), fs: fs});
      } else {
        this.base = fs;
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
    CompositeFileSystem.prototype[methodName] = function(filePath, ...rest) {
      const normalizedFilePath = normalizeFilePath(filePath);
      const fileSystem = this.overlays.reduce((picked, {folder, fs}) =>{
        return normalizedFilePath.indexOf(folder) === 0 ? fs : picked;
      }, this.base);

      return fileSystem[methodName](normalizedFilePath, ...rest);
    };
  });

module.exports = CompositeFileSystem;