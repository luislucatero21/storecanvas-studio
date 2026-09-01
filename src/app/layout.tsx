import type { Metadata } from "next";
import "./globals.css";
import {
  bodyFont,
  displayFont,
  instrumentSerifFont,
  interFont,
  manropeFont,
  sourceSansFont,
  spaceGroteskFont,
} from "./fonts";

export const metadata: Metadata = {
  title: "StoreCanvas — Campaign studio",
  description: "Turn real app captures into store-ready campaign assets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={[
          bodyFont.variable,
          displayFont.variable,
          manropeFont.variable,
          spaceGroteskFont.variable,
          sourceSansFont.variable,
          interFont.variable,
          instrumentSerifFont.variable,
        ].join(" ")}
      >
        {children}
      </body>
    </html>
  );
}
