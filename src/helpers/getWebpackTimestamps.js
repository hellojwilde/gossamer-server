function addMapKeysToSet(set, map) {
  Object.keys(map).forEach((key) => set.add(key));
}

function getWebpackTimestamps(oldFileMap, newFileMap) {
  let keys = new Set();
  addMapKeysToSet(keys, oldFileMap);
  addMapKeysToSet(keys, newFileMap);

  let timestamps = {};
  for (let key of keys.values()) {
    let keyChanged = oldFileMap[key] !== newFileMap[key];
    timestamps[key] = keyChanged ? Infinity : 1;
  }
  return timestamps;
}

module.exports = getWebpackTimestamps;