import "./App.css";
import { useState, useEffect, useCallback } from "react";
import { getWeather } from "./services/weatherAPI";
import { getTide } from "./services/tideAPI";
import { getForecast } from "./services/forecastAPI";
import { calculateSafetyStatus } from "./utils/safetyLogic";
import { msToKnots } from "./utils/unitConversion";
import ForecastPanel from "./components/ForecastPanel";
import ArrivalChecker from "./components/ArrivalChecker";

/* Convert wind direction degrees into compass text */
function getCompassDirection(deg) {
  if (deg === undefined || deg === null) return "N/A";

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(deg / 45) % 8;
  return directions[index];
}

/* Find forecast periods that need operational attention */
function getDangerousPeriods(forecast) {
  const riskySlots = forecast.filter(
    (item) => item.status === "DANGEROUS" || item.status === "MODERATE"
  );

  return riskySlots.map((item) => ({
    time: item.time,
    status: item.status,
    reason: item.reason,
  }));
}

function App() {
  const [weather, setWeather] = useState(null);
  const [tide, setTide] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [city, setCity] = useState(() => {
    return localStorage.getItem("lastCity") || "London";
  });
  const [error, setError] = useState("");
  const [selectedArrival, setSelectedArrival] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const riskPeriods = getDangerousPeriods(forecast);

  useEffect(() => {
    localStorage.setItem("lastCity", city);
  }, [city]);

  useEffect(() => {
    document.documentElement.classList.remove("theme-light", "theme-dark");
    document.documentElement.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const loadWeather = useCallback(async () => {
    try {
      setError("");

      const data = await getWeather(city);
      console.log("Weather API response:", data);

      const visibilityKm = data.visibility ? data.visibility / 1000 : 0;
      const windMs = data.wind?.speed ?? 0;
      const windDeg = data.wind?.deg ?? null;
      const rain1h = data.rain?.["1h"] ?? 0;

      const safety = calculateSafetyStatus(windMs, visibilityKm, rain1h);

      setWeather({
        location: data.name,
        temperature: data.main.temp,
        humidity: data.main.humidity,
        visibility: visibilityKm,
        pressure: data.main.pressure,
        windMs,
        windDirection: getCompassDirection(windDeg),
        precipitation: rain1h,
        description: data.weather?.[0]?.description || "No description available",
        icon: data.weather?.[0]?.icon || "",
        status: safety.status,
        statusClass: safety.statusClass,
        confidence: safety.confidence,
        recommendation: safety.recommendation,
        updatedAt: new Date().toLocaleString(),
        lat: data.coord?.lat ?? null,
        lon: data.coord?.lon ?? null,
      });
    } catch (err) {
      console.error("Weather fetch error:", err);
      setError("Something went wrong while loading weather.");
      setWeather(null);
    }
  }, [city]);

  const loadForecast = useCallback(async () => {
    try {
      const data = await getForecast(city);
      console.log("Forecast API response:", data);

      const now = Date.now();
      const next24Hours = data.list
        .filter((item) => {
          const itemTime = new Date(item.dt_txt).getTime();
          return itemTime > now && itemTime <= now + 24 * 60 * 60 * 1000;
        })
        .map((item) => {
          const visibilityKm = item.visibility ? item.visibility / 1000 : 0;
          const windMs = item.wind?.speed ?? 0;
          const rain3h = item.rain?.["3h"] ?? 0;
          const slotSafety = calculateSafetyStatus(
            windMs,
            visibilityKm,
            rain3h
          );

          return {
            time: item.dt_txt,
            temp: item.main.temp,
            windMs,
            visibility: visibilityKm,
            precipitation: rain3h,
            description: item.weather?.[0]?.description || "No description",
            icon: item.weather?.[0]?.icon || "",
            status: slotSafety.status,
            statusClass: slotSafety.statusClass,
            reason: slotSafety.reason,
          };
        });

      setForecast(next24Hours);
    } catch (err) {
      console.error("Forecast fetch error:", err);
      setForecast([]);
    }
  }, [city]);

  const loadTide = useCallback(async (lat, lon) => {
    if (lat == null || lon == null) return;

    try {
      const tideData = await getTide(lat, lon);
      console.log("Tide API response:", tideData);
      setTide(tideData);
    } catch (err) {
      console.error("Tide fetch error:", err);
      setTide(null);
    }
  }, []);

  /* Live clock */
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  /* Initial load + city change */
  useEffect(() => {
    setTide(null);
    setForecast([]);
    setSelectedArrival("");

    loadWeather();
    loadForecast();
  }, [city, loadWeather, loadForecast]);

  /* Auto-refresh weather every 10 minutes */
  useEffect(() => {
    const interval = setInterval(() => {
      loadWeather();
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadWeather]);

  /* Auto-refresh forecast every 30 minutes */
  useEffect(() => {
    const interval = setInterval(() => {
      loadForecast();
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadForecast]);

  /* Load tide whenever coordinates change */
  useEffect(() => {
    if (!weather || weather.lat == null || weather.lon == null) return;
    loadTide(weather.lat, weather.lon);
  }, [weather?.lat, weather?.lon, loadTide]);

  if (error) {
    return (
      <div className="app-status">
        Error: {error}
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="app-status">
        Loading weather...
      </div>
    );
  }

  return (
    <div className="app">
      <header className="navbar">
        <div className="nav-title">☰ Port Weather Assist</div>

        <input
          className="search"
          type="text"
          placeholder="Search location..."
          defaultValue={city}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.value.trim() !== "") {
              setCity(e.target.value.trim());
            }
          }}
        />

        <div className="nav-right">
          <div className="datetime">{currentTime.toLocaleString()}</div>

          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="conditions-panel">
          <h1>Current Conditions</h1>

          <div className="weather-card">
            <div className="location">{weather.location}</div>

            <div className="temp-row">
              <span className="temp-icon">🌡</span>
              <span className="temperature">
                {weather.temperature.toFixed(1)}°C
              </span>

              {weather.icon ? (
                <img
                  src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                  alt={weather.description}
                  className="api-weather-icon"
                />
              ) : (
                <span className="weather-icon">☁️</span>
              )}
            </div>

            <div className="date-text">{currentTime.toDateString()}</div>
            <div className="weather-description">{weather.description}</div>

            <div className="metrics">
              <div>
                <p className="metric-label">HUMIDITY</p>
                <p className="metric-value">{weather.humidity}%</p>
              </div>

              <div>
                <p className="metric-label">VISIBILITY</p>
                <p className="metric-value">{weather.visibility.toFixed(1)} km</p>
              </div>

              <div>
                <p className="metric-label">AIR PRESSURE</p>
                <p className="metric-value">{weather.pressure} hPa</p>
              </div>

              <div>
                <p className="metric-label">WIND</p>
                <p className="metric-value">
                  {msToKnots(weather.windMs).toFixed(1)} kn
                </p>
              </div>

              <div>
                <p className="metric-label">WIND DIRECTION</p>
                <p className="metric-value">{weather.windDirection}</p>
              </div>

              <div>
                <p className="metric-label">PRECIPITATION</p>
                <p className="metric-value">{weather.precipitation} mm</p>
              </div>
            </div>
          </div>
        </section>

        <aside className="recommendation-panel">
          <h1>Recommendation</h1>

          <div className={`status ${weather.statusClass}`}>
            {weather.status}
          </div>

          <p className="recommendation-text">{weather.recommendation}</p>

          <ul className="recommendation-list">
            <li>Wind: {msToKnots(weather.windMs).toFixed(1)} kn</li>
            <li>Visibility: {weather.visibility.toFixed(1)} km</li>
            <li>Precipitation: {weather.precipitation} mm</li>
            <li>Confidence: {weather.confidence}%</li>
            <li>Weather updated: {weather.updatedAt}</li>

            {tide && tide.data && tide.data.length > 0 ? (
              <>
                <li>
                  Next Tide:{" "}
                  {tide.data[0].type.charAt(0).toUpperCase() +
                    tide.data[0].type.slice(1)}{" "}
                  –{" "}
                  {new Date(tide.data[0].time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </li>
                <li>
                  Tide data source:{" "}
                  {tide.cacheStatus.charAt(0).toUpperCase() +
                    tide.cacheStatus.slice(1)}
                </li>
                <li>
                  Tide updated: {new Date(tide.cachedAt).toLocaleString()}
                </li>
              </>
            ) : (
              <li>Tide data unavailable</li>
            )}
          </ul>

          <p className="disclaimer">
            Decision support only. Final operational judgement remains with the
            harbour master.
          </p>
        </aside>
      </main>

      <section className="risk-panel">
        <h1>Operational Risk Outlook</h1>

        {riskPeriods.length > 0 ? (
          <div className="risk-list">
            {riskPeriods.map((period, index) => (
              <div
                key={index}
                className={`risk-item ${period.status.toLowerCase()}`}
              >
                <p className="risk-time">
                  {new Date(period.time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="risk-status">{period.status}</p>
                <p className="risk-reason">{period.reason}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>No elevated operational risk detected in the next 24 hours.</p>
        )}
      </section>

      <ForecastPanel forecast={forecast} />

      <ArrivalChecker
        forecast={forecast}
        selectedArrival={selectedArrival}
        setSelectedArrival={setSelectedArrival}
      />
    </div>
  );
}

export default App;