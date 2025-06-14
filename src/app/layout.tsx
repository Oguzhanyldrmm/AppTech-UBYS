import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../../contexts/AuthContext";
import NoSSR from "../components/NoSSR";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "University Platform",
  description: "Platform for restaurants and communities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NoSSR>
          <AuthProvider>
            {children}
          </AuthProvider>
        </NoSSR>
      </body>
    </html>
  );
}
