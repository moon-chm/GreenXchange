import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import SmoothScrolling from "@/components/shared/SmoothScrolling";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#2D4A30",
};

export const metadata: Metadata = {
  title: {
    default: "GreenXchange — Environmental Intelligence Platform",
    template: "%s | GreenXchange",
  },
  description:
    "Track your plants, earn GXC rewards, and contribute to urban greening with AI-powered environmental intelligence.",
  keywords: [
    "GreenXchange",
    "urban greening",
    "plant tracking",
    "carbon offset",
    "GXC token",
    "environmental intelligence",
    "eco rewards",
    "community drives",
    "air quality",
  ],
  authors: [{ name: "GreenXchange Team" }],
  creator: "GreenXchange",
  publisher: "GreenXchange",
  metadataBase: new URL("http://localhost"),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "http://localhost",
    siteName: "GreenXchange",
    title: "GreenXchange — Environmental Intelligence Platform",
    description:
      "Track your plants, earn GXC rewards, and contribute to urban greening with AI-powered insights.",
    images: [
      {
        url: "/logo.jpg",
        width: 1024,
        height: 1024,
        alt: "GreenXchange Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "GreenXchange — Environmental Intelligence Platform",
    description: "Track plants, earn eco-rewards, and drive urban sustainability.",
    images: ["/logo.jpg"],
  },
  icons: {
    icon: [
      { url: "/logo.jpg", type: "image/jpeg" },
    ],
    apple: "/logo.jpg",
    shortcut: "/logo.jpg",
  },
  manifest: undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="icon" href="/logo.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
        <meta name="theme-color" content="#2D4A30" />
        <meta name="application-name" content="GreenXchange" />
        <meta name="msapplication-TileColor" content="#2D4A30" />
      </head>
      <body className="bg-parchment text-canopy antialiased">
        <AuthProvider>
          <SmoothScrolling>{children}</SmoothScrolling>
        </AuthProvider>
      </body>
    </html>
  );
}


