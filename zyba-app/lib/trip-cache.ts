export function getTravelerCacheKey() {
  return "traveler";
}

export function getTripsListCacheKey() {
  return "trips-list";
}

export function getTripDetailsCacheKey(tripId: string) {
  return `trip-details:${tripId}`;
}