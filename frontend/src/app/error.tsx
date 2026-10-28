"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="font-display text-2xl font-semibold text-canopy">This page couldn’t load</h1>
      <p className="text-sm text-canopy/70">Please try again. If the problem continues, return to the dashboard.</p>
      <button onClick={reset} className="min-h-11 rounded-xl bg-forest px-6 py-3 font-semibold text-white">Try again</button>
      <Link href="/" className="min-h-11 px-4 py-3 text-sm underline">Back to dashboard</Link>
    </section>
  );
}
