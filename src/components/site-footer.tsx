import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-5 py-10 sm:px-8 lg:px-12">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="text-3xl tracking-[-0.04em]">Quay</p>
          <p className="mt-3 max-w-sm text-silver">
            A slotting notebook for one fictional forward face. The extract is invented. Nothing here is a customer, a port, or a measured building.
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">House</p>
          <p className="mt-3 text-paper">Marrow Goods</p>
          <p className="text-silver">House 4, Coldwater Reach</p>
          <p className="text-silver">South dock · aisles A–E</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2">
          <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">Index</p>
          <Link href="/" className="w-fit hover:text-signal">
            01 Index
          </Link>
          <Link href="/floor" className="w-fit hover:text-signal">
            02 The face
          </Link>
          <Link href="/#method" className="w-fit hover:text-signal">
            03 The score
          </Link>
        </nav>
      </div>
    </footer>
  )
}

export function Marquee() {
  const phrase = "Place the fast work nearer the dock"
  return (
    <div className="overflow-hidden border-y border-white/10 py-5">
      <div className="marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <p key={copy} className="flex shrink-0 items-center gap-8 pr-8 text-[clamp(1.6rem,3vw,2.6rem)] tracking-[-0.04em]">
            {Array.from({ length: 5 }).map((_, index) => (
              <span key={index} className="flex items-center gap-8">
                {phrase}
                <span className="text-signal">+</span>
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  )
}
