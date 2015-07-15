const {returnValue, returnNotImplemented} = require('../helpers/Return');

const BUCKET_SEP = '/';

const returnNotFound = (callback, method, filePath) => {
  return returnValue(callback, `File ${filePath} not found during ${method}`)
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
    let fileExists = await this.model.existsFile(this.bucketId, filePath);
    if (fileExists) {
      return returnValue(callback, null, getStats(StatsType.FILE));
    }

    let fileAncestorExists = await this.model.existsFileAncestor(this.bucketId, filePath);
    if (fileAncestorExists) {
      return returnValue(callback, null, getStats(StatsType.DIRECTORY));
    }
    
    return returnNotFound(callback, 'stat', filePath);
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
      return returnNotFound(callback, 'readdir', filePath);
    } 
  }

  async readlink(filePath, callback) {
    return returnNotImplemented(callback, 'readlink', [filePath]);
  }

  async writeFile(filePath, data, callback) {
    await this.model.putFile(this.bucketId, filePath, data);
    return returnValue(callback);
  }

  async unlink(filePath, callback) {
    await this.model.delFile(this.bucketId, filePath);
    return returnValue(callback);
  }

  async readFile(filePath, callback) {
    let file = await this.model.getFile(this.bucketId, filePath);
    if (file && file.buffer) {
      return returnValue(callback, null, file.buffer);
    } else {
      return returnNotFound(callback, 'readFile', filePath);
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