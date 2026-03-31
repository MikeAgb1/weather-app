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
  if (!iconCode) return "/icons/01d@2x.png";
  return `/icons/${iconCode}@2x.png`;
}