import {
  DM_Sans,
  Fraunces,
  Instrument_Serif,
  Inter,
  Manrope,
  Source_Sans_3,
  Space_Grotesk,
} from "next/font/google";

export const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

// Optional choices are self-hosted by next/font and are not preloaded until
// the campaign actually uses them, keeping the initial editor fast.
export const manropeFont = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  preload: false,
});

export const spaceGroteskFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  preload: false,
});

export const sourceSansFont = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans-3",
  display: "swap",
  preload: false,
});

export const interFont = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

export const instrumentSerifFont = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
  preload: false,
});
