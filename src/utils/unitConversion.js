/**
 * Shared unit conversion helpers.
 */

/**
 * Converts wind speed from metres per second (m/s) to knots.
 * Used wherever wind speed needs to be shown in maritime units.
 *
 * @param {number} ms - Wind speed in metres per second.
 * @returns {number} Wind speed in knots.
 */
export function msToKnots(ms) {
  return ms * 1.94384;
}
