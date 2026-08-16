import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractErrorMessage(err: any, fallback: string = "An error occurred. Please try again."): string {
  if (!err) return fallback;
  
  const detail = err.response?.data?.detail;
  if (!detail) {
    return err.message || fallback;
  }
  
  if (typeof detail === "string") {
    return detail;
  }
  
  if (Array.isArray(detail)) {
    try {
      return detail
        .map((e: any) => {
          const locStr = e.loc ? e.loc.filter((l: any) => l !== "body" && l !== "query").join(".") : "";
          return locStr ? `${locStr}: ${e.msg}` : e.msg;
        })
        .join(", ");
    } catch {
      return fallback;
    }
  }
  
  if (typeof detail === "object") {
    return JSON.stringify(detail);
  }
  
  return fallback;
}
