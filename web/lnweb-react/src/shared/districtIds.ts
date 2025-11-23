/**
 * Extract the primary district ID from a potentially comma-separated list.
 *
 * Some networks span multiple districts and expose their IDs as a comma-delimited string
 * (e.g. "district-1,district-2"). Code paths that require a single district identifier
 * should call this helper to consistently pick the first entry.
 *
 * @param rawDistrictId - Comma-delimited district ID string, or `null`/`undefined`.
 * @returns The first non-empty district ID, or `null` when unavailable.
 */
export function getPrimaryDistrictId(rawDistrictId?: string | null): string | null {
  if (!rawDistrictId) {
    return null;
  }

  const first = rawDistrictId
    .split(',')
    .map((id) => id.trim())
    .find(Boolean);

  return first ?? null;
}
