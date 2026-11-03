/** Office geofence for attendance: how far a punch was from the employee's office. */
export interface Office {
  name: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
}
export interface PunchLocation {
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
}

export const DEFAULT_RADIUS_METERS = 200;

/** Great-circle distance in metres. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const valid = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);
const human = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

/**
 * The attendance-note line for a punch against an office with coordinates, or null when the office
 * has none (no geofence set up). Outside the area, or no location shared, is flagged for HR review.
 * The phone's own accuracy is allowed for, so a weak GPS fix just inside the edge is not flagged.
 */
export function geofenceNote(
  office: Office | null,
  at: PunchLocation,
): string | null {
  if (!office || !valid(office.latitude) || !valid(office.longitude))
    return null;
  if (!valid(at.latitude) || !valid(at.longitude))
    return `PROXY ALERT: location not shared (office geofence: ${office.name})`;
  const radius =
    office.radiusMeters && office.radiusMeters > 0
      ? office.radiusMeters
      : DEFAULT_RADIUS_METERS;
  const slack = valid(at.accuracyMeters)
    ? Math.min(Math.max(at.accuracyMeters, 0), 100)
    : 0;
  const d = distanceMeters(
    office.latitude,
    office.longitude,
    at.latitude,
    at.longitude,
  );
  return d <= radius + slack
    ? `Inside ${office.name} (${human(d)} from office)`
    : `PROXY ALERT: outside the office area (${human(d)} from ${office.name})`;
}
