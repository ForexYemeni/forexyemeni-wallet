import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700", "800", "900"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F0B90B",
};

export const metadata: Metadata = {
  title: "فوركس يمني | محفظة USDT",
  description: "محفظة رقمية يمنية لإدارة العملات الرقمية USDT TRC20",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "فوركس يمني",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${tajawal.variable} font-[family-name:var(--font-tajawal)] antialiased`}>
        {/* Native loading overlay — shows IMMEDIATELY before React hydrates (fixes black screen in APK) */}
        <div id="fx-app-loader" style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#0a0a14', transition: 'opacity 0.4s ease',
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #F0B90B, #D4AF37)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(240,185,11,0.3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="#0a0a14"/><path d="M2 17l10 5 10-5" stroke="#0a0a14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12l10 5 10-5" stroke="#0a0a14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ width: 32, height: 32, border: '3px solid rgba(240,185,11,0.2)', borderTopColor: '#F0B90B', borderRadius: '50%', animation: 'fxspin 0.8s linear infinite' }}></div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 16, fontFamily: 'Tajawal, sans-serif' }}>جاري التحميل...</p>
          <style dangerouslySetInnerHTML={{ __html: '@keyframes fxspin{to{transform:rotate(360deg)}}' }} />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Theme init (must run before paint)
                var t = localStorage.getItem('forexyemeni-theme');
                if (t === 'light') {
                  document.documentElement.classList.remove('dark');
                }
                // Service Worker
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function() {});
                  });
                }
                // Hide native loader when React is ready (set by page.tsx)
                window.__fxAppReady = function() {
                  var loader = document.getElementById('fx-app-loader');
                  if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(function() { loader.remove(); }, 400);
                  }
                };
                // Safety: hide after 15 seconds even if React fails
                setTimeout(function() {
                  var loader = document.getElementById('fx-app-loader');
                  if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(function() { loader.remove(); }, 400);
                  }
                }, 15000);
              })();
            `,
          }}
        />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-tajawal)',
              direction: 'rtl',
            },
            classNames: {
              toast: 'glass-card',
              title: 'text-foreground',
              description: 'text-muted-foreground',
            },
          }}
        />
      </body>
    </html>
  );
}
