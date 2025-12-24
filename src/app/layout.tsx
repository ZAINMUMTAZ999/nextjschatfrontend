import type { Metadata } from "next";
import { Inter } from "next/font/google"; // 1. Import Font
import "./globals.css";
import Providers from "./providers"; // 2. Import from the correct file

// 3. Configure Font
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Real Time Chat",
    template: "%s | Cyberoid",
  },
  icons: {
    icon: "/vercel.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* 4. Wrap everything in the React Query Provider */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}