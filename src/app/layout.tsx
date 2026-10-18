import type { Metadata } from "next"
import { Geist_Mono, Schibsted_Grotesk } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const display = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Quay — slotting for House 4",
    template: "%s — Quay",
  },
  description:
    "Quay places thirty fictional cartons on a forward pick face. A kinship-reach score balances walk, weight, cube, and items that leave the dock together.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} dark h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider delay={250}>{children}</TooltipProvider>
      </body>
    </html>
  )
}
