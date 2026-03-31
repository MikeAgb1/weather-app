/**
 * waveAPI.js
 * Fetches current wave conditions from the Open-Meteo Marine API.
 *
 * Open-Meteo is free and requires no API key.  The marine endpoint returns
 * data only for ocean/sea coordinates — requests for inland cities will
 * return an error, which callers should handle gracefully (wave fields → null).
 *
 * Wave height is the significant wave height (Hs), i.e. the average height
 * of the highest one-third of waves — the standard measure used in maritime
 * operations and pilotage directions.
 */

/**
 * Retrieves current wave height, direction, and period for a lat/lon position.
 *
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lon - Longitude in decimal degrees.
 * @returns {Promise<{
 *   waveHeight: number|null,    // Significant wave height in metres
 *   waveDirection: number|null, // Mean wave direction in degrees (0–360)
 *   wavePeriod: number|null     // Mean wave period in seconds
 * }>}
 * @throws {Error} If the API returns an error (e.g. inland location).
 */
export async function getWaveData(lat, lon) {
  if (lat == null || lon == null) throw new Error("Coordinates required for wave data.");

  const url =
    `https://marine-api.open-meteo.com/v1/marine` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=wave_height,wave_direction,wave_period` +
    `&wind_speed_unit=ms`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.reason || "Failed to load wave data.");
  }

  return {
    waveHeight:    data.current?.wave_height    ?? null,
    waveDirection: data.current?.wave_direction ?? null,
    wavePeriod:    data.current?.wave_period    ?? null,
  };
}
