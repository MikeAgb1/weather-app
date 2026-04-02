/**
 * Legacy OpenWeather forecast client (5-day, 3-hour intervals).
 * Kept as a fallback/reference after migrating to Open-Meteo hourly forecast.
 */

import axios from "axios";

/**
 * Retrieves a 5-day forecast in 3-hour intervals for a named city.
 *
 * @param {string} city - City name
 * @returns {Promise<Object>} Raw API response with a `list` array of forecast slots.
 * @throws {Error} If the API key is missing or the request fails.
 */
export async function getForecast(city) {
  const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

  if (!API_KEY) {
    throw new Error("OpenWeather API key is missing.");
  }

  const url =
    `https://api.openweathermap.org/data/2.5/forecast` +
    `?q=${encodeURIComponent(city)}` +
    `&units=metric` +
    `&appid=${API_KEY}`;

  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? error.response?.data?.message
      : null;

    throw new Error(message || "Failed to load forecast data.");
  }
}
