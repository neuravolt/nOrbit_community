import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { LayoutDashboard, Users, FolderKanban, TicketIcon, Settings, LogOut } from "lucide-react";
import { Providers } from "./providers";
import { Sidebar } from "./components/Sidebar"; // We'll extract Sidebar to make it a Client Component
import { AuthGuard } from "./components/AuthGuard";
import { DynamicFavicon } from "./components/DynamicFavicon";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { GlobalIncomingCallProvider } from "./components/GlobalIncomingCallProvider";

export const metadata: Metadata = {
  title: "nORBIT",
  description: "One Platform. Your Entire Business. Autonomous Enterprise Operations Platform.",
  applicationName: "nORBIT",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/norbit-icon.png", type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/norbit-icon.png",
    apple: "/norbit-icon.png",
  },
  openGraph: {
    title: "nORBIT Platform",
    description: "One Platform. Your Entire Business.",
    siteName: "nORBIT",
    images: [
      {
        url: "/norbit-logo.png",
        width: 1200,
        height: 630,
        alt: "nORBIT Enterprise Platform",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-white`}
      style={{ colorScheme: 'light' }}
    >
      <body className="h-full antialiased bg-white overflow-hidden">
        <Providers>
          <AuthGuard>
            <GlobalIncomingCallProvider>
              <div className="h-full flex flex-col md:flex-row overflow-hidden bg-white">
                <DynamicFavicon />
                <Sidebar />
                {/* Main content */}
                <main className="flex-1 overflow-y-auto bg-gray-50/50 min-w-0">
                  {children /* will render login page or main app content */}
                </main>
              </div>
            </GlobalIncomingCallProvider>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}


