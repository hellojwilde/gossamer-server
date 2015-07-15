const returnValue = (callback, err, result) => {
  callback && callback(err, result);
  if (err && !callback) {
    throw err;
  }
  return result;
}

const returnNotImplemented = (callback, methodName, args) => {
  return returnValue(
    callback, 
    `${methodName}(${JSON.stringify(args)}) is not implemented.`
  );
}

module.exports = {
  returnValue,
  returnNotImplemented
};