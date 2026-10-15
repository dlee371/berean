import type { Metadata, Viewport } from "next";
import { Inter, Literata } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { UserNav } from "@/components/UserNav";
import "./globals.css";

// Inter for the interface, Literata (a serif designed for long reading) for Scripture.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const literata = Literata({ variable: "--font-literata", subsets: ["latin"] });

// TypeScript note: `: Metadata` says this object must match the shape Next.js
// expects for page metadata. Typos in field names become compile errors.
export const metadata: Metadata = {
  title: "Berean: Bible study with verified citations",
  description:
    "Ask questions about the Bible and get answers drawn only from the text, with every citation checked.",
  openGraph: {
    title: "Berean",
    description: "Bible study answers drawn only from the text, with every citation verified.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1a17" },
  ],
};

// `LayoutProps<"/">` is a type Next.js generates for us; it describes the
// `children` prop (the page being rendered inside this layout).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${literata.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
              Berean
            </Link>
            <div className="flex items-center gap-4 text-sm text-muted sm:gap-5">
              <Link href="/" className="hover:text-ink">
                Ask
              </Link>
              <Link href="/read" className="hover:text-ink">
                Read
              </Link>
              {/* Depends on the login cookie, so it loads separately from the static header. */}
              <Suspense>
                <UserNav />
              </Suspense>
            </div>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t border-line">
          <p className="mx-auto max-w-3xl px-4 py-4 text-xs leading-relaxed text-muted">
            Scripture from the World English Bible (public domain). Berean is a study aid, not a
            pastor. Please read every passage in its full context.{" "}
            <Link href="/about" className="underline hover:text-ink">
              How it works
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
