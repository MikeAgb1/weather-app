/**
 * iconMapper.js
 * Maps OpenWeatherMap icon codes to local icon filenames.
 *
 * This file is retained for potential offline / local icon use.
 * The live app currently uses the OpenWeatherMap CDN URL directly
 * (https://openweathermap.org/img/wn/<code>@2x.png), but this mapper
 * can serve as a fallback if the CDN is unavailable.
 *
 * Icon codes follow the OpenWeatherMap convention:
 *   01d / 01n = clear sky (day / night)
 *   02d / 02n = few clouds, etc.
 */

/**
 * Returns the local icon filename for a given OWM icon code.
 * Falls back to "default.png" if the code is unrecognised.
 *
 * @param {string} iconCode - OWM icon code, e.g. "01d", "10n".
 * @returns {string} Absolute path to the local icon file.
 */
export function getForecastIcon(iconCode) {
  const iconMap = {
    "01d": "clear-day.png",
    "01n": "clear-night.png",
    "02d": "partly-cloudy-day.png",
    "02n": "partly-cloudy-night.png",
    "03d": "cloudy.png",
    "03n": "cloudy.png",
    "04d": "overcast.png",
    "04n": "overcast.png",
    "09d": "rain.png",
    "09n": "rain.png",
    "10d": "rain-day.png",
    "10n": "rain-night.png",
    "11d": "storm.png",
    "11n": "storm.png",
    "13d": "snow.png",
    "13n": "snow.png",
    "50d": "fog.png",
    "50n": "fog.png",
  };

  return `/icons/${iconMap[iconCode] || "default.png"}`;
}
