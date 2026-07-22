import "./globals.css";
import type { Metadata } from "next";
import { Merriweather, Work_Sans } from "next/font/google";
import { Notifications } from "@/components/Notifications";
import { PerfMonitor } from "@/components/PerfMonitor";
import { ClientErrorMonitor } from "@/components/ClientErrorMonitor";
import { ClientErrorBoundary } from "@/components/ClientErrorBoundary";

const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-body" });
const merriweather = Merriweather({ subsets: ["latin"], variable: "--font-display", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "FundarMF",
  description: "Sistema de Workflow para Abertura de Empresa",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${workSans.variable} ${merriweather.variable}`}>
        <div className="app-shell text-ink">
          <div className="ledger-bg min-h-screen"><ClientErrorBoundary>{children}</ClientErrorBoundary></div>
          <Notifications />
        </div>
        <PerfMonitor />
        <ClientErrorMonitor />
      </body>
    </html>
  );
}
