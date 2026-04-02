/**
 * Open-Meteo marine client for current wave conditions.
 * Inland coordinates may fail and are handled by callers.
 */

import axios from "axios";

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
 * @throws {Error} If the API returns an error 
 */
export async function getWaveData(lat, lon) {
  if (lat == null || lon == null) throw new Error("Coordinates required for wave data.");

  const url =
    `https://marine-api.open-meteo.com/v1/marine` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=wave_height,wave_direction,wave_period` +
    `&wind_speed_unit=ms`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    if (data.error) {
      throw new Error(data.reason || "Failed to load wave data.");
    }

    return {
      waveHeight:    data.current?.wave_height    ?? null,
      waveDirection: data.current?.wave_direction ?? null,
      wavePeriod:    data.current?.wave_period    ?? null,
    };
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? error.response?.data?.reason || error.response?.data?.message || error.message
      : error.message;

    throw new Error(message || "Failed to load wave data.");
  }
}
