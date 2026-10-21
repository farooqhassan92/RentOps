import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "RentOps — Your rental business, in control", template: "%s · RentOps" },
  description:
    "A focused workspace for your car rental business. Fleet, reservations, customers, billing, and maintenance.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const keys = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        {keys ? (
          <ClerkProvider
            appearance={{
              variables: {
                colorPrimary: "#2563eb",
                borderRadius: "0.65rem",
                fontFamily: "var(--font-geist-sans), sans-serif",
              },
            }}
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
