import { distanceMeters, geofenceNote } from './geofence.policy';

const office = {
  name: 'Jaipur HQ',
  latitude: 26.9124,
  longitude: 75.7873,
  radiusMeters: 200,
};
describe('office geofence for attendance', () => {
  it('measures distance on the earth', () => {
    expect(Math.round(distanceMeters(26.9124, 75.7873, 26.9124, 75.7873))).toBe(
      0,
    );
    expect(Math.round(distanceMeters(0, 0, 0, 1) / 1000)).toBe(111);
  });

  it('accepts a punch inside the office area and flags one outside or without a location', () => {
    expect(
      geofenceNote(office, { latitude: 26.913, longitude: 75.7875 }),
    ).toMatch(/^Inside Jaipur HQ \(\d+ m from office\)/);
    expect(geofenceNote(office, { latitude: 26.95, longitude: 75.8 })).toMatch(
      /^PROXY ALERT: outside the office area \(4\.\d km from Jaipur HQ\)/,
    );
    expect(geofenceNote(office, {})).toMatch(
      /^PROXY ALERT: location not shared/,
    );
  });

  it('allows for the phone GPS accuracy at the edge, and does nothing without office coordinates', () => {
    expect(
      geofenceNote(office, {
        latitude: 26.9146,
        longitude: 75.7873,
        accuracyMeters: 60,
      }),
    ).toMatch(/^Inside/); // ~245 m, accuracy 60 m
    expect(
      geofenceNote(
        { ...office, latitude: null },
        { latitude: 1, longitude: 1 },
      ),
    ).toBeNull();
    expect(geofenceNote(null, {})).toBeNull();
  });
});
