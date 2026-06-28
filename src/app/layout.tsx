import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  title: "See Our Baby | AI Future Baby Generator",
  description:
    "Upload a photo of each parent and our AI imagines what your future baby could look like, just for fun, in seconds.",
  openGraph: {
    title: "See Our Baby: What will your baby look like?",
    description: "Upload two parents, see your future baby in HD. AI-generated, just for fun. 👶",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "See Our Baby: What will your baby look like?",
    description: "Upload two parents, see your future baby in HD. AI-generated, just for fun. 👶",
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

// Honest structured data only, no ratings/accuracy claims we can't back.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", name: "See Our Baby", legalName: "UpfrontOps LLC", url: "https://seeourbaby.com", email: "support@seeourbaby.com" },
    { "@type": "WebSite", name: "See Our Baby", url: "https://seeourbaby.com" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-rose-100 py-6 px-4 text-center text-xs text-gray-400">
          <p className="max-w-xl mx-auto">
            For entertainment only. An AI&apos;s imagination, not a real genetic prediction. The photos you upload are
            processed (including by our AI provider) to create your image, then <strong>deleted</strong>.
          </p>
          <p className="mt-2 space-x-3">
            <Link href="/privacy" className="hover:text-rose-500 underline">Privacy</Link>
            <Link href="/terms" className="hover:text-rose-500 underline">Terms</Link>
            <Link href="/refunds" className="hover:text-rose-500 underline">Refund Policy</Link>
            <a href="mailto:support@seeourbaby.com" className="hover:text-rose-500 underline">support@seeourbaby.com</a>
          </p>
          <p className="mt-2">© {new Date().getFullYear()} See Our Baby · UpfrontOps LLC</p>
        </footer>
      </body>
    </html>
  );
}
