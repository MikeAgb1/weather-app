/**
 * unitConversion.js
 * Utility functions for converting between measurement units used across the app.
 * Centralised here so that all components use the same conversion factor.
 */

/**
 * Converts wind speed from metres per second (m/s) to knots.
 * OpenWeatherMap returns wind in m/s; harbour masters work in knots,
 * so every wind value displayed to the user passes through this function.
 *
 * Conversion factor: 1 m/s = 1.94384 knots (exact by definition).
 *
 * @param {number} ms - Wind speed in metres per second.
 * @returns {number} Wind speed in knots.
 */
export function msToKnots(ms) {
  return ms * 1.94384;
}
