import { useRef } from "react";
import { msToKnots } from "../utils/unitConversion";

function ForecastPanel({ forecast }) {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

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
      <div className="forecast-header">
        <h1>24-Hour Forecast</h1>
        <div className="forecast-nav">
          <button type="button" className="forecast-arrow" onClick={() => scroll(-1)} aria-label="Scroll left">‹</button>
          <button type="button" className="forecast-arrow" onClick={() => scroll(1)}  aria-label="Scroll right">›</button>
        </div>
      </div>

      <div className="forecast-slider" ref={scrollRef}>
        {forecast.map((item, index) => (
          <div key={index} className="forecast-card">
            <p className="forecast-time">
              {new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            {item.icon && (
              <img
                src={`https://openweathermap.org/img/wn/${item.icon}@2x.png`}
                alt={item.description}
                className="forecast-icon"
              />
            )}
            <p className="forecast-temp">{item.temp.toFixed(1)}°C</p>
            <p className="forecast-desc">{item.description}</p>
            <p className="forecast-wind">💨 {msToKnots(item.windMs).toFixed(1)} kn</p>
            <p className="forecast-wind">👁 {item.visibility.toFixed(1)} km</p>
            {item.waveHeight != null && (
              <p className="forecast-wind">🌊 {item.waveHeight.toFixed(2)} m</p>
            )}
            <p className={`forecast-status ${item.statusClass}`}>{item.status}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ForecastPanel;
