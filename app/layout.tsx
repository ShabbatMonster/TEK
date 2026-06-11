import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Rajdhani,
  Space_Mono,
  Archivo_Black,
  VT323,
  Newsreader,
  JetBrains_Mono,
  Silkscreen,
} from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-rajdhani" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono" });
const archivoBlack = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-archivo-black" });
const vt323 = VT323({ subsets: ["latin"], weight: "400", variable: "--font-vt323" });
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const silkscreen = Silkscreen({ subsets: ["latin"], weight: "400", variable: "--font-silkscreen" });

export const metadata: Metadata = {
  title: "TEK — The Everything Kernel",
  description: "A modular Solana operating system. Nine applications. One viewport.",
};

export const viewport: Viewport = {
  themeColor: "#07080a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [
    geist.variable,
    geistMono.variable,
    rajdhani.variable,
    spaceMono.variable,
    archivoBlack.variable,
    vt323.variable,
    newsreader.variable,
    jetbrains.variable,
    silkscreen.variable,
  ].join(" ");

  return (
    <html lang="en" className={fontVars}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
