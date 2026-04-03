import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "فوركس يمني | محفظة USDT",
  description: "محفظة رقمية يمنية لإدارة العملات الرقمية USDT TRC20",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${tajawal.variable} font-[family-name:var(--font-tajawal)] antialiased`}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'rgba(20, 20, 30, 0.95)',
              border: '1px solid rgba(240, 185, 11, 0.3)',
              color: '#fff',
              fontFamily: 'var(--font-tajawal)',
              direction: 'rtl',
            },
          }}
        />
      </body>
    </html>
  );
}
