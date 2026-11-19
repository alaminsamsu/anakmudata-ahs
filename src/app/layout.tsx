import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anakmudata AHS — Manajemen Jaringan & Relawan TPS",
  description: "Sistem Informasi & Penjaringan Relawan TPS Kota Makassar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}