import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skytrax Survey Admin · Delhi Airport",
  description: "Admin dashboard for the Skytrax passenger survey campaign at Delhi Airport",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
