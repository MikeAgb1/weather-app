// WMO weather code → OpenWeatherMap-compatible icon code
function wmoToOwmIcon(code, isDay) {
  const s = isDay ? "d" : "n";
  if (code === 0)                 return `01${s}`;
  if (code <= 2)                  return `02${s}`;
  if (code === 3)                 return `04${s}`;
  if (code === 45 || code === 48) return `50${s}`;
  if (code <= 55)                 return `09${s}`; // drizzle
  if (code <= 65)                 return `10${s}`; // rain
  if (code <= 77)                 return `13${s}`; // snow
  if (code <= 82)                 return `09${s}`; // showers
  if (code <= 86)                 return `13${s}`; // snow showers
  return `11${s}`;                                 // thunderstorm
}

function wmoToDescription(code) {
  const map = {
    0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "rime fog",
    51: "light drizzle", 53: "moderate drizzle", 55: "heavy drizzle",
    61: "light rain", 63: "moderate rain", 65: "heavy rain",
    71: "light snow", 73: "moderate snow", 75: "heavy snow", 77: "snow grains",
    80: "rain showers", 81: "moderate showers", 82: "violent showers",
    85: "snow showers", 86: "heavy snow showers",
    95: "thunderstorm", 96: "thunderstorm w/ hail", 99: "heavy thunderstorm",
  };
  return map[code] ?? "unknown";
}

/**
 * Fetches an hourly 24-hour forecast from Open-Meteo (weather + marine).
 * Marine API may return an error for inland locations — wave fields will be null in that case.
 */
export async function getHourlyForecast(lat, lon) {
  const [weatherSettled, marineSettled] = await Promise.allSettled([
    fetch(
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,visibility,weathercode` +
      `&forecast_days=2&wind_speed_unit=ms&timezone=auto`
    ),
    fetch(
      `https://marine-api.open-meteo.com/v1/marine` +
      `?latitude=${lat}&longitude=${lon}` +
      `&hourly=wave_height,wave_direction,wave_period` +
      `&forecast_days=2&timezone=auto`
    ),
  ]);

  if (weatherSettled.status === "rejected") {
    throw new Error("Failed to load hourly forecast.");
  }

  const weatherData = await weatherSettled.value.json();
  if (!weatherSettled.value.ok || weatherData.error) {
    throw new Error(weatherData.reason || "Failed to load hourly forecast.");
  }

  const marineData =
    marineSettled.status === "fulfilled" && marineSettled.value.ok
      ? await marineSettled.value.json()
      : null;

  const { hourly } = weatherData;
  const marineHourly = marineData?.hourly;
  const now = Date.now();
  const cutoff = now + 24 * 60 * 60 * 1000;

  return hourly.time
    .map((time, i) => {
      const t = new Date(time).getTime();
      const hour = new Date(time).getHours();
      const code = hourly.weathercode[i] ?? 0;
      return {
        time,
        temp: hourly.temperature_2m[i] ?? 0,
        windMs: hourly.wind_speed_10m[i] ?? 0,
        windDeg: hourly.wind_direction_10m[i] ?? null,
        precipitation: hourly.precipitation[i] ?? 0,
        visibility: (hourly.visibility[i] ?? 10000) / 1000, // m → km
        icon: wmoToOwmIcon(code, hour >= 6 && hour < 20),
        description: wmoToDescription(code),
        waveHeight: marineHourly?.wave_height?.[i] ?? null,
        waveDirection: marineHourly?.wave_direction?.[i] ?? null,
        wavePeriod: marineHourly?.wave_period?.[i] ?? null,
        _t: t,
      };
    })
    .filter((item) => item._t > now && item._t <= cutoff);
}
