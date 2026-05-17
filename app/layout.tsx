import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://videochat.vishalsharma.dev"),

  title: {
    default: "GlideCall - Secure One-to-One Video Chat",
    template: "%s | GlideCall",
  },

  description:
    "GlideCall is a secure peer-to-peer video chat platform for private one-to-one video calls, real-time messaging, and instant browser-based communication powered by WebRTC.",

  keywords: [
    "video chat",
    "video call",
    "secure video chat",
    "one to one video call",
    "private video chat",
    "webrtc video call",
    "peerjs video call",
    "browser video call",
    "real time messaging",
    "free video call",
    "video conferencing",
    "online video call",
    "video meeting",
    "zoom alternative",
    "whatsapp video call alternative",
    "peer to peer communication",
  ],

  authors: [
    {
      name: "Vishal Sharma",
      url: "https://videochat.vishalsharma.dev",
    },
  ],

  creator: "Vishal Sharma",
  publisher: "GlideCall",

  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: "https://videochat.vishalsharma.dev",
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://videochat.vishalsharma.dev",
    siteName: "GlideCall",
    title: "GlideCall - Secure One-to-One Video Chat",
    description:
      "Private peer-to-peer video calls and secure messaging directly in your browser using WebRTC.",

    images: [
      {
        url: "/favicon.png",
        width: 1200,
        height: 630,
        alt: "GlideCall Video Chat",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "GlideCall - Secure One-to-One Video Chat",
    description:
      "Start secure browser-based video calls and real-time messaging with GlideCall.",
    images: ["/favicon.png"],
    creator: "@vishalsharma",
  },

  category: "technology",

  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },

  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0b141a]">{children}</body>
    </html>
  );
}
