export async function getTide(lat, lon) {
    const API_KEY = import.meta.env.VITE_STORMGLASS_API_KEY;
  
    if (!API_KEY) {
      throw new Error("Stormglass API key is missing.");
    }
  
    const roundedLat = Number(lat).toFixed(3);
    const roundedLon = Number(lon).toFixed(3);
  
    const cacheKey = `tide_${roundedLat}_${roundedLon}`;
    const cached = localStorage.getItem(cacheKey);
  
    // Cache duration (3 hours)
    const cacheDuration = 3 * 60 * 60 * 1000;
  
    if (cached) {
      const parsed = JSON.parse(cached);
  
      if (Date.now() - parsed.timestamp < cacheDuration) {
        return {
          ...parsed.data,
          cacheStatus: "cached",
          cachedAt: parsed.timestamp,
        };
      }
    }
  
    const start = new Date();
    const end = new Date();
    end.setHours(end.getHours() + 24);
  
    const startIso = start.toISOString();
    const endIso = end.toISOString();
  
    const url =
      `https://api.stormglass.io/v2/tide/extremes/point` +
      `?lat=${roundedLat}&lng=${roundedLon}` +
      `&start=${encodeURIComponent(startIso)}` +
      `&end=${encodeURIComponent(endIso)}` +
      `&datum=MSL`;
  
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: API_KEY,
        },
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        // Cache the failure temporarily so the app stops retrying
        const timestamp = Date.now();
  
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            timestamp,
            data: { error: "quota_or_api_error" },
          })
        );
  
        throw new Error(
          data?.errors?.[0]?.message ||
          data?.message ||
          "Failed to load tide data."
        );
      }
  
      const timestamp = Date.now();
  
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          timestamp,
          data,
        })
      );
  
      return {
        ...data,
        cacheStatus: "live",
        cachedAt: timestamp,
      };
  
    } catch (error) {
      console.error("Stormglass request failed:", error.message);
  
      return {
        data: [],
        cacheStatus: "error",
        cachedAt: Date.now(),
        error: error.message,
      };
    }
}