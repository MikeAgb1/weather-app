/**
 * OpenWeather current conditions client.
 * Uses metric units (C, m/s) and returns the raw API data
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

    // Preserve upstream API error text where possible.
    throw new Error(message || "Failed to load weather data.");
  }
}
