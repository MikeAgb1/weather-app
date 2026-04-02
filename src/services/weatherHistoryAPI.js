/**
 * Open-Meteo historical condition client.
 * Uses archive data for weather fields and marine data for wave height.
 */

import axios from "axios";

// Maps UI condition keys to Open-Meteo hourly field names.
const conditionToHourlyField = {
  humidity:      "relative_humidity_2m",
  visibility:    "visibility",
  pressure:      "pressure_msl",
  wind:          "wind_speed_10m",
  windDirection: "wind_direction_10m",
  precipitation: "precipitation",
  waveHeight:    "wave_height",
};

/**
 * Formats a Date object as a YYYY-MM-DD string required by the Open-Meteo API.
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

/**
 * Fetches the hourly history for one condition at a given location.
 * Returns only data points from the past 24 hours with non-null values.
 *
 * @param {number} lat          - Latitude in decimal degrees.
 * @param {number} lon          - Longitude in decimal degrees.
 * @param {string} conditionKey - One of the keys in conditionToHourlyField.
 * @returns {Promise<Array<{ time: string, value: number }>>}
 *   Array of hourly readings sorted chronologically.
 * @throws {Error} If the condition key is unsupported or the API request fails.
 */
export async function getConditionHistory(lat, lon, conditionKey) {
  const hourlyField = conditionToHourlyField[conditionKey];

  if (!hourlyField) {
    throw new Error(`Unsupported condition key: ${conditionKey}`);
  }

  const now       = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Wave height uses the marine endpoint; all others use archive.
  let url;
  if (conditionKey === "waveHeight") {
    url =
      `https://marine-api.open-meteo.com/v1/marine` +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&hourly=${hourlyField}` +
      `&start_date=${formatDate(yesterday)}` +
      `&end_date=${formatDate(now)}` +
      `&timezone=auto`;
  } else {
    url =
      `https://archive-api.open-meteo.com/v1/archive` +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&start_date=${formatDate(yesterday)}` +
      `&end_date=${formatDate(now)}` +
      `&hourly=${hourlyField}` +
      `&timezone=auto`;
  }

  try {
    const response = await axios.get(url);
    const data     = response.data;

    if (data.error) {
      throw new Error(data?.reason || "Failed to load condition history.");
    }

    const times  = data?.hourly?.time         || [];
    const values = data?.hourly?.[hourlyField] || [];
    const cutoff = now.getTime() - 24 * 60 * 60 * 1000;

    // Keep only valid points in the exact trailing 24-hour window.
    return times
      .map((time, index) => ({ time, value: values[index] }))
      .filter((item) => {
        const timeMs = new Date(item.time).getTime();
        return (
          item.value !== null &&
          !Number.isNaN(item.value) &&
          timeMs >= cutoff &&
          timeMs <= now.getTime()
        );
      });
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? error.response?.data?.reason || error.response?.data?.message || error.message
      : error.message;

    throw new Error(message || "Failed to load condition history.");
  }
}
