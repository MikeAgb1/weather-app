/**
 * Stormglass tide client.
 * Caches results in localStorage for 3 hours to protect free-tier quota
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

  // Round coordinates so nearby lookups reuse the same cache key.
  const roundedLat = Number(lat).toFixed(3);
  const roundedLon = Number(lon).toFixed(3);

  const cacheKey      = `tide_${roundedLat}_${roundedLon}`;
  const cacheDuration = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

  // Reuse cached data when still fresh.
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

  // Request tide extremes for the next 24 hours
  const start = new Date();
  const end   = new Date();
  end.setHours(end.getHours() + 24);

  const url =
    `https://api.stormglass.io/v2/tide/extremes/point` +
    `?lat=${roundedLat}&lng=${roundedLon}` +
    `&start=${encodeURIComponent(start.toISOString())}` +
    `&end=${encodeURIComponent(end.toISOString())}` +
    `&datum=MSL`;

  try {
    const response = await axios.get(url, {
      headers: { Authorization: API_KEY },
    });

    const data = response.data;

    if (data?.error) {
      // Cache known API failure to avoid repeated quota-consuming retries.
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

    // Cache successful response.
    const timestamp = Date.now();
    localStorage.setItem(cacheKey, JSON.stringify({ timestamp, data }));

    return { ...data, cacheStatus: "live", cachedAt: timestamp };

  } catch (error) {
    const message = axios.isAxiosError(error)
      ? error.response?.data?.errors?.[0]?.message || error.response?.data?.message || error.message
      : error.message;

    console.error("Stormglass request failed:", message);

    // Tide data is optional, return a safe fallback shape on failure
    return {
      data: [],
      cacheStatus: "error",
      cachedAt: Date.now(),
      error: message,
    };
  }
}
