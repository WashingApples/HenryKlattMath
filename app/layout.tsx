import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Henry Klatt | Mathematical Logic & Computability";
const description = "Henry Klatt is a mathematics Ph.D. student at the George Washington University, researching computability theory, cohesive products, and algebraic structures.";

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#15191f" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const origin = `${protocol}://${host}`;
  return { title, description, icons: { icon: "/favicon.png" }, openGraph: { title, description, type: "website", images: [{ url: `${origin}/og-blue.png`, alt: "Henry Klatt — Mathematical logic & computability" }] }, twitter: { card: "summary_large_image", title, description, images: [`${origin}/og-blue.png`] } };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script src="/theme-init.js" /></head>
      <body>{children}<script src="/theme.js" defer /><script src="/puzzle.js" type="module" /></body>
    </html>
  );
}
