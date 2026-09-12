import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppContainer } from "@/components/layout/AppContainer";
import { AppHeader } from "@/components/layout/AppHeader";
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
  title: "Engineering Escalation Engine",
  description:
    "Internal support operations platform for case investigation and engineering escalation decisions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <AppHeader />
        <main className="flex-1 py-6 lg:py-8">
          <AppContainer>{children}</AppContainer>
        </main>
      </body>
    </html>
  );
}
