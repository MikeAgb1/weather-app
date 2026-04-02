/**
 * Safety classification logic and mutable operational thresholds.
 * Thresholds are updated from the Planning panel via exported setters.
 */

// Operational thresholds (harbour-master adjustable)

export let windMax = 12;          // Maximum safe sustained wind speed (knots)
export let visibilityMin = 3;     // Minimum safe visibility (km)
export let precipitationMax = 8;  // Maximum safe precipitation rate (mm/h)
export let waveMax = 2.5;         // Maximum safe significant wave height (m)

// Called from App.jsx when limits are updated.
export function setWindMax(val)          { windMax = val; }
export function setVisibilityMin(val)    { visibilityMin = val; }
export function setPrecipitationMax(val) { precipitationMax = val; }
export function setWaveMax(val)          { waveMax = val; }

/**
 * Calculates status and confidence from wind, visibility, precipitation, and wave data.
 * Confidence is reduced for missing data and borderline readings.
 *
 * @param {number}      windMs        - Sustained wind speed in m/s.
 * @param {number}      visibilityKm  - Horizontal visibility in kilometres.
 * @param {number}      [precipitationMm=0] - Precipitation rate in mm/h.
 * @param {number|null} [waveHeightM=null]  - Significant wave height in metres,
 *                                            or null if unavailable (e.g. inland).
 * @returns {{
 *   status: string,
 *   statusClass: string,
 *   confidence: number,
 *   recommendation: string,
 *   reason: string,
 *   confidenceFactors: string[]
 * }}
 */
export function calculateSafetyStatus(windMs, visibilityKm, precipitationMm = 0, waveHeightM = null) {
  // Guard against missing core inputs.
  if (windMs == null || visibilityKm == null) {
    return {
      status: "MODERATE",
      confidence: 60,
      recommendation: "Incomplete weather data. Review conditions manually before port operations.",
      statusClass: "moderate",
      reason: "Incomplete operational weather data",
      confidenceFactors: ["Missing wind or visibility data"],
    };
  }

  // Compare wind in knots because thresholds are stored in knots.
  const windKnots = windMs * 1.94384;

  const factors = [];
  let confidenceScore = 95;

  // Marine data may be unavailable for inland locations.
  if (waveHeightM === null) {
    confidenceScore -= 8;
    factors.push("Wave height data unavailable");
  }
  if (precipitationMm === null) {
    confidenceScore -= 8;
    factors.push("Precipitaion data unavailable");
  }
  if (windKnots === null) {
    confidenceScore -= 8;
    factors.push("Wave data unavailable");
  }
  if (visibilityKm === null) {
    confidenceScore -= 8;
    factors.push("Visibility data unavailable");
  }

  // Borderline readings are less reliable; deduct confidence within 20% margin.
  const windMargin = Math.abs(windKnots - windMax) / windMax;
  const visMargin  = Math.abs(visibilityKm - visibilityMin) / visibilityMin;
  if (windMargin < 0.2) { confidenceScore -= 5; factors.push("Wind near threshold"); }
  if (visMargin  < 0.2) { confidenceScore -= 5; factors.push("Visibility near threshold"); }

  // Clamp confidence to avoid overconfidence or unusably low values.
  confidenceScore = Math.max(55, Math.min(95, confidenceScore));

  const dangerousWind  = windKnots > windMax;
  const dangerousVis   = visibilityKm < visibilityMin;
  const dangerousPrecip = precipitationMm > precipitationMax;
  const dangerousWave  = waveHeightM !== null && waveHeightM > waveMax;

  if (dangerousWind || dangerousVis || dangerousPrecip || dangerousWave) {
    return {
      status: "DANGEROUS",
      confidence: Math.round(confidenceScore),
      recommendation: "Conditions exceed safe operational thresholds. Delay or restrict docking.",
      statusClass: "dangerous",
      reason: getPrimaryReason(windKnots, visibilityKm, precipitationMm, waveHeightM),
      confidenceFactors: factors,
    };
  }

  // MODERATE when any metric enters a caution zone.
  const moderateWind  = windKnots     > windMax          * 0.6;
  const moderateVis   = visibilityKm  < visibilityMin    * 2.5;
  const moderatePrecip = precipitationMm > precipitationMax * 0.25;
  const moderateWave  = waveHeightM !== null && waveHeightM > waveMax * 0.6;

  if (moderateWind || moderateVis || moderatePrecip || moderateWave) {
    return {
      status: "MODERATE",
      confidence: Math.round(confidenceScore - 5),
      recommendation: "Proceed with caution and monitor weather conditions closely.",
      statusClass: "moderate",
      reason: getPrimaryReason(windKnots, visibilityKm, precipitationMm, waveHeightM),
      confidenceFactors: factors,
    };
  }

  return {
    status: "SAFE",
    confidence: Math.round(confidenceScore),
    recommendation: "Conditions are suitable for normal docking operations.",
    statusClass: "safe",
    reason: "Conditions within normal operational thresholds",
    confidenceFactors: factors,
  };
}

/**
 * Returns a short primary reason, ordered by operational severity.
 *
 * @param {number}      windKnots     - Wind speed in knots.
 * @param {number}      visibilityKm  - Visibility in km.
 * @param {number}      precipitationMm - Precipitation in mm/h.
 * @param {number|null} waveHeightM   - Wave height in metres, or null.
 * @returns {string}
 */
function getPrimaryReason(windKnots, visibilityKm, precipitationMm, waveHeightM) {
  // Check DANGEROUS thresholds first, then MODERATE thresholds.
  if (windKnots     > windMax)           return "Wind exceeds safe threshold";
  if (visibilityKm  < visibilityMin)     return "Visibility is critically low";
  if (precipitationMm > precipitationMax) return "Heavy precipitation affecting operations";
  if (waveHeightM !== null && waveHeightM > waveMax) return "Wave height exceeds safe threshold";

  if (windKnots     > windMax          * 0.6) return "Elevated wind conditions";
  if (visibilityKm  < visibilityMin    * 2.5) return "Reduced visibility";
  if (precipitationMm > precipitationMax * 0.25) return "Rain may affect port operations";
  if (waveHeightM !== null && waveHeightM > waveMax * 0.6) return "Elevated wave height";

  return "General weather caution";
}
