const BUCKET_SEP = '/';

const emptyFunction = () => {};
const returnValue = (callback, err, result) => {
  callback && callback(err, result);
  if (err && !callback) {
    throw err;
  }
  return result;
}

const statsBoolTrue = () => true;
const statsBoolFalse = () => false;
const statsBool = (bool) => bool ? statsBoolTrue : statsBoolFalse;

const StatsType = {
  FILE: 'file',
  DIRECTORY: 'directory'
};

function getStats(type) {
  return {
    isFile: statsBool(type === StatsType.FILE),
    isDirectory: statsBool(type === StatsType.DIRECTORY),
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
    return pieces.filter((piece) => piece && piece.length > 0).join(BUCKET_SEP);
  }

  async stat(filePath, callback) {
    let fileExists = await this.model.exists(this.bucketId, filePath);
    if (fileExists) {
      return returnValue(callback, null, getStats(StatsType.FILE));
    }

    let filePathsMatching = await this.readdir(filePath, emptyFunction);
    if (filePathsMatching && filePathsMatching.length > 0) {
      return returnValue(callback, null, getStats(StatsType.DIRECTORY));
    }
    
    return returnValue(callback, `BucketFileSystem.stat: ${filePath} not found`);
  }
  
  async mkdirp(filePath, callback) {return returnValue(callback);}
  async mkdir(filePath, callback)  {return returnValue(callback);}
  async rmdir(filePath, callback)  {return returnValue(callback);}

  async readdir(filePath, callback) {
    let filePathsMatching = await this.model.getMatchingPaths(
      this.bucketId, 
      filePath.replace(/\/$/, '')+'/*'
    );

    if (filePathsMatching.length > 0) {
      return returnValue(callback, null, filePathsMatching);
    } else {
      return returnValue(callback, `BucketFileSystem.readdir: ${filePath} not found`);
    } 
  }

  async readlink(filePath, callback) {
    return returnValue(callback, 'BucketFileSystem.readlink: links not supported');
  }

  async writeFile(filePath, data, callback) {
    await this.model.put(this.bucketId, filePath, data);
    return returnValue(callback);
  }

  async unlink(filePath, callback) {
    await this.model.del(this.bucketId, filePath);
    return returnValue(callback);
  }

  async readFile(filePath, callback) {
    let file = await this.model.get(this.bucketId, filePath);
    if (file && file.buffer) {
      return returnValue(callback, null, file.buffer);
    } else {
      return returnValue(callback, `BucketFileSystem.readFile: ${filePath} not found`);
    }
  }

  createWriteStream(filePath) {
    return this.model.createWriteStream(this.bucketId, filePath);
  }

  createReadStream(filePath) {
    return this.model.createReadStream(this.bucketId, filePath);
  }
}

module.exports = BucketFileSystem;