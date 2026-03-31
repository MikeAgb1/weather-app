import "./App.css";
import { useState, useEffect, useCallback, useRef } from "react";
import { getWeather } from "./services/weatherAPI";
import { getTide } from "./services/tideAPI";
import { getHourlyForecast } from "./services/openMeteoForecastAPI";
import { getConditionHistory } from "./services/weatherHistoryAPI";
import { getWaveData } from "./services/waveAPI";
import {
  calculateSafetyStatus,
  windMax as defaultWindMax,
  visibilityMin as defaultVisibilityMin,
  precipitationMax as defaultPrecipitationMax,
  waveMax as defaultWaveMax,
  windGustMax as defaultWindGustMax,
  setWindMax,
  setVisibilityMin,
  setPrecipitationMax,
  setWaveMax,
  setWindGustMax,
} from "./utils/safetyLogic";
import { msToKnots } from "./utils/unitConversion";
import ForecastPanel from "./components/ForecastPanel";
import ArrivalChecker from "./components/ArrivalChecker";

function getCompassDirection(deg) {
  if (deg === undefined || deg === null) return "N/A";
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(deg / 45) % 8];
}

function getDangerousPeriods(forecast) {
  return forecast
    .filter((item) => item.status === "DANGEROUS" || item.status === "MODERATE")
    .map((item) => ({ time: item.time, status: item.status, reason: item.reason }));
}

const conditionLabels = {
  humidity: "Humidity",
  visibility: "Visibility",
  pressure: "Air Pressure",
  wind: "Wind Speed",
  windDirection: "Wind Direction",
  precipitation: "Precipitation",
  waveHeight: "Wave Height",
};

function formatHistoryValue(conditionKey, value) {
  if (value == null || Number.isNaN(value)) return "N/A";
  switch (conditionKey) {
    case "humidity": return `${Math.round(value)}%`;
    case "visibility": return `${(value / 1000).toFixed(1)} km`;
    case "pressure": return `${Math.round(value)} hPa`;
    case "wind": return `${msToKnots(value).toFixed(1)} kn`;
    case "windDirection": return `${getCompassDirection(value)} (${Math.round(value)}°)`;
    case "precipitation": return `${value.toFixed(1)} mm`;
    case "waveHeight": return `${value.toFixed(2)} m`;
    default: return `${value}`;
  }
}

