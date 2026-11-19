import type { Metadata } from "next"
import { ScrubDriver } from "@/components/scrub"
import { FloorStudio } from "@/components/floor-studio"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "The face",
  description:
    "The demo face carries thirty invented cartons across 160 bays. Compare the layout that arrived with the one Quay proposes, then click any bay to read it.",
}

export default function FloorPage() {
  return (
    <>
      <SiteHeader />
      <main id="content">
        <ScrubDriver />
        <header data-scrub className="px-5 pt-12 pb-8 sm:px-8 lg:px-12 lg:pt-16">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">02 · House 4, the demo face</p>
          <h1 className="mt-4 max-w-5xl text-heading-2xl">The face</h1>
          <p className="mt-6 max-w-2xl text-lg text-silver">
            This is where travel turns into labor. Thirty invented cartons, 160 bays, one deliberately clumsy starting
            layout: compare what arrived with what Quay proposes, watch each carton fly to the bay it earns, then
            click a bay or a carton to read it.
          </p>
        </header>
        <FloorStudio />
      </main>
      <SiteFooter />
    </>
  )
}
