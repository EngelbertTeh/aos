import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assembly of Sekkhas",
  description: "A mobile-friendly space for sutta study through shared reading in turns, in a calm and collective flow.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f8f3e8] text-[#2f241d]">{children}</body>
    </html>
  );
}
