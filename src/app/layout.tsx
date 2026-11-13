import type { Metadata } from "next"
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google"
import { SmoothScroll } from "@/components/smooth-scroll"
import { TooltipProvider } from "@/components/ui/tooltip"
import { measure } from "@/lib/metrics"
import { arrivedLayout, proposeLayout } from "@/lib/place"
import { AFFINITIES, SKUS, SLOTS } from "@/lib/warehouse"
import "./globals.css"

// Space Grotesk carries the display role, Inter the body role, and Geist
// Mono the micro-labels; all are open faces served by next/font. No
// licensed typeface is bundled or hotlinked.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
})

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
})

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
})

// The demo's own headline figure, from the same locked math the floor runs.
const arrived = arrivedLayout(SKUS, SLOTS)
const proposal = proposeLayout(SKUS, SLOTS, AFFINITIES)
const arrivedKm = Math.round(measure(arrived, SKUS, SLOTS, AFFINITIES).walkMeters / 1000)
const proposalKm = Math.round(measure(proposal.assignment, SKUS, SLOTS, AFFINITIES).walkMeters / 1000)

export const metadata: Metadata = {
  // The origin only: the file-convention image path already carries the
  // /quay base path in the Pages build, and joining it with a based
  // metadataBase would double the prefix.
  metadataBase: new URL("https://sukrutn.github.io/"),
  title: {
    default: "Quay, a slotting notebook",
    template: "%s. Quay",
  },
  description: `Quay re-slots your forward pick face: fast movers beside the dock, heavy goods on the floor, co-picked goods together. On its demo face, a day of pick walking drops from ${arrivedKm} km to ${proposalKm} km.`,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} dark h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider delay={250}>{children}</TooltipProvider>
        <SmoothScroll />
      </body>
    </html>
  )
}
