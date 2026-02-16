import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "صانع ريلز دلائل الخيرات",
  description: "إنشاء فيديوهات 9:16 من دلائل الخيرات بخلفيات وصوت ومعاينة حيّة.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "Cairo, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
        <div className="pointer-events-none fixed inset-0 opacity-[0.08] islamic-pattern" />
        {children}
      </body>
    </html>
  );
}
