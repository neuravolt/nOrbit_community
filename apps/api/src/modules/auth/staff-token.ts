/**
 * Staff, student, client and partner-admin JWTs are all signed with the same JWT_SECRET, so a
 * signature check alone cannot tell them apart. Staff tokens are the only ones with neither a
 * `type` claim (STUDENT / PARTNER_ADMIN) nor a `clientId` claim (client portal).
 */
export function isStaffTokenPayload(payload: any): boolean {
  return !!payload && !payload.type && !payload.clientId;
}
