/**
 * App.jsx
 * Root component for Port Weather Assist.
 *
 * Responsibilities:
 *  - Fetches and coordinates data from four APIs: OpenWeatherMap (current conditions),
 *    Open-Meteo (hourly forecast + waves), Stormglass (tide extremes), and
 *    Open-Meteo Marine (current wave state).
 *  - Runs the safety assessment (safetyLogic.js) on both current and forecast data.
 *  - Manages all application state: weather, forecast, tides, wave data, UI state,
 *    operational limits, theme, and page navigation.
 *  - Renders three pages (Dashboard / Forecast / Planning) via a tab bar,
 *    plus modal overlays (tutorial, share, report, history).
 */

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
  setWindMax,
  setVisibilityMin,
  setPrecipitationMax,
  setWaveMax,
} from "./utils/safetyLogic";
import { msToKnots } from "./utils/unitConversion";
import ForecastPanel from "./components/ForecastPanel";
import ArrivalChecker from "./components/ArrivalChecker";

// ── Utility helpers ──────────────────────────────────────────────────────────

/**
 * Converts a bearing in degrees to an 8-point compass label.
 * Used for wind direction and wave direction display.
 * @param {number|null} deg - Bearing in degrees (0 = North).
 * @returns {string} e.g. "NE", "SW", or "N/A" if no data.
 */
function getCompassDirection(deg) {
  if (deg === undefined || deg === null) return "N/A";
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(deg / 45) % 8];
}

/**
 * Extracts forecast slots rated MODERATE or DANGEROUS for the Risk Outlook panel.
 * @param {Array} forecast - Enriched hourly forecast array.
 * @returns {Array<{ time, status, reason }>}
 */
function getDangerousPeriods(forecast) {
  return forecast
    .filter((item) => item.status === "DANGEROUS" || item.status === "MODERATE")
    .map((item) => ({ time: item.time, status: item.status, reason: item.reason }));
}

/** Human-readable labels for each metric key used in the history modal title. */
const conditionLabels = {
  humidity:      "Humidity",
  visibility:    "Visibility",
  pressure:      "Air Pressure",
  wind:          "Wind Speed",
  windDirection: "Wind Direction",
  precipitation: "Precipitation",
  waveHeight:    "Wave Height",
};

/**
 * Formats a raw API value for display in the history modal list.
 * Each condition requires different units and decimal precision.
 * @param {string} conditionKey - One of the keys in conditionLabels.
 * @param {number} value        - Raw value from the Open-Meteo API.
 * @returns {string} Formatted string with units.
 */
function formatHistoryValue(conditionKey, value) {
  if (value == null || Number.isNaN(value)) return "N/A";
  switch (conditionKey) {
    case "humidity":      return `${Math.round(value)}%`;
    case "visibility":    return `${(value / 1000).toFixed(1)} km`;
    case "pressure":      return `${Math.round(value)} hPa`;
    case "wind":          return `${msToKnots(value).toFixed(1)} kn`;
    case "windDirection": return `${getCompassDirection(value)} (${Math.round(value)}°)`;
    case "precipitation": return `${value.toFixed(1)} mm`;
    case "waveHeight":    return `${value.toFixed(2)} m`;
    default:              return `${value}`;
  }
}

// ── Modal components ────────────────────────────────────────────────────────
// Each modal is a self-contained component to keep App() readable.
// They receive only the props they need and call onClose to dismiss themselves.

/* ─── Tutorial Modal ───────────────────────────────────────────────────────
 * Shown on first visit (localStorage flag "tutorialSeen" not set).
 * Walks the user through the six main features of the app.
 * ─────────────────────────────────────────────────────────────────────────── */
