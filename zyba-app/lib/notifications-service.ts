import { getTripRequirements, getTrips, type Trip } from "@/lib/api";
import { buildNotificationsFromTrips, type AppNotification } from "@/lib/notifications";

type RequirementsShape = {
  trip?: {
    documentsAcknowledged?: boolean;
  };
};

export async function loadUserNotifications(sessionToken: string): Promise<AppNotification[]> {
  const tripsResult = await getTrips(sessionToken);
  if (!tripsResult.ok || !Array.isArray(tripsResult.data)) return [];

  const trips = tripsResult.data as Trip[];
  const directNotifications = buildNotificationsFromTrips(trips);
  const byId = new Map(directNotifications.map((item) => [item.id, item]));

  const missingFlagTrips = trips.filter((trip) => typeof trip.documentsAcknowledged !== "boolean");
  if (missingFlagTrips.length === 0) return Array.from(byId.values());

  const fallbackResults = await Promise.all(
    missingFlagTrips.map(async (trip) => {
      const details = await getTripRequirements(sessionToken, trip.id);
      if (!details.ok) return null;
      const payload = (details.data as RequirementsShape) || {};
      const acknowledged = payload.trip?.documentsAcknowledged === true;
      if (acknowledged) return null;

      const subject = (trip.subject || trip.dealName || "Trip").trim();
      const id = `documents_ack_pending:${trip.id}`;

      return {
        id,
        tripId: trip.id,
        message: `You need to check some importante Documents for your trip ${subject}`,
        href: `/trips/${trip.id}/documents`,
        kind: "documents_ack_pending" as const,
      };
    })
  );

  for (const item of fallbackResults) {
    if (!item) continue;
    byId.set(item.id, item);
  }

  return Array.from(byId.values());
}
