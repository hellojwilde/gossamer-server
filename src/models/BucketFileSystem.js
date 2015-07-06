const BucketWriteStream = require('./BucketWriteStream');

const BUCKET_SEP = '/';

const statsBoolTrue = () => true;
const statsBoolFalse = () => false;
const statsBool = (bool) => bool ? statsBoolTrue : statsBoolFalse;

const StatsType = {
  FILE: 'file',
  DIRECTORY: 'directory'
};

function getStats(type) {
  return {
    isFile: statsBoolean(type === StatsType.FILE),
    isDirectory: statsBoolean(type === StatsType.DIRECTORY),
    isBlockDevice: statsBoolFalse,
    isCharacterDevice: statsBoolFalse,
    isSymbolicLink: statsBoolFalse,
    isFIFO: statsBoolFalse,
    isSocket: statsBoolFalse 
  };
}

class BucketFileSystem {
  constructor(model, bucketId) {
    this.model = model;
    this.bucketId = bucketId;
  }

  isSync() {
    return false;
  }

  join(...pieces) {
    return pieces.join(BUCKET_SEP);
  }

  async stat(filePath, callback) {
    let fileExists = await this.model.getBucketFileExists(this.bucketId, filePath);
    let filePathsMatching = await this.model.getBucketPathsMatching(this.bucketId, filePath+'*/*');

    if (fileExists) {
      callback(null, getStats(StatsType.FILE));
    } else if (filePathsMatching.length > 0) {
      callback(null, getStats(StatsType.DIRECTORY));
    } else {
      callback('filePath not found');
    }
  }
  
  mkdirp(filePath, callback) { callback(null); }
  mkdir(filePath, callback) { callback(null); }
  rmdir(filePath, callback) { callback(null); }

  async readdir(filePath, callback) {
    let filePathsMatching = await this.model.getBucketPathsMatching(this.bucketId, filePath+'*/*');

    if (filePathsMatching > 0) {
      callback(null, filePathsMatching);
    } else {
      callback('filePath not found');
    } 
  }

  createWriteStream(filePath) {
    return new BucketWriteStream(this.model, this.bucketId, filePath);
  }

  async writeFile(filePath, data, callback) {
    await this.model.putBucketFile(this.bucketId, filePath, data);
    callback(null);
  }

  async unlink(filePath, callback) {
    await this.model.delBucketFile(this.bucketId, filePath);
    callback(null);
  }

  async readFile(filePath, callback) {
    let file = await this.model.getBucketFile(this.bucketId, filePath);

    if (file && file.buffer) {
      callback(null, file.buffer);
    } else {
      callback('filePath not found');
    }
  }
}

module.exports = BucketFileSystem;