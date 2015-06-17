function getUnixTimestamp() {
  return Math.floor(new Date() / 1000);
}

module.exports = getUnixTimestamp;