import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Death By Chocolate | Online Sipariş",
  description: "Death By Chocolate online tatlı ve kahve siparişi",
  icons: {
    icon: "/logo.jpg",
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
