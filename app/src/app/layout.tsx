import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BotStory — BYOK AI storytelling",
  description: "An open, client-side, Bring-Your-Own-Key clone of infiniteworlds.app. Import worlds, play, share.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
