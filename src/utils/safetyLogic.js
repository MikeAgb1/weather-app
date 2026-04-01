/**
 * safetyLogic.js
 * Core decision-support logic for Port Weather Assist.
 *
 * Defines the operational thresholds used to classify current and forecast
 * conditions as SAFE, MODERATE, or DANGEROUS.  Thresholds are exported as
 * mutable variables so the harbour master can override them via the
 * Operational Limits panel without reloading the app.
 *
 * Default values are based on typical pilotage directions for a mid-sized
 * commercial port; they should be adjusted to match the specific port's
 * standing orders.
 */

// ── Operational thresholds (harbour-master adjustable) ──────────────────────

export let windMax = 12;          // Maximum safe sustained wind speed (knots)
export let visibilityMin = 3;     // Minimum safe visibility (km)
export let precipitationMax = 8;  // Maximum safe precipitation rate (mm/h)
export let waveMax = 2.5;         // Maximum safe significant wave height (m)

// Setter functions — called from App.jsx when the harbour master changes a limit.
// Using setters keeps the module's state encapsulated.
export function setWindMax(val)          { windMax = val; }
export function setVisibilityMin(val)    { visibilityMin = val; }
export function setPrecipitationMax(val) { precipitationMax = val; }
export function setWaveMax(val)          { waveMax = val; }

// ── Main safety assessment ───────────────────────────────────────────────────

/**
 * Calculates the operational safety status for a given set of weather parameters.
 *
 * The function works in two passes:
 *   1. Build a confidence score — start at 95 % and deduct points for missing
 *      data or conditions that are borderline (close to a threshold), because
 *      borderline readings are harder to assess reliably.
 *   2. Classify as DANGEROUS → MODERATE → SAFE by checking each parameter
 *      against the active thresholds.
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
  // Guard: if core data is missing, return a cautious MODERATE rather than
  // silently treating nulls as safe values.
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

  // Convert wind to knots for comparison with the threshold (stored in knots).
  const windKnots = windMs * 1.94384;

  const factors = [];       // Human-readable reasons why confidence was reduced.
  let confidenceScore = 95; // Start optimistic; deduct for uncertainty below.

  // Wave data is not available for inland locations (marine API returns an error).
  // Reduce confidence because one safety-critical parameter cannot be assessed.
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

  // Borderline conditions are harder to call — a small measurement error could
  // flip the classification, so reduce confidence when within 20 % of a threshold.
  const windMargin = Math.abs(windKnots - windMax) / windMax;
  const visMargin  = Math.abs(visibilityKm - visibilityMin) / visibilityMin;
  if (windMargin < 0.2) { confidenceScore -= 5; factors.push("Wind near threshold"); }
  if (visMargin  < 0.2) { confidenceScore -= 5; factors.push("Visibility near threshold"); }

  // Clamp confidence to a sensible range — never report 100 % or below 55 %.
  confidenceScore = Math.max(55, Math.min(95, confidenceScore));

  // ── DANGEROUS: any single parameter exceeds its threshold ─────────────────
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

  // ── MODERATE: any parameter is elevated (>60 % of its threshold) ──────────
  // These percentages reflect "caution zone" — conditions are not yet dangerous
  // but are deteriorating and warrant close monitoring.
  const moderateWind  = windKnots     > windMax          * 0.6;
  const moderateVis   = visibilityKm  < visibilityMin    * 2.5;
  const moderatePrecip = precipitationMm > precipitationMax * 0.25;
  const moderateWave  = waveHeightM !== null && waveHeightM > waveMax * 0.6;

  if (moderateWind || moderateVis || moderatePrecip || moderateWave) {
    return {
      status: "MODERATE",
      confidence: Math.round(confidenceScore - 5), // slightly lower confidence in grey zone
      recommendation: "Proceed with caution and monitor weather conditions closely.",
      statusClass: "moderate",
      reason: getPrimaryReason(windKnots, visibilityKm, precipitationMm, waveHeightM),
      confidenceFactors: factors,
    };
  }

  // ── SAFE: all parameters comfortably within thresholds ────────────────────
  return {
    status: "SAFE",
    confidence: Math.round(confidenceScore),
    recommendation: "Conditions are suitable for normal docking operations.",
    statusClass: "safe",
    reason: "Conditions within normal operational thresholds",
    confidenceFactors: factors,
  };
}

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns a short, human-readable string describing the most operationally
 * significant reason for the current classification.
 *
 * Priority order matches the sequence that most directly endangers vessels:
 * wind → visibility → precipitation → wave height.
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
