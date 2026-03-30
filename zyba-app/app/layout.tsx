import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zyba App",
  description: "Zyba travel app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}