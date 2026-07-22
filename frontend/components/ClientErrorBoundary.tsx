"use client";

import React from "react";
import { reportClientError } from "@/lib/observability";

export class ClientErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportClientError({ message: error.message, stack: `${error.stack ?? ""}\n${info.componentStack}`, operation: "react.render", route: typeof window !== "undefined" ? window.location.pathname : undefined });
  }

  render() {
    if (this.state.hasError) return <main className="app-container py-12"><h1 className="text-xl font-semibold">Não foi possível carregar esta tela.</h1><p className="mt-2 text-sm text-slate">Recarregue a página e tente novamente.</p></main>;
    return this.props.children;
  }
}
