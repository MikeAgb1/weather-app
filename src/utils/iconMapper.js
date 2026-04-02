/**
 * Maps OpenWeather-style icon codes to local asset paths.
 * Keeps a local fallback path available if CDN usage changes.
 */

/**
 * Returns the local icon filename for a given OWM icon code.
 * Falls back to a default clear-sky icon if no code is provided.
 *
 * @param {string} iconCode - OWM icon code, e.g. "01d", "10n".
 * @returns {string} Absolute path to the local icon file.
 */
export function getForecastIcon(iconCode) {
  if (!iconCode) return "/icons/01d@2x.png";
  return `/icons/${iconCode}@2x.png`;
}