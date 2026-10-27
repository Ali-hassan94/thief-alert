// web/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "Thief Alert",
  description: "Apne ilaqe me chor ka alert paayen",
  appleWebApp: { capable: true, title: "Thief Alert", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#dc2626",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}