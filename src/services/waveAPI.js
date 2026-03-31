// Fetches wave height from Open-Meteo Marine API (free, no key needed)
export async function getWaveData(lat, lon) {
  if (lat == null || lon == null) throw new Error("Coordinates required for wave data.");

  const url =
    `https://marine-api.open-meteo.com/v1/marine` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=wave_height,wave_direction,wave_period` +
    `&wind_speed_unit=ms`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.reason || "Failed to load wave data.");
  }

  return {
    waveHeight: data.current?.wave_height ?? null,      // metres
    waveDirection: data.current?.wave_direction ?? null, // degrees
    wavePeriod: data.current?.wave_period ?? null,       // seconds
  };
}
