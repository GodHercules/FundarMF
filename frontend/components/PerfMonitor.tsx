"use client";

import { useEffect } from "react";
import { logClientPerf } from "@/lib/perf";

export function PerfMonitor() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof performance === "undefined") return;

    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      logClientPerf("navigation", {
        ttfbMs: Math.round(nav.responseStart - nav.startTime),
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd)
      });
    }

    const paints = performance.getEntriesByType("paint");
    for (const entry of paints) {
      if (entry.name === "first-contentful-paint") {
        logClientPerf("paint", { fcpMs: Math.round(entry.startTime) });
      }
    }
  }, []);

  return null;
}
