export function calculateSafetyStatus(windMs, visibilityKm, precipitationMm = 0) {
    if (windMs == null || visibilityKm == null) {
      return {
        status: "MODERATE",
        confidence: 60,
        recommendation:
          "Incomplete weather data. Review conditions manually before port operations.",
        statusClass: "moderate",
        reason: "Incomplete operational weather data",
      };
    }
  
    // Dangerous conditions
    if (windMs > 12 || visibilityKm < 3 || precipitationMm > 6) {
      return {
        status: "DANGEROUS",
        confidence: 85,
        recommendation:
          "Conditions exceed safe operational thresholds. Delay or restrict docking.",
        statusClass: "dangerous",
        reason: getPrimaryReason(windMs, visibilityKm, precipitationMm),
      };
    }
  
    // Moderate conditions
    if (windMs > 7 || visibilityKm < 8 || precipitationMm > 2) {
      return {
        status: "MODERATE",
        confidence: 75,
        recommendation:
          "Proceed with caution and monitor weather conditions closely.",
        statusClass: "moderate",
        reason: getPrimaryReason(windMs, visibilityKm, precipitationMm),
      };
    }
  
    return {
      status: "SAFE",
      confidence: 90,
      recommendation:
        "Conditions are suitable for normal docking operations.",
      statusClass: "safe",
      reason: "Conditions within normal operational thresholds",
    };
  }
  
  function getPrimaryReason(windMs, visibilityKm, precipitationMm) {
    if (windMs > 12) return "Wind exceeds safe threshold";
    if (visibilityKm < 3) return "Visibility is critically low";
    if (precipitationMm > 6) return "Heavy precipitation affecting operations";
  
    if (windMs > 7) return "Elevated wind conditions";
    if (visibilityKm < 8) return "Reduced visibility";
    if (precipitationMm > 2) return "Rain may affect port operations";
  
    return "General weather caution";
}