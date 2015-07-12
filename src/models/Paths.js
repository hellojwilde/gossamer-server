function normalizeFilePath(filePath) {
  filePath = filePath.replace(/\/+/, '/');
  return filePath[0] == '/' ? filePath : '/' + filePath;
}

function getFilePathSegments(filePath) {
  return filePath.split('/').filter(segment => segment && segment.length > 0);
}

function getFilePathSegment(filePath, index) {
  return getFilePathSegments(filePath)[index]
}

function getFilePathSlice(filePath, ...sliceArgs) {
  return '/' + getFilePathSegments(filePath).slice(...sliceArgs).join('/');
}

module.exports = {
  normalizeFilePath,
  getFilePathSegment,
  getFilePathSlice
};