const {normalizeFilePath, getFilePathSlice} = require('./Paths')

const emptyFunction = () => {};
const returnValue = (callback, err, result) => {
  callback && callback(err, result);
  if (err && !callback) {
    throw err;
  }
  return result;
}

class BucketFileSystemWithPrefix {
  constructor(bucketFileSystem, prefixSegment) {
    this.bucketFileSystem = bucketFileSystem;
    this.prefixSegment = prefixSegment;
  }

  isSync() {
    return false;
  }

  join(...args){
    return this.bucketFileSystem.join(...args);
  }
}

['stat', 'mkdirp', 'mkdir', 'rmdir', 'readlink', 'readFile', 'writeFile', 
 'unlink', 'createWriteStream', 'createReadStream'].forEach((methodName) => {
  BucketFileSystemWithPrefix.prototype[methodName] = function(filePath, ...rest) {
    const normalizedFilePath = normalizeFilePath(filePath);

    return this.bucketFileSystem[methodName](
      getFilePathSlice(normalizedFilePath, 1),
      ...rest
    );
  };
});

BucketFileSystemWithPrefix.prototype.readdir = async function(filePath, callback) {
  const normalizedFilePath = normalizeFilePath(filePath);
  const contents = await this.bucketFileSystem.readdir(
    getFilePathSlice(normalizedFilePath, 1),
    emptyFunction
  );

  return returnValue(
    callback,
    null, 
    contents.map(content => '/' + this.prefixSegment + content)
  );
}

module.exports = BucketFileSystemWithPrefix;