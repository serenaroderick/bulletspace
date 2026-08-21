import type { AdapterDefinition, DataPayload } from "@bulletspace/core";
import { gatekeeper } from "../lib/gatekeeper";

const CONFIG_STORAGE_KEY = "bulletspace.weather.config";

export type WeatherProvider = "openweathermap" | "weatherstack";

export const weatherAdapterDefinition: AdapterDefinition = {
  id: "weather-v1",
  name: "Current Weather",
  version: "1.0.0",
  authType: "api_key",
  defaultTtlSeconds: 30 * 60,
  fields: [
    { id: "recorded_at", name: "Recorded At", type: "date", description: "" },
    { id: "temperature_c", name: "Temperature (°C)", type: "number", description: "" },
    { id: "condition", name: "Condition", type: "string", description: "" },
    { id: "humidity", name: "Humidity (%)", type: "number", description: "" },
  ],
};

export interface WeatherConfig {
  provider: WeatherProvider;
  apiKey: string;
  city: string;
}

export function loadWeatherConfig(): WeatherConfig | null {
  const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as WeatherConfig) : null;
}

export function saveWeatherConfig(config: WeatherConfig): void {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function clearWeatherConfig(): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
}

async function fetchFromOpenWeatherMap(apiKey: string, city: string): Promise<DataPayload> {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(apiKey)}&units=metric`;
  const response = await gatekeeper.guardedFetch(url);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Invalid API key (or it hasn't activated yet -- new keys can take up to 2 hours).");
    }
    if (response.status === 404) {
      throw new Error(`City "${city}" not found.`);
    }
    throw new Error(`Weather request failed: ${response.status}`);
  }

  const json = (await response.json()) as {
    dt: number;
    main: { temp: number; humidity: number };
    weather: Array<{ description: string }>;
  };

  return {
    fields: weatherAdapterDefinition.fields,
    rows: [
      {
        recorded_at: new Date(json.dt * 1000).toISOString(),
        temperature_c: json.main.temp,
        condition: json.weather[0]?.description ?? "unknown",
        humidity: json.main.humidity,
      },
    ],
    _cachedAt: new Date().toISOString(),
    _source: "openweathermap",
  };
}

async function fetchFromWeatherstack(apiKey: string, city: string): Promise<DataPayload> {
  const url = `https://api.weatherstack.com/current?access_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(city)}&units=m`;
  const response = await gatekeeper.guardedFetch(url);

  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`);
  }

  const json = (await response.json()) as {
    success?: false;
    error?: { code: number; info: string };
    location?: { localtime_epoch: number };
    current?: { temperature: number; weather_descriptions: string[]; humidity: number };
  };

  if (json.success === false || !json.current || !json.location) {
    throw new Error(json.error?.info ?? "Weatherstack request failed.");
  }

  return {
    fields: weatherAdapterDefinition.fields,
    rows: [
      {
        recorded_at: new Date(json.location.localtime_epoch * 1000).toISOString(),
        temperature_c: json.current.temperature,
        condition: json.current.weather_descriptions[0] ?? "unknown",
        humidity: json.current.humidity,
      },
    ],
    _cachedAt: new Date().toISOString(),
    _source: "weatherstack",
  };
}

export async function fetchCurrentWeather(): Promise<DataPayload> {
  const config = loadWeatherConfig();
  if (!config) throw new Error("Weather adapter is not configured.");

  return config.provider === "weatherstack"
    ? fetchFromWeatherstack(config.apiKey, config.city)
    : fetchFromOpenWeatherMap(config.apiKey, config.city);
}
