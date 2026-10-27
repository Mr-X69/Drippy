/**
 * Open-Meteo Weather Service & Dynamic Geolocation Utility
 * Fetches real-time weather metrics without requiring any API keys.
 * Strictly adheres to dynamic geolocation: returns null on permission denial or timeout
 * without hardcoding any fallback cities or coordinates.
 */

export interface WeatherData {
  temperature: number; // Celsius (°C)
  apparentTemperature: number;
  humidity: number; // %
  weatherCode: number;
  condition: string; // e.g., "Partly Cloudy", "Clear Sky"
  category: "clear" | "cloudy" | "fog" | "rain" | "snow" | "thunderstorm";
  isDay: boolean;
  precipitation: number; // mm
  windSpeed: number; // km/h
  summary: string; // e.g., "28°C • Partly Cloudy"
  latitude: number;
  longitude: number;
  locationName?: string;
  isManualLocation?: boolean;
  fetchedAt: number;
}

/**
 * WMO Weather interpretation codes (WW) mapper
 * https://open-meteo.com/en/docs
 */
export function getWeatherConditionByCode(code: number): {
  label: string;
  category: "clear" | "cloudy" | "fog" | "rain" | "snow" | "thunderstorm";
} {
  switch (code) {
    case 0:
      return { label: "Clear Sky", category: "clear" };
    case 1:
      return { label: "Mainly Clear", category: "clear" };
    case 2:
      return { label: "Partly Cloudy", category: "cloudy" };
    case 3:
      return { label: "Overcast", category: "cloudy" };
    case 45:
    case 48:
      return { label: "Foggy", category: "fog" };
    case 51:
    case 53:
    case 55:
      return { label: "Light Drizzle", category: "rain" };
    case 56:
    case 57:
      return { label: "Freezing Drizzle", category: "rain" };
    case 61:
      return { label: "Slight Rain", category: "rain" };
    case 63:
      return { label: "Moderate Rain", category: "rain" };
    case 65:
      return { label: "Heavy Rain", category: "rain" };
    case 66:
    case 67:
      return { label: "Freezing Rain", category: "rain" };
    case 71:
    case 73:
    case 75:
      return { label: "Snowfall", category: "snow" };
    case 77:
      return { label: "Snow Grains", category: "snow" };
    case 80:
    case 81:
    case 82:
      return { label: "Rain Showers", category: "rain" };
    case 85:
    case 86:
      return { label: "Snow Showers", category: "snow" };
    case 95:
      return { label: "Thunderstorm", category: "thunderstorm" };
    case 96:
    case 99:
      return { label: "Thunderstorm with Hail", category: "thunderstorm" };
    default:
      return { label: "Clear", category: "clear" };
  }
}

/**
 * Fetch current weather conditions from the Open-Meteo free API
 * @param latitude User latitude
 * @param longitude User longitude
 * @param timeoutMs Request timeout (default 7000ms)
 * @returns WeatherData object or null if request fails
 */
export async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
  timeoutMs = 7000
): Promise<WeatherData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", latitude.toFixed(4));
    url.searchParams.set("longitude", longitude.toFixed(4));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m"
    );

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Open-Meteo] HTTP Error ${res.status}: ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const current = data.current;

    if (!current) {
      return null;
    }

    const temp = Math.round((current.temperature_2m ?? 0) * 10) / 10;
    const apparent = Math.round((current.apparent_temperature ?? temp) * 10) / 10;
    const weatherCode = Number(current.weather_code ?? 0);
    const { label: condition, category } = getWeatherConditionByCode(weatherCode);

    return {
      temperature: temp,
      apparentTemperature: apparent,
      humidity: Math.round(current.relative_humidity_2m ?? 0),
      weatherCode,
      condition,
      category,
      isDay: Boolean(current.is_day),
      precipitation: Number(current.precipitation ?? 0),
      windSpeed: Math.round((current.wind_speed_10m ?? 0) * 10) / 10,
      summary: `${Math.round(temp)}°C • ${condition}`,
      latitude,
      longitude,
      fetchedAt: Date.now(),
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[Open-Meteo] Weather request timed out");
    } else {
      console.warn("[Open-Meteo] Failed to fetch weather:", error);
    }
    return null;
  }
}

/**
 * Request user's live coordinates via browser Geolocation API.
 * STRICT: If permission is denied, or request times out, strictly returns null.
 * NO fallback coordinates or cities are ever returned.
 */
export function getUserCoordinates(
  timeoutMs = 6000
): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.info("[Geolocation] Request timed out, proceeding with weather: null");
        resolve(null);
      }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          // Strictly return null on permission denial or error - NO HARDCODING
          console.info(
            `[Geolocation] Location unavailable or denied (${error.code}: ${error.message}). Returning weather: null.`
          );
          resolve(null);
        }
      },
      {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 300000, // 5 min cache
      }
    );
  });
}

export interface GeocodedCity {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

export interface ConfiguredLocation {
  type: "manual" | "geolocation";
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

const LOCATION_STORAGE_KEY = "drippy_configured_location";

let memoryLocation: ConfiguredLocation | null = null;

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

export function getConfiguredLocation(): ConfiguredLocation | null {
  const storage = getStorage();
  if (!storage) return memoryLocation;
  try {
    const saved = storage.getItem(LOCATION_STORAGE_KEY);
    if (!saved) return memoryLocation;
    return JSON.parse(saved);
  } catch {
    return memoryLocation;
  }
}

export function setConfiguredLocation(location: ConfiguredLocation): void {
  memoryLocation = location;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch (err) {
    console.error("Failed to save location:", err);
  }
}

export function clearConfiguredLocation(): void {
  memoryLocation = null;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(LOCATION_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear location:", err);
  }
}

/**
 * Searches cities using Open-Meteo free geocoding API
 */
export async function geocodeCity(query: string): Promise<GeocodedCity[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query.trim());
    url.searchParams.set("count", "5");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((r: {
      name: string;
      latitude: number;
      longitude: number;
      country?: string;
      admin1?: string;
    }) => ({
      name: r.name,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      country: r.country,
      admin1: r.admin1,
    }));
  } catch (err) {
    console.warn("[Open-Meteo] Geocoding search failed:", err);
    return [];
  }
}

/**
 * High-level helper: checks for user-configured manual city first before browser geolocation.
 * Returns null if location is denied, timed out, or weather fetch fails.
 */
export async function getLiveWeather(): Promise<WeatherData | null> {
  // 1. Check for manual city location configured by user in Settings
  const manualLoc = getConfiguredLocation();
  if (manualLoc && manualLoc.type === "manual" && typeof manualLoc.latitude === "number") {
    const weather = await fetchCurrentWeather(manualLoc.latitude, manualLoc.longitude);
    if (weather) {
      return {
        ...weather,
        locationName: manualLoc.name,
        isManualLocation: true,
        summary: `${Math.round(weather.temperature)}°C • ${weather.condition} (${manualLoc.name})`,
      };
    }
  }

  // 2. Fall back to browser geolocation if no manual city is configured or if set to geolocation
  const coords = await getUserCoordinates();
  if (!coords) {
    return null;
  }
  const liveWeather = await fetchCurrentWeather(coords.latitude, coords.longitude);
  if (liveWeather) {
    return {
      ...liveWeather,
      isManualLocation: false,
    };
  }
  return null;
}
