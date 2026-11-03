import {
  faceCheckNote,
  joinNotes,
  selfPunchNote,
  stripClientClaims,
} from './attendance-proof.policy';

const at = new Date();
describe('who decides whether a punch was face-verified', () => {
  it('writes the verdict from the server check, not from the browser', () => {
    const client =
      'AI Face Verified (100% Match with Reference Profile) [Clock-In]|||GPS:Verified HQ Geofence (Browser Location)|||MODE:AI Live Selfie';
    expect(selfPunchNote(null, client)).toBe(
      'PROXY ALERT: no face check before this punch (flagged for HR review) [Clock-In]|||GPS:Location not shared|||MODE:AI Live Selfie',
    );
    expect(
      selfPunchNote(
        {
          action: 'VERIFICATION',
          verificationStatus: 'VERIFIED',
          matchScore: 0.812,
          createdAt: at,
        },
        client,
      ),
    ).toMatch(/^Face verified by server \(81\.2% match\) \[Clock-In\]/);
  });

  it('flags a failed or replayed check and accepts a first-punch enrollment', () => {
    expect(
      faceCheckNote({
        action: 'VERIFICATION',
        verificationStatus: 'REJECTED',
        matchScore: 0.1,
        createdAt: at,
      }),
    ).toMatch(/^PROXY ALERT/);
    expect(
      faceCheckNote({
        action: 'VERIFICATION',
        verificationStatus: 'FLAGGED',
        matchScore: 1,
        createdAt: at,
      }),
    ).toMatch(/^PROXY ALERT/);
    expect(
      faceCheckNote({
        action: 'ENROLLMENT',
        verificationStatus: 'VERIFIED',
        matchScore: null,
        createdAt: at,
      }),
    ).toMatch(/enrolled/);
  });

  it('removes a claim the browser tried to add', () => {
    expect(stripClientClaims('PROXY ALERT: fake [Clock-Out]')).toBe(
      '[Clock-Out]',
    );
    expect(stripClientClaims('12.9° N, 77.5° E (Verified Client GPS)')).toBe(
      '12.9° N, 77.5° E (browser location)',
    );
  });
});

describe('joinNotes', () => {
  it('keeps every readable line ahead of the attachments', () => {
    expect(
      joinNotes(
        'Face OK [Clock-In]|||LIVE:x|||MODE:AI Live Selfie',
        'Inside office (40 m).',
        '',
        'Late by 20 min.',
      ),
    ).toBe(
      'Face OK [Clock-In] Inside office (40 m). Late by 20 min.|||LIVE:x|||MODE:AI Live Selfie',
    );
  });
});
