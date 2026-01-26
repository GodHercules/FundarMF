import "./globals.css";
import type { Metadata } from "next";
import { Merriweather, Work_Sans } from "next/font/google";

const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-body" });
const merriweather = Merriweather({ subsets: ["latin"], variable: "--font-display", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "FundarMF",
  description: "Sistema de Workflow para Abertura de Empresa"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${workSans.variable} ${merriweather.variable}`}>
        <div className="min-h-screen bg-paper text-ink">
          <div className="ledger-bg min-h-screen">
            <div className="bg-gradient-to-br from-paper via-white to-ledger">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
