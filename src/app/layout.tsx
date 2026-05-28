import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ModalHost } from "@/components/Modal";
import { VERSION, GIT_SHA_SHORT, GIT_DIRTY, BUILT_AT } from "@/lib/version";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const VERSION_META = `v${VERSION}+${GIT_SHA_SHORT}${GIT_DIRTY ? "-dirty" : ""}`;

export const metadata: Metadata = {
  title: "StayBattle",
  description: "Pit Airbnb listings against each other. Vote with your crew, argue in the comments, settle it on the map.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  other: {
    "staybattle-version": VERSION_META,
    "staybattle-built-at": BUILT_AT,
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
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ModalHost />
      </body>
    </html>
  );
}
