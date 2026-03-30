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