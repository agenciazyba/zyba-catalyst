function getCacheSegment(app) {
  const configuredSegmentId =
    process.env.CACHE_SEGMENT_ID || process.env.CATALYST_CACHE_SEGMENT_ID;

  if (!configuredSegmentId) {
    return app.cache().segment();
  }

  const numericId = Number(configuredSegmentId);
  if (Number.isFinite(numericId) && numericId > 0) {
    return app.cache().segment(numericId);
  }

  return app.cache().segment(configuredSegmentId);
}

module.exports = {
  getCacheSegment
};
