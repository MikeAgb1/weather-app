/**
 * ForecastPanel.jsx
 * Displays the 24-hour hourly forecast as a horizontally scrollable slider.
 *
 * Each card shows: time, weather icon, temperature, description, wind speed,
 * visibility, wave height (if available), and the safety status badge.
 *
 * The slider uses CSS scroll-snap so cards land cleanly after a swipe or
 * arrow-button press.  The ‹ › buttons scroll by ~80 % of the visible width
 * so the user always has a visual overlap with the previous position.
 */

import { useRef } from "react";
import { msToKnots } from "../utils/unitConversion";

/**
 * @param {{ forecast: Array }} props
 * @param {Array}  props.forecast - Hourly forecast slots produced by
 *   getHourlyForecast() and enriched with safety status in App.jsx.
 */
function ForecastPanel({ forecast }) {
  // Ref to the scrollable container — used by the arrow buttons to call scrollBy().
  const scrollRef = useRef(null);

  /**
   * Scrolls the forecast slider left (dir = -1) or right (dir = 1).
   * Using 80 % of the visible width keeps one card partially visible as a
   * visual cue that the list continues.
   */
  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  // Empty state — shown while data is loading or if the API failed.
  if (!forecast.length) {
    return (
      <section className="forecast-panel">
        <div className="forecast-header">
          <h1>24-Hour Forecast</h1>
        </div>
        <p style={{ color: "var(--muted-text)", textAlign: "center", padding: "20px 0" }}>
          No forecast data available.
        </p>
      </section>
    );
  }

  return (
    <section className="forecast-panel">
      {/* Header row: title + navigation arrows */}
      <div className="forecast-header">
        <h1>24-Hour Forecast</h1>
        <div className="forecast-nav">
          <button type="button" className="forecast-arrow" onClick={() => scroll(-1)} aria-label="Scroll left">‹</button>
          <button type="button" className="forecast-arrow" onClick={() => scroll(1)}  aria-label="Scroll right">›</button>
        </div>
      </div>

      {/* Scrollable card strip */}
      <div className="forecast-slider" ref={scrollRef}>
        {forecast.map((item, index) => (
          <div key={index} className="forecast-card">
            {/* Time label in HH:MM format */}
            <p className="forecast-time">
              {new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>

            {/* Weather icon sourced from OWM CDN using the mapped icon code */}
            {item.icon && (
              <img
                src={`https://openweathermap.org/img/wn/${item.icon}@2x.png`}
                alt={item.description}
                className="forecast-icon"
              />
            )}

            <p className="forecast-temp">{item.temp.toFixed(1)}°C</p>
            <p className="forecast-desc">{item.description}</p>

            {/* Operational metrics relevant to port safety */}
            <p className="forecast-wind">💨 {msToKnots(item.windMs).toFixed(1)} kn</p>
            <p className="forecast-wind">👁 {item.visibility.toFixed(1)} km</p>

            {/* Wave height is null for inland locations — omit rather than show "N/A" */}
            {item.waveHeight != null && (
              <p className="forecast-wind">🌊 {item.waveHeight.toFixed(2)} m</p>
            )}

            {/* Colour-coded safety status badge */}
            <p className={`forecast-status ${item.statusClass}`}>{item.status}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ForecastPanel;
