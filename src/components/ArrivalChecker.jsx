/**
 * ArrivalChecker.jsx
 * Allows the harbour master to select an anticipated vessel arrival time and
 * instantly see the forecast safety status for that specific hour.
 *
 * The component is purely presentational — it receives the forecast array and
 * the selected arrival time from App.jsx (lifted state) so that the selection
 * persists when the user navigates between pages.
 */

import { msToKnots } from "../utils/unitConversion";

/**
 * @param {{
 *   forecast: Array,
 *   selectedArrival: string,
 *   setSelectedArrival: Function
 * }} props
 * @param {Array}    props.forecast         - Hourly forecast slots (from App state).
 * @param {string}   props.selectedArrival  - ISO time string of the chosen slot, or "".
 * @param {Function} props.setSelectedArrival - Setter to update the selected slot.
 */
function ArrivalChecker({ forecast, selectedArrival, setSelectedArrival }) {
  // Find the forecast slot that matches the chosen arrival time.
  // String equality is safe here because both values come from the same data source.
  const selectedForecast = forecast.find((item) => item.time === selectedArrival);

  return (
    <section className="arrival-panel">
      <h1>Arrival Safety Assessment</h1>

      {/* Dropdown populated from the hourly forecast — each option shows time + status */}
      <label className="arrival-label">Select arrival time</label>
      <select
        className="arrival-select"
        value={selectedArrival}
        onChange={(e) => setSelectedArrival(e.target.value)}
      >
        <option value="">Choose an arrival time…</option>
        {forecast.map((item, index) => (
          <option key={index} value={item.time}>
            {new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" — "}
            {item.status}
          </option>
        ))}
      </select>

      {/* Result card — only rendered once a slot is selected */}
      {selectedForecast && (
        <div className={`arrival-result ${selectedForecast.statusClass}`}>
          <p className="arrival-status">Operational Risk: {selectedForecast.status}</p>
          <p className="arrival-reason">{selectedForecast.reason}</p>

          {/* Key metrics at a glance for the selected arrival slot */}
          <div className="arrival-stats">
            <span className="arrival-stat">Wind: {msToKnots(selectedForecast.windMs).toFixed(1)} kn</span>
            <span className="arrival-stat">Vis: {selectedForecast.visibility.toFixed(1)} km</span>
            <span className="arrival-stat">Precip: {selectedForecast.precipitation} mm</span>
            {selectedForecast.confidence != null && (
              <span className="arrival-stat">Confidence: {selectedForecast.confidence}%</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default ArrivalChecker;
