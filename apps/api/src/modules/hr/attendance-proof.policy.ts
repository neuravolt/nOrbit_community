/**
 * What a self check-in may claim about its face check. The browser used to write "AI Face Verified"
 * or "PROXY ALERT" into the attendance note itself, so a punch sent straight to the API (or with an
 * edited note) looked verified. The server now writes that part from its own biometric audit log.
 */
export const FACE_CHECK_WINDOW_MS = 2 * 60 * 1000;

export interface FaceCheck {
  action: string;
  verificationStatus: string;
  matchScore: number | null;
  createdAt: Date;
}

/** The server's own line about the face check behind this punch. "PROXY ALERT" puts it in HR's flagged list. */
export function faceCheckNote(check: FaceCheck | null): string {
  if (!check)
    return 'PROXY ALERT: no face check before this punch (flagged for HR review)';
  if (check.action === 'ENROLLMENT' || check.action === 'RE_ENROLLMENT')
    return 'Face enrolled on this punch (server check)';
  if (check.verificationStatus === 'VERIFIED') {
    const pct =
      typeof check.matchScore === 'number'
        ? ` (${Math.round(check.matchScore * 1000) / 10}% match)`
        : '';
    return `Face verified by server${pct}`;
  }
  if (check.verificationStatus === 'FLAGGED')
    return 'PROXY ALERT: face check failed (not a live face, or replayed data; flagged for HR review)';
  return 'PROXY ALERT: face did not match the employee (server check, flagged for HR review)';
}

/** Removes any verification claim the browser wrote, keeping its photo, location and mode details. */
export function stripClientClaims(notes: string | null | undefined): string {
  return String(notes || '')
    .replace(
      /(AI Face Verified|PROXY ALERT|Biometric Profile Enrolled|Face verified by server|Face enrolled on this punch)[^[|]*/gi,
      '',
    )
    .replace(
      /Verified HQ Geofence \(Browser Location\)/g,
      'Location not shared',
    )
    .replace(/\(Verified Client GPS\)/g, '(browser location)')
    .replace(/^\s+/, '');
}

/** Note for a self check-in: the server's verdict first, then what the browser sent. */
export function selfPunchNote(
  check: FaceCheck | null,
  clientNotes: string | null | undefined,
): string {
  const rest = stripClientClaims(clientNotes);
  return rest ? `${faceCheckNote(check)} ${rest}` : faceCheckNote(check);
}

/**
 * Joins attendance notes. Each note is readable text, then optional `|||KEY:value` attachments
 * (selfie, GPS, mode) that the page parses; the texts go first so every line stays visible.
 */
export function joinNotes(...notes: (string | null | undefined)[]): string {
  const texts: string[] = [];
  const tails: string[] = [];
  for (const n of notes) {
    if (!n) continue;
    const i = n.indexOf('|||');
    const text = (i === -1 ? n : n.slice(0, i)).trim();
    if (text) texts.push(text);
    if (i !== -1) tails.push(n.slice(i));
  }
  return texts.join(' ') + tails.join('');
}
