function getCacheSegment(app) {
  const configuredSegmentId =
    process.env.CACHE_SEGMENT_ID || process.env.CATALYST_CACHE_SEGMENT_ID;

  if (!configuredSegmentId) {
    return app.cache().segment();
  }

  return app.cache().segment(String(configuredSegmentId).trim());
}

module.exports = {
  getCacheSegment
};
