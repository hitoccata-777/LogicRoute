import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LogicRoute - Master your logic, one question at a time",
  description: "Analyze logical reasoning questions with AI-powered insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Navigation - hidden for now */}
        <nav className="hidden"></nav>
        {children}
      </body>
    </html>
  );
}

