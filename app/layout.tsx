import type { Metadata } from "next";
import "./globals.css";

// Fonts (Archivo + IBM Plex Mono) and <Providers> are added in Phase 5 — see DESIGN.md.
export const metadata: Metadata = {
  title: "B.AI — Metro Manila Commute Buddy",
  description: "Tells you which jeep, bus, or train to ride in Metro Manila.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fil" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
