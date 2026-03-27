export async function getForecast(city) {
    const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
  
    if (!API_KEY) {
      throw new Error("OpenWeather API key is missing.");
    }
  
    const url =
      `https://api.openweathermap.org/data/2.5/forecast` +
      `?q=${encodeURIComponent(city)}` +
      `&units=metric` +
      `&appid=${API_KEY}`;
  
    const response = await fetch(url);
    const data = await response.json();
  
    if (!response.ok) {
      throw new Error(data?.message || "Failed to load forecast data.");
    }
  
    return data;
  }