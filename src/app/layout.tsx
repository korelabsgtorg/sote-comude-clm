import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/(base)/theme/provider";
import Header from "@/components/(base)/layout/header";
import { createClient } from "@/utils/supabase/server";
import Providers from "@/components/(base)/providers/QueryProviders";
import { UserProvider } from "@/components/(base)/providers/UserProvider";
import ConditionalFooter from "@/components/(base)/layout/ConditionalFooter";
import OfflineBanner from "@/components/OfflineBanner";
import GlobalHexagonPattern from "@/components/ui/GlobalHexagonPattern";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "SOTE - Sistema de Organización Territorial Estratégica",
  description: "Plataforma Integral para la Gestión del SOTE y los COMUDE",
  applicationName: "SOTE-COMUDE",
  appleWebApp: {
    capable: true,
    title: "SOTE - Sistema de Organización Territorial Estratégica",
  },
  icons: {
    icon: "/apple-touch-icon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="es" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        style={{ 
          paddingTop: 'var(--banner-height, 0px)',
          transition: 'padding-top 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background flex flex-col`}
      >
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <UserProvider user={user}>
              <GlobalHexagonPattern />
              <OfflineBanner />
              <Header />
              <main className="flex-1 w-full flex flex-col relative z-[1]">
                {children}
              </main>
              <ConditionalFooter />
            </UserProvider>
          </ThemeProvider>
        </Providers>
        <Script
          src="https://cdn.lordicon.com/lordicon.js"
          strategy="afterInteractive"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('touchstart', function (event) {
                if (event.touches.length > 1) {
                  event.preventDefault();
                }
              }, { passive: false });
              document.addEventListener('gesturestart', function (event) {
                event.preventDefault();
              }, { passive: false });
            `,
          }}
        />
      </body>
    </html>
  );
}
