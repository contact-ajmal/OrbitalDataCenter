/** Live Starlink overlay status (read by the HUD telemetry row). */
export const starlink = {
  loaded: false,
  count: 0,
  /** Age of the TLE elements in hours (from starlink.meta.json). */
  ageHours: 0,
};
