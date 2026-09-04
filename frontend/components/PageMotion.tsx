"use client";

import type { ReactNode } from "react";

export function PageMotion({ children }: { children: ReactNode }) {
  // Keep the page visible even if a slow/older browser delays JavaScript.
  // The previous motion component rendered the content transparent until
  // its client-side animation completed, which could look like a blank page.
  return <div className="page-motion">{children}</div>;
}
