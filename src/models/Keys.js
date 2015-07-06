function getKey(...parts) {
  return ['gos'].concat(parts).join(':');
}

function getKeyPrefix(...parts) {
  return getKey(...parts) + ':';
}

module.exports = {
  getKey,
  getKeyPrefix
};