import React from "react";
import Image from "next/image";

interface GxcLogoProps {
  size?: number;
  className?: string;
  /** "mark" = icon only  |  "full" = icon + wordmark */
  variant?: "mark" | "full";
  /** For dark backgrounds (sidebar, login dark panels) */
  dark?: boolean;
}

export default function GxcLogo({
  size = 32,
  className = "",
  variant = "full",
  dark = false,
}: GxcLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Logo mark */}
      <div
        style={{ width: size, height: size, minWidth: size }}
        className="rounded-xl overflow-hidden shadow-sm"
      >
        <Image
          src="/logo.jpg"
          alt="GreenXchange logo"
          width={size}
          height={size}
          className="object-cover"
          priority
        />
      </div>

      {/* Wordmark */}
      {variant === "full" && (
        <div className="leading-none">
          <span
            className={`font-display font-bold tracking-tight ${
              dark ? "text-parchment" : "text-canopy"
            }`}
            style={{ fontSize: size * 0.56 }}
          >
            Green
            <span className={dark ? "text-fern" : "text-fern"}>Xchange</span>
          </span>
        </div>
      )}
    </div>
  );
}
