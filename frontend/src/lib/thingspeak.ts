/**
 * Central source of truth for which ThingSpeak channel/key the dashboard
 * polls. Previously this was hardcoded as literal "3499335" /
 * "9HWV9GKDI4TGLY7O" in page.tsx, EnvironmentalPanel.tsx, and
 * ThingSpeakModal.tsx independently — with no UI to ever change the channel
 * ID, only the API key. Pointing hardware at a new/private channel had no
 * effect on the dashboard because of this. Resolution order: user-saved
 * (localStorage, set via the "Sync Now" panel) → build-time env var → the
 * original demo channel as a last-resort fallback so existing setups don't
 * break.
 */

const CHANNEL_ID_STORAGE_KEY = "thingspeak_channel_id";
const API_KEY_STORAGE_KEY = "thingspeak_read_api_key";

const FALLBACK_CHANNEL_ID = "3499335";
const FALLBACK_READ_API_KEY = "9HWV9GKDI4TGLY7O";

export function getThingSpeakChannelId(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(CHANNEL_ID_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  return process.env.NEXT_PUBLIC_THINGSPEAK_CHANNEL_ID || FALLBACK_CHANNEL_ID;
}

export function getThingSpeakReadApiKey(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  return process.env.NEXT_PUBLIC_THINGSPEAK_READ_API_KEY || FALLBACK_READ_API_KEY;
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
