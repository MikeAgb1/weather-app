/**
 * tideAPI.js
 * Fetches tidal extreme predictions (high/low tide times) from the Stormglass API.
 *
 * Stormglass provides global tidal data but limits the free tier to 10 requests
 * per day.  To avoid exhausting the quota, every successful response is cached
 * in localStorage for 3 hours — subsequent requests within that window return
 * the cached data without hitting the API.
 *
 * The API key is stored in .env as VITE_STORMGLASS_API_KEY and never exposed
 * in the compiled bundle.
 */

import axios from "axios";

/**
 * Retrieves tidal extremes (high and low tides) for the next 24 hours.
 * Returns cached data if a valid cache entry exists to conserve API quota.
 *
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lon - Longitude in decimal degrees.
 * @returns {Promise<{
 *   data: Array<{ time: string, type: "high"|"low" }>,
 *   cacheStatus: "live"|"cached"|"error",
 *   cachedAt: number
 * }>}
 */
export async function getTide(lat, lon) {
  const API_KEY = import.meta.env.VITE_STORMGLASS_API_KEY;

  if (!API_KEY) {
    throw new Error("Stormglass API key is missing.");
  }

  // Round coordinates to 3 decimal places (~100 m precision) so nearby locations
  // share the same cache key and don't waste extra requests.
  const roundedLat = Number(lat).toFixed(3);
  const roundedLon = Number(lon).toFixed(3);

  const cacheKey      = `tide_${roundedLat}_${roundedLon}`;
  const cacheDuration = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

  // Return cached data if it is still within the cache window.
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < cacheDuration) {
      return {
        ...parsed.data,
        cacheStatus: "cached",
        cachedAt: parsed.timestamp,
      };
    }
  }

  // Build the request window: now → now + 24 h.
  const start = new Date();
  const end   = new Date();
  end.setHours(end.getHours() + 24);

  const url =
    `https://api.stormglass.io/v2/tide/extremes/point` +
    `?lat=${roundedLat}&lng=${roundedLon}` +
    `&start=${encodeURIComponent(start.toISOString())}` +
    `&end=${encodeURIComponent(end.toISOString())}` +
    `&datum=MSL`; // Mean Sea Level datum — standard for port operations

  try {
    const response = await axios.get(url, {
      headers: { Authorization: API_KEY },
    });

    const data = response.data;

    if (data?.error) {
      // Cache the failure so the app does not retry within the same window,
      // which would waste more of the daily quota.
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: { error: "quota_or_api_error" },
      }));

      throw new Error(
        data?.errors?.[0]?.message ||
        data?.message ||
        "Failed to load tide data."
      );
    }

    // Cache the successful response.
    const timestamp = Date.now();
    localStorage.setItem(cacheKey, JSON.stringify({ timestamp, data }));

    return { ...data, cacheStatus: "live", cachedAt: timestamp };

  } catch (error) {
    const message = axios.isAxiosError(error)
      ? error.response?.data?.errors?.[0]?.message || error.response?.data?.message || error.message
      : error.message;

    console.error("Stormglass request failed:", message);

    // Return an empty result rather than crashing the app — tide data is
    // supplementary; the safety assessment can still run without it.
    return {
      data: [],
      cacheStatus: "error",
      cachedAt: Date.now(),
      error: message,
    };
  }
}
