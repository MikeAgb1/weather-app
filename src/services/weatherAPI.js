/**
 * weatherAPI.js
 * Fetches real-time weather conditions from the OpenWeatherMap "Current Weather" endpoint.
 *
 * The API key is stored in the .env file as VITE_OPENWEATHER_API_KEY and injected
 * at build time by Vite — it is never exposed in the compiled bundle as a plain string.
 *
 * Units are set to "metric" so temperatures come back in °C and wind in m/s.
 * Wind is later converted to knots in App.jsx via msToKnots().
 */

import axios from "axios";

/**
 * Retrieves current weather data for a named city.
 *
 * @param {string} city - City name as typed by the user (e.g. "Portsmouth").
 * @returns {Promise<Object>} Raw OpenWeatherMap response object containing
 *   main (temp, humidity, pressure), wind, visibility, rain, weather[], coord, etc.
 * @throws {Error} If the API key is missing or the city is not found.
 */
export async function getWeather(city) {
  const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

  if (!API_KEY) {
    throw new Error("OpenWeather API key is missing.");
  }

  const url =
    `https://api.openweathermap.org/data/2.5/weather` +
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

    // OWM returns HTTP 404 for unknown cities and 401 for bad keys.
    throw new Error(message || "Failed to load weather data.");
  }
}
