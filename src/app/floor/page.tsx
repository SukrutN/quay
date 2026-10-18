import type { Metadata } from "next"
import { FloorStudio } from "@/components/floor-studio"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "The face",
  description:
    "Place thirty fictional cartons on House 4. Compare the arrived layout with a kinship-reach proposal, then read any bay.",
}

export default function FloorPage() {
  return (
    <>
      <SiteHeader />
      <main id="content">
        <header className="px-5 pt-12 pb-8 sm:px-8 lg:px-12 lg:pt-16">
          <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">
            02 — House 4, Coldwater Reach
          </p>
          <h1 className="rise mt-4 max-w-5xl text-[clamp(3.5rem,8vw,7.2rem)] leading-[0.86] tracking-[-0.05em]">
            The face.
          </h1>
          <p className="rise-late mt-6 max-w-2xl text-lg text-silver">
            Thirty invented SKUs. One hundred sixty bays. Compare the layout that arrived with the one Quay proposes, then click a slot or a carton to read it.
          </p>
        </header>
        <FloorStudio />
      </main>
      <SiteFooter />
    </>
  )
}
