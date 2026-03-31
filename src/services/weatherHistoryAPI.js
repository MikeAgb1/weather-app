const conditionToHourlyField = {
  humidity: "relative_humidity_2m",
  visibility: "visibility",
  pressure: "pressure_msl",
  wind: "wind_speed_10m",
  windDirection: "wind_direction_10m",
  precipitation: "precipitation",
  waveHeight: "wave_height",
};

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

export async function getConditionHistory(lat, lon, conditionKey) {
  const hourlyField = conditionToHourlyField[conditionKey];

  if (!hourlyField) {
    throw new Error(`Unsupported condition key: ${conditionKey}`);
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Wave height uses the Marine API, everything else uses the Archive API
  let url;
  if (conditionKey === "waveHeight") {
    url =
      `https://marine-api.open-meteo.com/v1/marine` +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&hourly=${hourlyField}` +
      `&start_date=${formatDate(yesterday)}` +
      `&end_date=${formatDate(now)}` +
      `&timezone=auto`;
  } else {
    url =
      `https://archive-api.open-meteo.com/v1/archive` +
      `?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&start_date=${formatDate(yesterday)}` +
      `&end_date=${formatDate(now)}` +
      `&hourly=${hourlyField}` +
      `&timezone=auto`;
  }

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.reason || "Failed to load condition history.");
  }

  const times = data?.hourly?.time || [];
  const values = data?.hourly?.[hourlyField] || [];
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;

  return times
    .map((time, index) => ({ time, value: values[index] }))
    .filter((item) => {
      const timeMs = new Date(item.time).getTime();
      return (
        item.value !== null &&
        !Number.isNaN(item.value) &&
        timeMs >= cutoff &&
        timeMs <= now.getTime()
      );
    });
}
