import { msToKnots } from "../utils/unitConversion";
import { getForecastIcon } from "../utils/iconMapper";

function ForecastPanel({ forecast }) {
  if (!forecast.length) {
    return (
      <section className="forecast-panel">
        <h1>24-Hour Forecast</h1>
        <p>No forecast data available.</p>
      </section>
    );
  }

  return (
    <section className="forecast-panel">
      <h1>24-Hour Forecast</h1>

      <div className="forecast-grid">
        {forecast.map((item, index) => (
          <div key={index} className="forecast-card">
            <p className="forecast-time">
              {new Date(item.time).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>

            {item.icon && (
              <img
                src={`/icons/${item.icon}@2x.png`}
                alt={item.description}
                className="forecast-icon"
              />
            )}

            <p className="forecast-temp">{item.temp.toFixed(1)}°C</p>
            <p className="forecast-desc">{item.description}</p>
            <p className="forecast-wind">
                Wind: {msToKnots(item.windMs).toFixed(1)} kn
            </p>
            <p className={`forecast-status ${item.statusClass}`}>
              {item.status}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ForecastPanel;