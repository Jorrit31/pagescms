import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers";
import type { Metadata, Viewport } from "next";
import { brand } from "@/lib/brand";
import { uiLanguage } from "@/lib/i18n";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { getBaseUrl } from "@/lib/base-url";
import { cn } from "@/lib/utils";
import "./globals.css";

const brandFont = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-brand",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});
const appUrl = getBaseUrl();
export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    template: `%s | ${brand.name}`,
    default: brand.name,
  },
  description: brand.description,
  robots: { index: false, follow: false },
  // Opened from the home screen, it looks like an app (no browser bars).
  appleWebApp: {
    capable: true,
    title: brand.name,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    url: appUrl,
    siteName: brand.name,
    title: brand.name,
    description: brand.description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F7F9",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {  
	return (
    <html lang={uiLanguage} suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          brandFont.variable,
          jetbrainsMono.variable,
        )}
      >
        <Providers user={null}>
          {children}
        </Providers>
        {/* On phones, above the bar with "Opslaan" at the bottom. */}
        <Toaster mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }} />
      </body>
    </html>
  );
}
