/**
 * Central source of truth for which ThingSpeak channel/key the dashboard
 * polls. Credentials come from explicit environment configuration or
 * user-provided local settings; no demo credentials are embedded in source.
 */

const CHANNEL_ID_STORAGE_KEY = "thingspeak_channel_id";
const API_KEY_STORAGE_KEY = "thingspeak_read_api_key";

export function getThingSpeakChannelId(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(CHANNEL_ID_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  return process.env.NEXT_PUBLIC_THINGSPEAK_CHANNEL_ID || "";
}

export function getThingSpeakReadApiKey(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  return process.env.NEXT_PUBLIC_THINGSPEAK_READ_API_KEY || "";
}

export function saveThingSpeakConfig(channelId: string, apiKey: string): void {
  if (typeof window === "undefined") return;
  try {
    if (channelId && channelId.trim()) localStorage.setItem(CHANNEL_ID_STORAGE_KEY, channelId.trim());
    if (apiKey && apiKey.trim()) localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
  } catch {
    // Private browsing / storage disabled — safe to ignore, just won't persist across reloads.
  }
}
