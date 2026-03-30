function getCacheSegment(app) {
  return app.cache().segment();
}

module.exports = {
  getCacheSegment
};