/* ─── Tutorial Modal ─── */
function TutorialModal({ onClose }) {
  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true">
      <div className="tutorial-card">
        <div className="tutorial-icon">⚓</div>
        <h2>Welcome to Port Weather Assist</h2>
        <p>Decision support for harbour masters. Here's how to use the app:</p>
        <div className="tutorial-steps">
          {[
            { title: "Search your port", desc: "Type a location in the search bar and press Enter to load live weather data." },
            { title: "Read the safety status", desc: "The Recommendation panel shows SAFE, MODERATE, or DANGEROUS based on current conditions." },
            { title: "Inspect metrics", desc: "Click any metric card (humidity, wind, wave height, etc.) to view its 24-hour history." },
            { title: "Check the forecast", desc: "Scroll down to see the 24-hour forecast and risk outlook timeline." },
            { title: "Set arrival time", desc: "Use the Arrival Assessment panel to check safety for a specific ship arrival time." },
            { title: "Adjust limits", desc: "Customise wind, visibility, wave and precipitation thresholds in Operational Limits to match your port's pilotage directions." },
          ].map((step, i) => (
            <div className="tutorial-step" key={i}>
              <div className="tutorial-step-num">{i + 1}</div>
              <div className="tutorial-step-text">
                <strong>{step.title}</strong>
                <span>{step.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="tutorial-actions">
          <button className="btn btn-primary" onClick={onClose}>Get Started</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Share Modal ─── */
function ShareModal({ weather, tide, onClose }) {
  const [copied, setCopied] = useState(false);
  const timestamp = new Date().toLocaleString();

  const text = [
    "PORT WEATHER ASSIST — CONDITIONS REPORT",
    `Location:      ${weather.location}`,
    `Time:          ${timestamp}`,
    `Status:        ${weather.status} (Confidence: ${weather.confidence}%)`,
    "─".repeat(42),
    `Temperature:   ${weather.temperature.toFixed(1)}°C`,
    `Wind:          ${msToKnots(weather.windMs).toFixed(1)} kn (${weather.windDirection})`,
    `Visibility:    ${weather.visibility.toFixed(1)} km`,
    `Precipitation: ${weather.precipitation} mm`,
    `Humidity:      ${weather.humidity}%`,
    `Pressure:      ${weather.pressure} hPa`,
    weather.waveHeight != null
      ? `Wave Height:   ${weather.waveHeight.toFixed(2)} m`
      : `Wave Height:   Unavailable`,
    tide?.data?.length
      ? `Next Tide:     ${tide.data[0].type.toUpperCase()} at ${new Date(tide.data[0].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "Tide:          Unavailable",
    "─".repeat(42),
    `Note: ${weather.recommendation}`,
    "All recommendations are decision support only. Final operational judgement remains with the harbour master.",
  ].join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Share Conditions</h2>
        <p>Copy a plain-text conditions report to share with crew or log systems.</p>
        <div className="share-preview">
          <div className="sp-title">⚓ PORT WEATHER ASSIST</div>
          <div className={`sp-status ${weather.statusClass}`}>{weather.status}</div>
          <div style={{ marginBottom: 10, fontSize: 11, opacity: 0.6 }}>{weather.location} · {timestamp}</div>
          {[
            ["Wind", `${msToKnots(weather.windMs).toFixed(1)} kn (${weather.windDirection})`],
            ["Visibility", `${weather.visibility.toFixed(1)} km`],
            ["Precipitation", `${weather.precipitation} mm`],
            ["Wave Height", weather.waveHeight != null ? `${weather.waveHeight.toFixed(2)} m` : "N/A"],
            ["Humidity", `${weather.humidity}%`],
            ["Pressure", `${weather.pressure} hPa`],
            ["Confidence", `${weather.confidence}%`],
          ].map(([label, value]) => (
            <div className="sp-row" key={label}>
              <span className="sp-label">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
        <div className="share-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCopy}>
            {copied ? "✓ Copied!" : "Copy to Clipboard"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Report Modal ─── */
function ReportModal({ onClose }) {
  const [type, setType] = useState("inaccuracy");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!details.trim()) return;
    console.log("Issue reported:", { type, details, timestamp: new Date().toISOString() });
    setSubmitted(true);
    setTimeout(onClose, 2000);
  };

  return (
    <div className="report-modal-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="report-success">
            <div className="check">✅</div>
            <h2>Report Submitted</h2>
            <p>Thank you. Your feedback helps improve the system.</p>
          </div>
        ) : (
          <>
            <h2>Report an Issue</h2>
            <p>Help us improve by flagging inaccurate or missing data.</p>
            <div className="report-form-group">
              <label>Issue Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="inaccuracy">Data inaccuracy</option>
                <option value="missing">Missing data</option>
                <option value="safety">Safety status incorrect</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="report-form-group">
              <label>Details</label>
              <textarea
                rows={4}
                placeholder="Describe the issue in as much detail as possible..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>
            <div className="report-actions">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!details.trim()}>
                Submit Report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Risk Outlook Slider ─── */
function RiskOutlook({ riskPeriods }) {
  const scrollRef = useRef(null);
  const scroll = (dir) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="risk-panel">
      <div className="risk-panel-header">
        <h1>Operational Risk Outlook</h1>
        {riskPeriods.length > 0 && (
          <div className="forecast-nav">
            <button type="button" className="forecast-arrow" onClick={() => scroll(-1)} aria-label="Scroll left">‹</button>
            <button type="button" className="forecast-arrow" onClick={() => scroll(1)}  aria-label="Scroll right">›</button>
          </div>
        )}
      </div>
      {riskPeriods.length > 0 ? (
        <div className="risk-slider" ref={scrollRef}>
          {riskPeriods.map((period, i) => (
            <div key={i} className={`risk-card ${period.status.toLowerCase()}`}>
              <p className="risk-time">
                {new Date(period.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="risk-status">{period.status}</p>
              <p className="risk-reason">{period.reason}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-risk">✓ No elevated operational risk detected in the next 24 hours</div>
      )}
    </section>
  );
}

/* ─── Main App ─── */
function App() {
  const [weather, setWeather] = useState(null);
  const [tide, setTide] = useState(null);
  const [waveData, setWaveData] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [city, setCity] = useState(() => localStorage.getItem("lastCity") || "London");
  const [error, setError] = useState("");
  const [selectedArrival, setSelectedArrival] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState("");
  const [conditionHistory, setConditionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyCache, setHistoryCache] = useState({});
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [cachedWeather, setCachedWeather] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [page, setPage] = useState("dashboard");

  // Operational limits
  const [windMaxInput, setWindMaxInput] = useState(defaultWindMax);
  const [visibilityMinInput, setVisibilityMinInput] = useState(defaultVisibilityMin);
  const [precipitationMaxInput, setPrecipitationMaxInput] = useState(defaultPrecipitationMax);
  const [waveMaxInput, setWaveMaxInput] = useState(defaultWaveMax);
  const [windGustMaxInput, setWindGustMaxInput] = useState(defaultWindGustMax);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const riskPeriods = getDangerousPeriods(forecast);

  // Tutorial on first visit
  useEffect(() => {
    if (!localStorage.getItem("tutorialSeen")) setTutorialOpen(true);
  }, []);

  const closeTutorial = () => {
    setTutorialOpen(false);
    localStorage.setItem("tutorialSeen", "1");
  };

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Theme — fixes dark/light mode text colour issue by using CSS variables throughout
  useEffect(() => {
    document.documentElement.classList.remove("theme-light", "theme-dark");
    document.documentElement.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Persist city
  useEffect(() => {
    localStorage.setItem("lastCity", city);
  }, [city]);

  // Escape closes modals
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        setHistoryModalOpen(false);
        setShareOpen(false);
        setReportOpen(false);
        setTutorialOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // FIX: Only apply limits when they change, using a ref to track previous values
  const latLonRef = useRef({ lat: null, lon: null });

  const prevLimits = useRef({
    windMaxInput, visibilityMinInput, precipitationMaxInput, waveMaxInput, windGustMaxInput
  });

  useEffect(() => {
    const prev = prevLimits.current;
    const changed =
      Number(windMaxInput) !== prev.windMaxInput ||
      Number(visibilityMinInput) !== prev.visibilityMinInput ||
      Number(precipitationMaxInput) !== prev.precipitationMaxInput ||
      Number(waveMaxInput) !== prev.waveMaxInput ||
      Number(windGustMaxInput) !== prev.windGustMaxInput;

    if (changed) {
      setWindMax(Number(windMaxInput));
      setVisibilityMin(Number(visibilityMinInput));
      setPrecipitationMax(Number(precipitationMaxInput));
      setWaveMax(Number(waveMaxInput));
      setWindGustMax(Number(windGustMaxInput));
      prevLimits.current = {
        windMaxInput: Number(windMaxInput),
        visibilityMinInput: Number(visibilityMinInput),
        precipitationMaxInput: Number(precipitationMaxInput),
        waveMaxInput: Number(waveMaxInput),
        windGustMaxInput: Number(windGustMaxInput),
      };
      if (latLonRef.current.lat != null) loadForecast();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windMaxInput, visibilityMinInput, precipitationMaxInput, waveMaxInput, windGustMaxInput]);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCitySearch = (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      setCity(e.target.value.trim());
    }
  };

  const loadWeather = useCallback(async () => {
    if (isOffline) {
      const cached = localStorage.getItem(`weather_${city}`);
      if (cached) setCachedWeather(JSON.parse(cached));
      return;
    }
    setIsFetching(true);
    try {
      setError("");
      const data = await getWeather(city);
      const visibilityKm = data.visibility ? data.visibility / 1000 : 0;
      const windMs = data.wind?.speed ?? 0;
      const windDeg = data.wind?.deg ?? null;
      const rain1h = data.rain?.["1h"] ?? 0;
      const safety = calculateSafetyStatus(windMs, visibilityKm, rain1h, null);

      const weatherData = {
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
        confidenceFactors: safety.confidenceFactors,
        recommendation: safety.recommendation,
        updatedAt: new Date().toLocaleString(),
        lat: data.coord?.lat ?? null,
        lon: data.coord?.lon ?? null,
        waveHeight: null,
      };

      latLonRef.current = { lat: weatherData.lat, lon: weatherData.lon };
      setWeather(weatherData);
      setCachedWeather(null);
      localStorage.setItem(`weather_${city}`, JSON.stringify({ ...weatherData, cachedAt: Date.now() }));
    } catch (err) {
      console.error("Weather fetch error:", err);
      const cached = localStorage.getItem(`weather_${city}`);
      if (cached) setCachedWeather(JSON.parse(cached));
      setError("Location not found. Please try another city.");
    } finally {
      setIsFetching(false);
    }
  }, [city, isOffline]);

  const loadForecast = useCallback(async () => {
    const { lat, lon } = latLonRef.current;
    if (lat == null || lon == null || isOffline) return;
    try {
      const items = await getHourlyForecast(lat, lon);
      setForecast(
        items.map((item) => {
          const slotSafety = calculateSafetyStatus(item.windMs, item.visibility, item.precipitation, item.waveHeight);
          return {
            ...item,
            status: slotSafety.status,
            statusClass: slotSafety.statusClass,
            reason: slotSafety.reason,
            confidence: slotSafety.confidence,
          };
        })
      );
    } catch (err) {
      console.error("Hourly forecast fetch error:", err);
      setForecast([]);
    }
  }, [isOffline]);

  const loadTide = useCallback(async (lat, lon) => {
    if (lat == null || lon == null || isOffline) return;
    try {
      const tideData = await getTide(lat, lon);
      setTide(tideData);
    } catch (err) {
      console.error("Tide fetch error:", err);
      setTide(null);
    }
  }, [isOffline]);

  const loadWaves = useCallback(async (lat, lon) => {
    if (lat == null || lon == null || isOffline) return;
    try {
      const data = await getWaveData(lat, lon);
      setWaveData(data);
      // Update weather state to include wave height so safety can use it
      setWeather((prev) => {
        if (!prev) return prev;
        const safety = calculateSafetyStatus(prev.windMs, prev.visibility, prev.precipitation, data.waveHeight);
        return {
          ...prev,
          waveHeight: data.waveHeight,
          waveDirection: data.waveDirection,
          wavePeriod: data.wavePeriod,
          status: safety.status,
          statusClass: safety.statusClass,
          confidence: safety.confidence,
          confidenceFactors: safety.confidenceFactors,
          recommendation: safety.recommendation,
        };
      });
    } catch (err) {
      console.error("Wave fetch error:", err);
      setWaveData(null);
    }
  }, [isOffline]);

  // City change: reset + reload weather (forecast loads after lat/lon are known)
  useEffect(() => {
    latLonRef.current = { lat: null, lon: null };
    setTide(null);
    setWaveData(null);
    setForecast([]);
    setSelectedArrival("");
    setHistoryModalOpen(false);
    setSelectedCondition("");
    setConditionHistory([]);
    setHistoryError("");
    setHistoryCache({});
    loadWeather();
  }, [city, loadWeather]);

  // Auto-refresh
  useEffect(() => {
    const i = setInterval(loadWeather, 10 * 60 * 1000);
    return () => clearInterval(i);
  }, [loadWeather]);

  useEffect(() => {
    const i = setInterval(() => {
      if (latLonRef.current.lat != null) loadForecast();
    }, 30 * 60 * 1000);
    return () => clearInterval(i);
  }, [loadForecast]);

  // Load tide, waves, and hourly forecast when coordinates are known
  useEffect(() => {
    if (!weather || weather.lat == null) return;
    loadTide(weather.lat, weather.lon);
    loadWaves(weather.lat, weather.lon);
    loadForecast();
  }, [weather?.lat, weather?.lon, loadTide, loadWaves, loadForecast]);

  const handleOpenHistory = async (conditionKey) => {
    const w = weather || cachedWeather;
    if (!w || w.lat == null) return;
    setSelectedCondition(conditionKey);
    setHistoryModalOpen(true);
    setHistoryError("");

    const cacheKey = `${w.lat},${w.lon}:${conditionKey}`;
    if (historyCache[cacheKey]) {
      setConditionHistory(historyCache[cacheKey]);
      return;
    }
    setConditionHistory([]);
    setHistoryLoading(true);
    try {
      const data = await getConditionHistory(w.lat, w.lon, conditionKey);
      setConditionHistory(data);
      setHistoryCache((prev) => ({ ...prev, [cacheKey]: data }));
    } catch (err) {
      setHistoryError("Unable to load 24-hour history right now.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const displayWeather = weather || cachedWeather;

  function renderNavbar() {
    return (
      <header className="navbar">
        <div className="nav-title">
          ⚓ Port Weather Assist
          <span>Decision Support</span>
        </div>
        <input
          className="search"
          type="text"
          placeholder="Search port or city…"
          defaultValue={city}
          onKeyDown={handleCitySearch}
        />
        <div className="nav-right">
          <div className="datetime">{currentTime.toLocaleString()}</div>
          <button type="button" className="nav-icon-btn" onClick={() => setTutorialOpen(true)}>
            ? Help
          </button>
          <button type="button" className="nav-icon-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </header>
    );
  }

  function renderPageTabs() {
    return (
      <nav className="page-tabs">
        {[
          { id: "dashboard", label: "Dashboard" },
          { id: "forecast",  label: "Forecast" },
          { id: "planning",  label: "Planning" },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`page-tab${page === id ? " active" : ""}`}
            onClick={() => setPage(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    );
  }

  if (!displayWeather) {
    return (
      <div className="app">
        {renderNavbar()}
        {renderPageTabs()}
        <div className="app-status">
          {error ? `⚠ ${error}` : "Loading weather data…"}
        </div>
      </div>
    );
  }

  // Build metric cards — including wave height
  const metricCards = [
    { key: "humidity", label: "Humidity", value: `${displayWeather.humidity}%` },
    { key: "visibility", label: "Visibility", value: `${displayWeather.visibility.toFixed(1)} km` },
    { key: "pressure", label: "Pressure", value: `${displayWeather.pressure} hPa` },
    { key: "wind", label: "Wind", value: `${msToKnots(displayWeather.windMs).toFixed(1)} kn` },
    { key: "windDirection", label: "Direction", value: displayWeather.windDirection },
    { key: "precipitation", label: "Precip.", value: `${displayWeather.precipitation} mm` },
    {
      key: "waveHeight",
      label: "Wave Ht.",
      value: displayWeather.waveHeight != null ? `${displayWeather.waveHeight.toFixed(2)} m` : "N/A",
    },
  ];

  return (
    <div className="app">
      {tutorialOpen && <TutorialModal onClose={closeTutorial} />}

      {renderNavbar()}
      {renderPageTabs()}

      {isOffline && (
        <div className="offline-banner">
          ⚠ Offline Mode — showing cached data
          {cachedWeather?.cachedAt && ` · Last updated ${new Date(cachedWeather.cachedAt).toLocaleString()}`}
        </div>
      )}

      {error && !isOffline && <div className="error-banner">⚠ {error}</div>}

      {/* ── Dashboard page ── */}
      {page === "dashboard" && <main className="dashboard">
        {/* Current Conditions */}
        <section className="conditions-panel">
          <div className="panel-header">
            <h1 style={{ margin: 0 }}>Current Conditions</h1>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`btn${isFetching ? " btn-fetching" : ""}`}
                disabled={isFetching || isOffline}
                onClick={() => {
                  loadWeather();
                  loadForecast();
                  if (displayWeather?.lat != null) {
                    loadTide(displayWeather.lat, displayWeather.lon);
                    loadWaves(displayWeather.lat, displayWeather.lon);
                  }
                }}
                title="Refresh all data"
              >
                <span className={isFetching ? "spin-icon" : ""}>↻</span> {isFetching ? "Refreshing…" : "Refresh"}
              </button>
              <button type="button" className="btn" onClick={() => setReportOpen(true)}>
                🚩 Report Issue
              </button>
            </div>
          </div>
          <div className="weather-card">
            <div>
              <div className="location">📍 {displayWeather.location}</div>
              <div className="date-text" style={{ marginTop: 6 }}>{currentTime.toDateString()}</div>
            </div>
            <div className="temp-row">
              <span className="temperature">{displayWeather.temperature.toFixed(1)}°C</span>
              {displayWeather.icon ? (
                <img
                  src={`https://openweathermap.org/img/wn/${displayWeather.icon}@2x.png`}
                  alt={displayWeather.description}
                  className="api-weather-icon"
                />
              ) : (
                <span className="weather-icon">☁️</span>
              )}
            </div>
            <div className="weather-description">{displayWeather.description}</div>
            <div className="metrics">
              {metricCards.map(({ key, label, value }) => (
                <button
                  key={key}
                  type="button"
                  className="metric-button"
                  onClick={() => handleOpenHistory(key)}
                  title="Click to view 24hr history"
                >
                  <p className="metric-label">{label}</p>
                  <p className="metric-value">{value}</p>
                  <p className="metric-hint">tap for history</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Recommendation */}
        <aside className="recommendation-panel">
          <h1>Recommendation</h1>
          <div className={`status-badge ${displayWeather.statusClass}`}>
            <div className="status-dot" />
            {displayWeather.status}
          </div>
          <p className="recommendation-text">{displayWeather.recommendation}</p>

          {/* Confidence with breakdown */}
          <div className="confidence-block">
            <div className="confidence-header">
              <span>Confidence</span>
              <strong>{displayWeather.confidence}%</strong>
            </div>
            <div className="confidence-bar-track">
              <div
                className={`confidence-bar-fill ${displayWeather.statusClass}`}
                style={{ width: `${displayWeather.confidence}%` }}
              />
            </div>
            {displayWeather.confidenceFactors?.length > 0 && (
              <ul className="confidence-factors">
                {displayWeather.confidenceFactors.map((f, i) => (
                  <li key={i}>⚠ {f}</li>
                ))}
              </ul>
            )}
          </div>

          <ul className="rec-list">
            <li><span>Wind</span><strong>{msToKnots(displayWeather.windMs).toFixed(1)} kn ({displayWeather.windDirection})</strong></li>
            <li><span>Visibility</span><strong>{displayWeather.visibility.toFixed(1)} km</strong></li>
            <li><span>Precipitation</span><strong>{displayWeather.precipitation} mm</strong></li>
            <li>
              <span>Wave Height</span>
              <strong>{displayWeather.waveHeight != null ? `${displayWeather.waveHeight.toFixed(2)} m` : "N/A"}</strong>
            </li>
            {displayWeather.wavePeriod != null && (
              <li><span>Wave Period</span><strong>{displayWeather.wavePeriod.toFixed(1)} s</strong></li>
            )}
            {displayWeather.waveDirection != null && (
              <li><span>Wave Dir.</span><strong>{getCompassDirection(displayWeather.waveDirection)} ({Math.round(displayWeather.waveDirection)}°)</strong></li>
            )}
            <li><span>Updated</span><strong style={{ fontSize: 11 }}>{displayWeather.updatedAt}</strong></li>
            {tide?.data?.length > 0 ? (
              <>
                <li>
                  <span>Next Tide</span>
                  <strong>
                    {tide.data[0].type.charAt(0).toUpperCase() + tide.data[0].type.slice(1)}
                    {" – "}
                    {new Date(tide.data[0].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </strong>
                </li>
              </>
            ) : (
              <li><span>Tide</span><strong>Unavailable</strong></li>
            )}
          </ul>

          <div className="rec-actions">
            <button type="button" className="btn btn-primary" onClick={() => setShareOpen(true)}>
              📋 Share Conditions
            </button>
          </div>

          <p className="disclaimer">
            Decision support only. All recommendations are based on predictions and are not 100% accurate.
            Final operational judgement remains with the harbour master.
          </p>
        </aside>
      </main>}

      {/* Risk Outlook — also on dashboard */}
      {page === "dashboard" && (
        <RiskOutlook riskPeriods={riskPeriods} />
      )}

      {/* ── Forecast page ── */}
      {page === "forecast" && <ForecastPanel forecast={forecast} />}

      {/* ── Planning page ── */}
      {page === "planning" && (
        <div className="bottom-panels">
          <ArrivalChecker
            forecast={forecast}
            selectedArrival={selectedArrival}
            setSelectedArrival={setSelectedArrival}
          />

          <section className="limits-panel">
            <h1>Operational Limits</h1>
            <div className="limits-grid">
              <div className="limit-item">
                <label>Max Wind Speed (kn)</label>
                <input type="number" value={windMaxInput} placeholder="e.g. 12" min="0"
                  onChange={(e) => setWindMaxInput(Math.max(0, Number(e.target.value)))} />
              </div>
              <div className="limit-item">
                <label>Max Wind Gust (kn)</label>
                <input type="number" value={windGustMaxInput} placeholder="e.g. 18" min="0"
                  onChange={(e) => setWindGustMaxInput(Math.max(0, Number(e.target.value)))} />
              </div>
              <div className="limit-item">
                <label>Min Visibility (km)</label>
                <input type="number" value={visibilityMinInput} placeholder="e.g. 3" min="0"
                  onChange={(e) => setVisibilityMinInput(Math.max(0, Number(e.target.value)))} />
              </div>
              <div className="limit-item">
                <label>Max Precipitation (mm)</label>
                <input type="number" value={precipitationMaxInput} placeholder="e.g. 8" min="0"
                  onChange={(e) => setPrecipitationMaxInput(Math.max(0, Number(e.target.value)))} />
              </div>
              <div className="limit-item">
                <label>Max Wave Height (m)</label>
                <input type="number" value={waveMaxInput} placeholder="e.g. 2.5" min="0" step="0.1"
                  onChange={(e) => setWaveMaxInput(Math.max(0, Number(e.target.value)))} />
              </div>
            </div>
            <p className="limits-note">
              Thresholds update the safety assessment immediately. Set values to match your port's pilotage directions.
            </p>
          </section>
        </div>
      )}

      {/* History Modal */}
      {historyModalOpen && (
        <div
          className="history-modal-overlay"
          role="presentation"
          onClick={() => setHistoryModalOpen(false)}
        >
          <section
            className="history-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Weather condition history"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="history-modal-header">
              <h2>{conditionLabels[selectedCondition] || "Condition"} — Last 24 Hours</h2>
              <button type="button" className="history-close" onClick={() => setHistoryModalOpen(false)} aria-label="Close">×</button>
            </div>
            {historyLoading && <p style={{ color: "var(--muted-text)" }}>Loading history…</p>}
            {!historyLoading && historyError && <p style={{ color: "var(--dangerous-color)" }}>{historyError}</p>}
            {!historyLoading && !historyError && conditionHistory.length === 0 && (
              <p style={{ color: "var(--muted-text)" }}>No historical data found for this condition.</p>
            )}
            {!historyLoading && !historyError && conditionHistory.length > 0 && (() => {
              const vals = conditionHistory.map((e) => e.value).filter((v) => v != null && !isNaN(v));
              const minVal = Math.min(...vals);
              const maxVal = Math.max(...vals);
              const range = maxVal - minVal || 1;
              return (
                <>
                  <div className="history-spark" aria-hidden="true">
                    {conditionHistory.map((entry, i) => (
                      <div
                        key={i}
                        className="history-spark-bar"
                        style={{ height: `${Math.max(6, ((entry.value - minVal) / range) * 100)}%` }}
                        title={`${formatHistoryValue(selectedCondition, entry.value)} · ${new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                      />
                    ))}
                  </div>
                  <div className="history-list">
                    {conditionHistory.map((entry) => (
                      <div key={entry.time} className="history-row">
                        <span>{new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <strong>{formatHistoryValue(selectedCondition, entry.value)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </section>
        </div>
      )}

      {shareOpen && <ShareModal weather={displayWeather} tide={tide} onClose={() => setShareOpen(false)} />}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
    </div>
  );
}

export default App;
