export const palette = {
  parchment: "#DAD7CD",
  sage:      "#A3B18A",
  fern:      "#588157",
  forest:    "#3A5A40",
  canopy:    "#344E41",
} as const;

export type PaletteKey = keyof typeof palette;

/** AQI color thresholds */
export function aqiColor(aqi: number): string {
  if (aqi <= 50)  return "#588157"; // fern — Good
  if (aqi <= 100) return "#d4a82a"; // amber — Moderate
  if (aqi <= 150) return "#e07b39"; // orange — Sensitive
  if (aqi <= 200) return "#c0392b"; // red — Unhealthy
  return "#7d3c98";                  // purple — Very Unhealthy
}

export function aqiLabel(aqi: number): string {
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Sensitive";
  if (aqi <= 200) return "Unhealthy";
  return "Hazardous";
}
