export function rankingScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.min(1, Math.max(0, value)) * 100) : null;
}
export function coordinates(latitude: string, longitude: string): { lat: number; lng: number } | null {
  if (!latitude.trim() || !longitude.trim()) return null;
  const lat = Number(latitude), lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
