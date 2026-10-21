"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function PageMotion({ children }: { children: ReactNode }) {
  // Keep the page visible even if a slow/older browser delays JavaScript.
  // The previous motion component rendered the content transparent until
  // its client-side animation completed, which could look like a blank page.
  const pathname = usePathname();
  const isOperatorRoute = pathname === "/operator" || pathname.startsWith("/operator/");

  return <div className={isOperatorRoute ? "page-motion operator-page-motion" : "page-motion"}>{children}</div>;
}
