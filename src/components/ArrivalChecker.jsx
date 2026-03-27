import { msToKnots } from "../utils/unitConversion";

function ArrivalChecker({ forecast, selectedArrival, setSelectedArrival }) {
  const selectedForecast = forecast.find(
    (item) => item.time === selectedArrival
  );

  return (
    <section className="arrival-panel">
      <h1>Arrival Safety Assessment</h1>

      <label className="arrival-label">Select arrival time</label>

      <select
        className="arrival-select"
        value={selectedArrival}
        onChange={(e) => setSelectedArrival(e.target.value)}
      >
        <option value="">Choose an arrival time</option>

        {forecast.map((item, index) => (
          <option key={index} value={item.time}>
            {new Date(item.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </option>
        ))}
      </select>

      {selectedForecast && (
        <div className={`arrival-result ${selectedForecast.statusClass}`}>
            <p className="arrival-status">
                Operational Risk: {selectedForecast.status}
            </p>
            <p className="arrival-reason">{selectedForecast.reason}</p>
            <p>
                Wind: {msToKnots(selectedForecast.windMs).toFixed(1)} kn
            </p>
            <p>
                isibility: {selectedForecast.visibility.toFixed(1)} km
            </p>
            <p>
                Precipitation: {selectedForecast.precipitation} mm
            </p>
            </div>
        )}
    </section>
  );
}

export default ArrivalChecker;