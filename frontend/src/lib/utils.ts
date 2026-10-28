import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function extractErrorMessage(err: unknown, fallback = "An error occurred. Please try again."): string {
  const error = record(err);
  const response = record(error.response);
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return "The request timed out. Check whether it completed before trying again.";
  }
  if (error.code === "ERR_NETWORK") return "Cannot reach the server. Check your connection and try again.";
  if (response.status === 429) return "Too many requests. Please wait a moment and try again.";
  if (typeof response.status === "number" && response.status >= 500) return fallback;
  const detail = record(response.data).detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item: unknown) => {
      const entry = record(item);
      if (typeof entry.msg !== "string") return "";
      const field = Array.isArray(entry.loc)
        ? entry.loc.filter((part) => typeof part === "string" && part !== "body" && part !== "query").join(".")
        : "";
      return field ? `${field}: ${entry.msg}` : entry.msg;
    }).filter(Boolean);
    return messages.length ? messages.join("; ") : fallback;
  }
  return fallback;
}
