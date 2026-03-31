/**
 * forecastAPI.js
 * Fetches the 5-day / 3-hourly forecast from the OpenWeatherMap Forecast endpoint.
 *
 * NOTE: This file is no longer used as the primary forecast source.
 * The app switched to Open-Meteo (openMeteoForecastAPI.js) which provides
 * truly hourly data and includes wave height — both unavailable in the free
 * OWM forecast tier.  This file is kept for reference and as a fallback.
 */

/**
 * Retrieves a 5-day forecast in 3-hour intervals for a named city.
 *
 * @param {string} city - City name (e.g. "Southampton").
 * @returns {Promise<Object>} Raw OWM response with a `list` array of forecast slots.
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

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load forecast data.");
  }

  return data;
}
