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
 * @param {Object} props
 * @param {Array} props.forecast
 * @param {string} props.selectedArrival
 * @param {Function} props.setSelectedArrival
 * @param {string} props.arrivalCity
 * @param {string} props.arrivalLocation
 * @param {string} props.arrivalError
 * @param {boolean} props.arrivalIsFetching
 * @param {Function} props.onArrivalCitySearch
 */
function ArrivalChecker({
  forecast,
  selectedArrival,
  setSelectedArrival,
  arrivalCity,
  arrivalLocation,
  arrivalError,
  arrivalIsFetching,
  onArrivalCitySearch,
}) {
  // Times are directly sourced from the same forecast array, so string match is reliable.
  const selectedForecast = forecast.find((item) => item.time === selectedArrival);

  return (
    <section className="arrival-panel">
      <h1>Arrival Safety Assessment</h1>

      <label className="arrival-label">Search location for arrival assessment</label>
      <input
        className="arrival-search"
        type="text"
        placeholder="Search city or country…"
        defaultValue={arrivalCity}
        onKeyDown={(e) => {
          if (e.key === "Enter") onArrivalCitySearch(e.target.value);
        }}
      />
      {arrivalIsFetching && <p className="arrival-meta">Loading forecast for arrival assessment…</p>}
      {!arrivalIsFetching && arrivalLocation && (
        <p className="arrival-meta">Showing arrival forecast for {arrivalLocation}</p>
      )}
      {arrivalError && <p className="arrival-error">⚠ {arrivalError}</p>}

      <label className="arrival-label">Select arrival time</label>
      <select
        className="arrival-select"
        value={selectedArrival}
        disabled={arrivalIsFetching || forecast.length === 0}
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

      {selectedForecast && (
        <div className={`arrival-result ${selectedForecast.statusClass}`}>
          <p className="arrival-status">Operational Risk: {selectedForecast.status}</p>
          <p className="arrival-reason">{selectedForecast.reason}</p>

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
