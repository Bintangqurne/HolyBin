// app/layout.tsx
import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "HolyBin — Smart Trash Management",
  description: "Sistem manajemen pengambilan sampah cerdas",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
