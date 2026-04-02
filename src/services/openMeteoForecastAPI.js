/**
 * Open-Meteo forecast client.
 * Merges atmospheric and marine hourly data for the next 24 hours.
 */

import axios from "axios";

// WMO weather code helpers

/**
 * Converts WMO weather codes to OpenWeather-style icon IDs used by the UI.
 *
 * @param {number}  code  - WMO weather code (see https://open-meteo.com/en/docs).
 * @param {boolean} isDay - Whether the time slot is daytime (06:00–20:00).
 * @returns {string} OWM icon code, e.g. "01d", "10n".
 */
function wmoToOwmIcon(code, isDay) {
  const s = isDay ? "d" : "n";
  if (code === 0)                 return `01${s}`; // Clear sky
  if (code <= 2)                  return `02${s}`; // Mainly clear / partly cloudy
  if (code === 3)                 return `04${s}`; // Overcast
  if (code === 45 || code === 48) return `50${s}`; // Fog / rime fog
  if (code <= 55)                 return `09${s}`; // Drizzle (light→dense)
  if (code <= 65)                 return `10${s}`; // Rain (slight→heavy)
  if (code <= 77)                 return `13${s}`; // Snow / snow grains
  if (code <= 82)                 return `09${s}`; // Rain showers
  if (code <= 86)                 return `13${s}`; // Snow showers
  return `11${s}`;                                 // Thunderstorm (95–99)
}

/**
 * Converts a WMO weather code to a short card description.
 *
 * @param {number} code - WMO weather code.
 * @returns {string}
 */
function wmoToDescription(code) {
  const map = {
    0:  "clear sky",
    1:  "mainly clear",
    2:  "partly cloudy",
    3:  "overcast",
    45: "fog",
    48: "rime fog",
    51: "light drizzle",
    53: "moderate drizzle",
    55: "heavy drizzle",
    61: "light rain",
    63: "moderate rain",
    65: "heavy rain",
    71: "light snow",
    73: "moderate snow",
    75: "heavy snow",
    77: "snow grains",
    80: "rain showers",
    81: "moderate showers",
    82: "violent showers",
    85: "snow showers",
    86: "heavy snow showers",
    95: "thunderstorm",
    96: "thunderstorm w/ hail",
    99: "heavy thunderstorm",
  };
  return map[code] ?? "unknown";
}

/**
 * Fetches hourly forecast slots and merges optional marine fields.
 * Marine failures are tolerated so inland locations still return data.
 *
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lon - Longitude in decimal degrees.
 * @returns {Promise<Array<{
 *   time: string,
 *   temp: number,
 *   windMs: number,
 *   windDeg: number|null,
 *   precipitation: number,
 *   visibility: number,
 *   icon: string,
 *   description: string,
 *   waveHeight: number|null,
 *   waveDirection: number|null,
 *   wavePeriod: number|null
 * }>>} Array of hourly slots for the next 24 hours, sorted chronologically.
 * @throws {Error} If the atmospheric forecast request fails.
 */
export async function getHourlyForecast(lat, lon) {
  // Marine request is optional; weather request is required.
  const [weatherSettled, marineSettled] = await Promise.allSettled([
    axios.get(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,visibility,weathercode` +
      `&forecast_days=2&wind_speed_unit=ms&timezone=auto`
    ),
    axios.get(
      `https://marine-api.open-meteo.com/v1/marine` +
      `?latitude=${lat}&longitude=${lon}` +
      `&hourly=wave_height,wave_direction,wave_period` +
      `&forecast_days=2&timezone=auto`
    ),
  ]);

  // Atmospheric data is required.
  if (weatherSettled.status === "rejected") {
    throw new Error("Failed to load hourly forecast.");
  }

  const weatherData = weatherSettled.value.data;
  if (weatherData.error) {
    throw new Error(weatherData.reason || "Failed to load hourly forecast.");
  }

  // Marine data can be unavailable for inland locations.
  const marineData =
    marineSettled.status === "fulfilled" && !marineSettled.value.data?.error
      ? marineSettled.value.data
      : null;

  const { hourly }    = weatherData;
  const marineHourly  = marineData?.hourly;
  const now           = Date.now();
  const cutoff        = now + 24 * 60 * 60 * 1000; // next 24 hours

  return hourly.time
    .map((time, i) => {
      const t    = new Date(time).getTime();
      const hour = new Date(time).getHours();
      const code = hourly.weathercode[i] ?? 0;

      return {
        time,
        temp:          hourly.temperature_2m[i]      ?? 0,
        windMs:        hourly.wind_speed_10m[i]      ?? 0,
        windDeg:       hourly.wind_direction_10m[i]  ?? null,
        precipitation: hourly.precipitation[i]        ?? 0,
        visibility:   (hourly.visibility[i] ?? 10000) / 1000,
        icon:          wmoToOwmIcon(code, hour >= 6 && hour < 20),
        description:   wmoToDescription(code),
        // Keep marine values nullable so callers can branch explicitly.
        waveHeight:    marineHourly?.wave_height?.[i]    ?? null,
        waveDirection: marineHourly?.wave_direction?.[i] ?? null,
        wavePeriod:    marineHourly?.wave_period?.[i]    ?? null,
        _t: t,
      };
    })
    // API returns 2 days; keep only the next 24 hours.
    .filter((item) => item._t > now && item._t <= cutoff);
}
