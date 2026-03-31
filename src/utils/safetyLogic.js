export let windMax = 12;        // knots
export let visibilityMin = 3;   // km
export let precipitationMax = 8; // mm
export let waveMax = 2.5;       // metres
export let windGustMax = 18;    // knots

export function setWindMax(val) { windMax = val; }
export function setVisibilityMin(val) { visibilityMin = val; }
export function setPrecipitationMax(val) { precipitationMax = val; }
export function setWaveMax(val) { waveMax = val; }
export function setWindGustMax(val) { windGustMax = val; }

export function calculateSafetyStatus(windMs, visibilityKm, precipitationMm = 0, waveHeightM = null) {
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

  const windKnots = windMs * 1.94384;

  // Build confidence based on how many parameters are available and how far from thresholds
  const factors = [];
  let confidenceScore = 95;

  // Wave data adds confidence when available
  if (waveHeightM === null) {
    confidenceScore -= 8;
    factors.push("Wave height data unavailable");
  }

  // Reduce confidence if conditions are borderline (close to thresholds)
  const windMargin = Math.abs(windKnots - windMax) / windMax;
  const visMargin = Math.abs(visibilityKm - visibilityMin) / visibilityMin;
  if (windMargin < 0.2) { confidenceScore -= 5; factors.push("Wind near threshold"); }
  if (visMargin < 0.2) { confidenceScore -= 5; factors.push("Visibility near threshold"); }

  confidenceScore = Math.max(55, Math.min(95, confidenceScore));

  // Dangerous conditions
  const dangerousWind = windKnots > windMax;
  const dangerousVis = visibilityKm < visibilityMin;
  const dangerousPrecip = precipitationMm > precipitationMax;
  const dangerousWave = waveHeightM !== null && waveHeightM > waveMax;

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

  // Moderate conditions
  const moderateWind = windKnots > windMax * 0.6;
  const moderateVis = visibilityKm < visibilityMin * 2.5;
  const moderatePrecip = precipitationMm > precipitationMax * 0.25;
  const moderateWave = waveHeightM !== null && waveHeightM > waveMax * 0.6;

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

function getPrimaryReason(windKnots, visibilityKm, precipitationMm, waveHeightM) {
  if (windKnots > windMax) return "Wind exceeds safe threshold";
  if (visibilityKm < visibilityMin) return "Visibility is critically low";
  if (precipitationMm > precipitationMax) return "Heavy precipitation affecting operations";
  if (waveHeightM !== null && waveHeightM > waveMax) return "Wave height exceeds safe threshold";

  if (windKnots > windMax * 0.6) return "Elevated wind conditions";
  if (visibilityKm < visibilityMin * 2.5) return "Reduced visibility";
  if (precipitationMm > precipitationMax * 0.25) return "Rain may affect port operations";
  if (waveHeightM !== null && waveHeightM > waveMax * 0.6) return "Elevated wave height";

  return "General weather caution";
}
