import type { Metadata } from "next";
import { Geist, Inter, JetBrains_Mono } from "next/font/google";
import { SITE } from "@/lib/agent/content";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  alternates: { types: { "text/markdown": "/index.md" } },
  title: "Rosic | The Agent-as-User Landing Framework",
  description:
    "Vercel's fastest-growing user isn't human. A working prototype of product-landing measurement, rebuilt for the agent era. Built on Vercel with Claude Code.",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "agent-landing",
  alternateName: SITE.name,
  description: SITE.summary,
  url: SITE.url,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Node.js 20+",
  codeRepository: SITE.repo,
  license: "https://opensource.org/licenses/MIT",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: SITE.author, url: "https://andyrosic.com" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-surface text-on-surface min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        {children}
      </body>
    </html>
  );
}
