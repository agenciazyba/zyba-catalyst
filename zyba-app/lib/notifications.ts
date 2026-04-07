import type { Trip } from "@/lib/api";

export type AppNotification = {
  id: string;
  tripId: string;
  message: string;
  href: string;
  kind: "documents_ack_pending";
};

export function buildNotificationsFromTrips(trips: Trip[]): AppNotification[] {
  const notifications: AppNotification[] = [];

  for (const trip of trips) {
    if (!trip?.id) continue;
    if (trip.documentsAcknowledged !== false) continue;

    const tripSubject = (trip.subject || trip.dealName || "Trip").trim();

    notifications.push({
      id: `documents_ack_pending:${trip.id}`,
      tripId: trip.id,
      message: `You need to check some importante Documents for your trip ${tripSubject}`,
      href: `/trips/${trip.id}/documents`,
      kind: "documents_ack_pending",
    });
  }

  return notifications;
}