function TutorialModal({ onClose }) {
  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true">
      <div className="tutorial-card">
        <div className="tutorial-icon">⚓</div>
        <h2>Welcome to Port Weather Assist</h2>
        <p>Decision support for Harbour Masters. Here's how to use the app:</p>
        <div className="tutorial-steps">
          {[
            { title: "Search your port", desc: "Type a location in the search bar and press Enter to load live weather data." },
            { title: "Read the safety status", desc: "The Recommendation panel shows SAFE, MODERATE, or DANGEROUS based on current conditions." },
            { title: "Inspect metrics", desc: "Click any metric card (humidity, wind, wave height, etc.) to view its 24-hour history." },
            { title: "Navigation and risk timeline", desc: "Scroll down to see the risk timeline and navigate using the tabs above the dashboard" },
            { title: "Forecast", desc: "In the 'Forecast' tab, view the 24-hour forecast for your location." },
            { title: "Set arrival time", desc: "In the 'Panel' tab, use the Arrival Assessment panel to check safety for a specific ship arrival time." },
            { title: "Adjust limits", desc: "In the 'Panel' tab, customise wind, visibility, wave and precipitation thresholds in Operational Limits to match your port's pilotage directions." },
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

/* ─── Share Modal ──────────────────────────────────────────────────────────
 * Exports a lossless PNG snapshot of current conditions + recommendation.
 * ─────────────────────────────────────────────────────────────────────────── */
function ShareModal({ onClose, onExport, isExporting, exportError }) {
  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export Current Conditions and Risk Assessments?</h2>
        <p>
        
        </p>
        {exportError && <p className="share-error">⚠ {exportError}</p>}
        <div className="share-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onExport} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Export PNG"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Report Modal ──────────────────────────────────────────────────────────
 * Lets users flag data inaccuracies or missing information.
 * Reports are logged to the console (a real deployment would POST to a backend).
 * ─────────────────────────────────────────────────────────────────────────── */
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

/* ─── Risk Outlook Slider ───────────────────────────────────────────────────
 * Shows forecast slots rated MODERATE or DANGEROUS as a horizontal slider.
 * Each card displays the time, status label, and the primary reason so the
 * harbour master can see at a glance when and why risk is elevated.
 * Arrow buttons are only rendered when there are risk periods to scroll through.
 * ─────────────────────────────────────────────────────────────────────────── */
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

/* ─── Main App ──────────────────────────────────────────────────────────────
 * Top-level component that owns all shared state and data-fetching logic.
 * ─────────────────────────────────────────────────────────────────────────── */
function App() {
  // ── Data state ────────────────────────────────────────────────────────────
  const [weather, setWeather] = useState(null);       // Current conditions from OWM
  const [tide, setTide] = useState(null);             // Tidal extremes from Stormglass
  const [waveData, setWaveData] = useState(null);     // Current wave state from Open-Meteo Marine
  const [forecast, setForecast] = useState([]);       // Hourly forecast with safety scores

  // ── UI / search state ─────────────────────────────────────────────────────
  const [city, setCity] = useState(() => localStorage.getItem("lastCity") || "London");
  const [error, setError] = useState("");
  const [selectedArrival, setSelectedArrival] = useState(""); // Chosen slot in ArrivalChecker
    const [arrivalCity, setArrivalCity] = useState(
      () => localStorage.getItem("arrivalLastCity") || localStorage.getItem("lastCity") || "London"
    );
    const [arrivalForecast, setArrivalForecast] = useState([]); // Forecast data used only by ArrivalChecker
    const [arrivalLocation, setArrivalLocation] = useState("");
    const [arrivalError, setArrivalError] = useState("");
    const [arrivalIsFetching, setArrivalIsFetching] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date()); // Live clock updated every second
  const [page, setPage] = useState("dashboard");              // Active page tab

  // ── History modal state ───────────────────────────────────────────────────
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState("");
  const [conditionHistory, setConditionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyCache, setHistoryCache] = useState({}); // In-memory cache to avoid re-fetching

  // ── Other modal flags ─────────────────────────────────────────────────────
  const [shareOpen, setShareOpen] = useState(false);
  const [shareExporting, setShareExporting] = useState(false);
  const [shareExportError, setShareExportError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // ── Connectivity & loading ────────────────────────────────────────────────
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [cachedWeather, setCachedWeather] = useState(null); // Last good weather snapshot for offline mode
  const [isFetching, setIsFetching] = useState(false);      // True while loadWeather is in progress

  // ── Operational limits (harbour-master configurable) ──────────────────────
  // Initialised from defaults snapshot.
  const [windMaxInput, setWindMaxInput] = useState(initialLimit.windMax);
  const [visibilityMinInput, setVisibilityMinInput] = useState(initialLimit.visibilityMin);
  const [precipitationMaxInput, setPrecipitationMaxInput] = useState(initialLimit.precipitationMax);
  const [waveMaxInput, setWaveMaxInput] = useState(initialLimit.waveMax);
  
  // Theme is read from localStorage on mount; falls back to the OS preference.
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // Derive risk periods from the forecast on every render — no extra state needed.
  const riskPeriods = getDangerousPeriods(forecast);

  // ── Refs ──────────────────────────────────────────────────────────────────
  // latLonRef stores the most recent coordinates so callbacks that don't depend
  // on weather state (timers, limit effects) can still trigger geo-based fetches.
  const latLonRef = useRef({ lat: null, lon: null });
  const dashboardCaptureRef = useRef(null);

  // prevLimits tracks the last-applied limit values to avoid re-running the
  // safety calculation when an unrelated state update re-renders the component.
  const prevLimits = useRef({
    windMaxInput, visibilityMinInput, precipitationMaxInput, waveMaxInput
  });

  // ── One-time effects ──────────────────────────────────────────────────────

  // Show tutorial on first visit; set flag so it does not reappear.
  useEffect(() => {
    if (!localStorage.getItem("tutorialSeen")) setTutorialOpen(true);
  }, []);

  const closeTutorial = () => {
    setTutorialOpen(false);
    localStorage.setItem("tutorialSeen", "1");
  };

  // Listen for browser online/offline events to switch between live and cached data.
  useEffect(() => {
    const goOnline  = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online",  goOnline);
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

  // Keep the planning search independent from the navbar search.
  useEffect(() => {
    localStorage.setItem("arrivalLastCity", arrivalCity);
  }, [arrivalCity]);

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

  // When an operational limit changes, push the new value into safetyLogic and
  // re-run the forecast so safety badges update instantly without a page reload.
  // prevLimits prevents this running on unrelated re-renders.
  useEffect(() => {
    const prev = prevLimits.current;
    const changed =
      Number(windMaxInput) !== prev.windMaxInput ||
      Number(visibilityMinInput) !== prev.visibilityMinInput ||
      Number(precipitationMaxInput) !== prev.precipitationMaxInput ||
      Number(waveMaxInput) !== prev.waveMaxInput;

    if (changed) {
      setWindMax(Number(windMaxInput));
      setVisibilityMin(Number(visibilityMinInput));
      setPrecipitationMax(Number(precipitationMaxInput));
      setWaveMax(Number(waveMaxInput));
      prevLimits.current = {
        windMaxInput: Number(windMaxInput),
        visibilityMinInput: Number(visibilityMinInput),
        precipitationMaxInput: Number(precipitationMaxInput),
        waveMaxInput: Number(waveMaxInput),
      };
      // Only re-fetch if coordinates are known (i.e. a city has already loaded).
      if (latLonRef.current.lat != null) loadForecast();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windMaxInput, visibilityMinInput, precipitationMaxInput, waveMaxInput]);

  // Increment the live clock every second for the navbar timestamp display.
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Event handlers ────────────────────────────────────────────────────────

  /** Updates the city state when the user presses Enter in the search box. */
  const handleCitySearch = (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      setCity(e.target.value.trim());
    }
  };

  /** Submits the planning panel's location search. */
  const handleArrivalCitySearch = (value) => {
    if (!value.trim()) return;
    setSelectedArrival("");
    setArrivalCity(value.trim());
  };

  // ── Data loaders ──────────────────────────────────────────────────────────

  /**
   * Fetches current weather from OpenWeatherMap for the active city.
   * On success: normalises the response, runs a safety assessment (wave = null
   *   at this stage because wave data arrives separately), and caches the result
   *   in localStorage for offline use.
   * On failure: falls back to cached data if available.
   */
  const loadWeather = useCallback(async () => {
    if (isOffline) {
      // Device is offline — serve whatever is in the cache rather than failing.
      const cached = localStorage.getItem(`weather_${city}`);
      if (cached) setCachedWeather(JSON.parse(cached));
      return;
    }
    setIsFetching(true);
    try {
      setError("");
      const data = await getWeather(city);

      // Normalise units: OWM returns visibility in metres and wind in m/s.
      const visibilityKm = data.visibility ? data.visibility / 1000 : 0;
      const windMs       = data.wind?.speed ?? 0;
      const windDeg      = data.wind?.deg   ?? null;
      const rain1h       = data.rain?.["1h"] ?? 0;

      // Initial safety assessment without wave height — wave data loads separately
      // via loadWaves() and will update this once coordinates are known.
      const safety = calculateSafetyStatus(windMs, visibilityKm, rain1h, null);

      const weatherData = {
        location:          data.name,
        temperature:       data.main.temp,
        humidity:          data.main.humidity,
        visibility:        visibilityKm,
        pressure:          data.main.pressure,
        windMs,
        windDirection:     getCompassDirection(windDeg),
        precipitation:     rain1h,
        description:       data.weather?.[0]?.description || "No description available",
        icon:              data.weather?.[0]?.icon || "",
        status:            safety.status,
        statusClass:       safety.statusClass,
        confidence:        safety.confidence,
        confidenceFactors: safety.confidenceFactors,
        recommendation:    safety.recommendation,
        updatedAt:         new Date().toLocaleString(),
        lat:               data.coord?.lat ?? null,
        lon:               data.coord?.lon ?? null,
        waveHeight:        null, // populated later by loadWaves()
      };

      // Store coords in the ref so timer-based reloads can still reach the marine APIs.
      latLonRef.current = { lat: weatherData.lat, lon: weatherData.lon };
      setWeather(weatherData);
      setCachedWeather(null);
      // Persist to localStorage so the app works offline after the first load.
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

  /**
   * Fetches the hourly 24-hour forecast from Open-Meteo using the stored coordinates.
   * Each slot is enriched with a safety status so the Forecast page and Risk Outlook
   * can colour-code every hour independently.
   * Uses latLonRef so it can be called from timers and the limits effect without
   * needing weather state as a dependency.
   */
  const loadForecast = useCallback(async () => {
    const { lat, lon } = latLonRef.current;
    if (lat == null || lon == null || isOffline) return;
    try {
      const items = await getHourlyForecast(lat, lon);
      setForecast(
        items.map((item) => {
          // Run safety assessment per slot — wave height is included when available.
          const slotSafety = calculateSafetyStatus(item.windMs, item.visibility, item.precipitation, item.waveHeight);
          return {
            ...item,
            status:     slotSafety.status,
            statusClass: slotSafety.statusClass,
            reason:     slotSafety.reason,
            confidence: slotSafety.confidence,
          };
        })
      );
    } catch (err) {
      console.error("Hourly forecast fetch error:", err);
      setForecast([]);
    }
  }, [isOffline]);

  // Loads forecast data for the planning panel's own city selection.
  const loadArrivalForecast = useCallback(async () => {
    if (isOffline) return;
    setArrivalIsFetching(true);
    try {
      setArrivalError("");

      const data = await getWeather(arrivalCity);
      const lat = data.coord?.lat;
      const lon = data.coord?.lon;

      if (lat == null || lon == null) {
        throw new Error("Coordinates unavailable for selected arrival location.");
      }

      const items = await getHourlyForecast(lat, lon);
      setArrivalForecast(
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
      setArrivalLocation(data.name || arrivalCity);
    } catch (err) {
      console.error("Arrival forecast fetch error:", err);
      setArrivalForecast([]);
      setArrivalLocation("");
      setArrivalError("Location not found. Please try another city.");
    } finally {
      setArrivalIsFetching(false);
    }
  }, [arrivalCity, isOffline]);

  /**
   * Fetches the next 24 hours of tidal extremes from Stormglass.
   * Wrapped in its own callback so the caller (lat/lon effect) can pass coordinates
   * directly without reading from state, which avoids stale closure issues.
   */
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
      // Re-run safety assessment now that wave height is known.
      // Uses the functional form of setWeather to always base the update on the
      // latest state, avoiding a race condition with loadWeather.
      setWeather((prev) => {
        if (!prev) return prev;
        const safety = calculateSafetyStatus(prev.windMs, prev.visibility, prev.precipitation, data.waveHeight);
        return {
          ...prev,
          waveHeight:    data.waveHeight,
          waveDirection: data.waveDirection,
          wavePeriod:    data.wavePeriod,
          status:            safety.status,
          statusClass:       safety.statusClass,
          confidence:        safety.confidence,
          confidenceFactors: safety.confidenceFactors,
          recommendation:    safety.recommendation,
        };
      });
    } catch (err) {
      console.error("Wave fetch error:", err);
      setWaveData(null);
    }
  }, [isOffline]);

  // ── Lifecycle effects ─────────────────────────────────────────────────────

  // When the city changes, clear all stale data and reload from scratch.
  // Forecast is NOT triggered here — it loads via the lat/lon effect below
  // once loadWeather completes and coordinates become known.
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

  // Refresh planning-panel forecast when its local search location changes.
  useEffect(() => {
    loadArrivalForecast();
  }, [loadArrivalForecast]);

  // Auto-refresh current conditions every 10 minutes.
  useEffect(() => {
    const i = setInterval(loadWeather, 10 * 60 * 1000);
    return () => clearInterval(i);
  }, [loadWeather]);

  // Auto-refresh forecast every 30 minutes (less frequent — hourly data changes slowly).
  useEffect(() => {
    const i = setInterval(() => {
      if (latLonRef.current.lat != null) loadForecast();
    }, 30 * 60 * 1000);
    return () => clearInterval(i);
  }, [loadForecast]);

  // Once coordinates are available (after loadWeather succeeds), trigger the
  // geo-dependent loaders.  The dependency on weather?.lat means this re-runs
  // automatically when the user searches a new city with different coordinates.
  useEffect(() => {
    if (!weather || weather.lat == null) return;
    loadTide(weather.lat, weather.lon);
    loadWaves(weather.lat, weather.lon);
    loadForecast();
  }, [weather?.lat, weather?.lon, loadTide, loadWaves, loadForecast]);

  /**
   * Opens the history modal for a given condition and fetches its 24-hour data.
   * Uses an in-memory cache (historyCache) to avoid re-fetching the same
   * condition for the same location within a single session.
   */
  const handleOpenHistory = async (conditionKey) => {
    const w = weather || cachedWeather;
    if (!w || w.lat == null) return;
    setSelectedCondition(conditionKey);
    setHistoryModalOpen(true);
    setHistoryError("");

    // Return cached data immediately if available.
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

  const handleExportConditionsImage = async () => {
    const node = dashboardCaptureRef.current;
    if (!node) {
      setShareExportError("Unable to capture panels right now. Please try again.");
      return;
    }

    setShareExportError("");
    setShareExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--app-bg")
        .trim() || "#ffffff";

      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor,
      });

      const safeLocation = (displayWeather?.location || city).replace(/[^a-z0-9]+/gi, "_");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      const link = document.createElement("a");
      link.download = `${safeLocation}_conditions_${stamp}.png`;
      link.href = dataUrl;
      link.click();
      setShareOpen(false);
    } catch (err) {
      console.error("PNG export failed:", err);
      setShareExportError("Export failed. Please try again.");
    } finally {
      setShareExporting(false);
    }
  };

  const displayWeather = weather || cachedWeather;
  const [tosOpen, setTosOpen] = useState(false);

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
          <div>
            <button
              type="button"
              className="nav-icon-btn"
              onClick={() => setTosOpen(true)}
            >
              📄 Credits
            </button>
            {tosOpen && <ToSModal onClose={() => setTosOpen(false)} />}
          </div>
        </div>
      </header>
    );
  }

  function ToSModal({ onClose }) {
    return (
      <div className="report-modal-overlay" onClick={onClose}>
        <div className="report-modal" onClick={(e) => e.stopPropagation()}>
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <p>We use <strong>OpenWeatherMap</strong> to retrieve the current weather and coordinates of inputted locations.</p>
            <p>
              You can visit the OpenWeatherMap website{" "}
              <a
                href="https://openweathermap.org/"
                target="_blank"
                rel="noopener noreferrer"
              >
                here
              </a>.
            </p>
            <p>Hourly weather forecasts and wava data is pulled from the <strong>Open Meteo API</strong>.</p>
            <p>
              You can visit the Open Meteo website{" "}
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                here
              </a>.
              </p>
              <p><strong>Stormglass</strong> provides us with tide predictions.</p>
            <p>
              You can visit the Stormglass website{" "}
              <a
                href="https://stormglass.io/"
                target="_blank"
                rel="noopener noreferrer"
              >
                here
              </a>.
            </p>
            <p>All of our risk assessments are based off real pilotage directions, but they may vary notably from port to port. Please customise operational limits in the 'Planning' tab for best results.</p>
          </div>
          <div className="report-actions">
            <button className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
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
      {page === "dashboard" && <main className="dashboard" ref={dashboardCaptureRef}>
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
              <div className={`btn connection-status ${isOffline ? "offline" : "online"}`}>
                {isOffline ? "⚠ Cached" : "🟢 Online"}
              </div>
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
            Final operational judgement remains with the Harbour Master.
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
            forecast={arrivalForecast}
            selectedArrival={selectedArrival}
            setSelectedArrival={setSelectedArrival}
            arrivalCity={arrivalCity}
            arrivalLocation={arrivalLocation}
            arrivalError={arrivalError}
            arrivalIsFetching={arrivalIsFetching}
            onArrivalCitySearch={handleArrivalCitySearch}
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
              <div className="limit-item">
                <label><br></br></label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setWindMaxInput(initialLimit.windMax);
                    setVisibilityMinInput(initialLimit.visibilityMin);
                    setPrecipitationMaxInput(initialLimit.precipitationMax);
                    setWaveMaxInput(initialLimit.waveMax);
                  }}
                >
                  ↻ Reset values
                </button>
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

      {shareOpen && (
        <ShareModal
          onClose={() => {
            setShareOpen(false);
            setShareExportError("");
          }}
          onExport={handleExportConditionsImage}
          isExporting={shareExporting}
          exportError={shareExportError}
        />
      )}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
    </div>
  );
}

export default App;
const initialLimit = Object.freeze({
  windMax: defaultWindMax,
  visibilityMin: defaultVisibilityMin,
  precipitationMax: defaultPrecipitationMax,
  waveMax: defaultWaveMax,
});
