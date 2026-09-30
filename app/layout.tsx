import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "NEXUS | AI Mission Control", description: "Auditable autonomous task execution" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
