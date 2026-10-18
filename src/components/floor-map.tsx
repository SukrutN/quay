import { skuById, type Assignment, type Level, AISLES, BAYS } from "@/lib/warehouse"

const PICK_SCALE = 240

export function FloorMap({
  level,
  assignment,
  selected,
  onSelect,
}: {
  level: Level
  assignment: Assignment
  selected: string | null
  onSelect: (slotId: string) => void
}) {
  const rows = [...BAYS].reverse()

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[40rem]">
        <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-silver uppercase">North end</p>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `2.5rem repeat(${AISLES.length}, minmax(0, 1fr))` }}
        >
          <div />
          {AISLES.map((aisle, index) => (
            <div key={aisle} className="pb-1 font-mono text-[11px] tracking-[0.14em] text-silver uppercase">
              {aisle}
              <span className="mt-0.5 block text-[10px] tracking-[0.12em] normal-case">
                {index === 0 ? "Near dock" : index === AISLES.length - 1 ? "Far side" : "Aisle"}
              </span>
            </div>
          ))}
          {rows.map((bay) => (
            <BayRow
              key={bay}
              bay={bay}
              level={level}
              assignment={assignment}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <span className="h-px flex-1 bg-signal" />
          <span className="font-mono text-[11px] tracking-[0.18em] text-signal uppercase">South dock</span>
          <span className="h-px flex-1 bg-signal" />
        </div>
        <p className="mt-3 font-mono text-[10px] tracking-[0.14em] text-silver uppercase">
          Greener means more picks · a hollow bay is open · return walks start at the dock
        </p>
        <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-silver uppercase lg:hidden">
          Swipe sideways for aisles D and E.
        </p>
      </div>
    </div>
  )
}

function BayRow({
  bay,
  level,
  assignment,
  selected,
  onSelect,
}: {
  bay: number
  level: Level
  assignment: Assignment
  selected: string | null
  onSelect: (slotId: string) => void
}) {
  return (
    <>
      <div className="flex items-center font-mono text-[10px] text-silver">{String(bay).padStart(2, "0")}</div>
      {AISLES.map((aisle) => {
        const id = `${aisle}-${String(bay).padStart(2, "0")}-L${level}`
        const skuId = assignment[id]
        const sku = skuId ? skuById.get(skuId) : undefined
        const heat = sku ? Math.min(1, sku.picks / PICK_SCALE) : 0
        const ink = heat > 0.5
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={selected === id}
            aria-label={sku ? `${id}, ${sku.name}, ${sku.picks} picks` : `${id}, open bay`}
            className={`min-h-[4.6rem] border px-2 py-1.5 text-left transition-colors ${
              selected === id ? "border-paper" : "border-white/10 hover:border-white/40"
            } ${ink ? "text-deep" : "text-paper"}`}
            style={
              sku
                ? {
                    backgroundColor: `color-mix(in srgb, #51e076 ${Math.round(14 + heat * 76)}%, #181914)`,
                  }
                : undefined
            }
          >
            <span className={`block font-mono text-[10px] tracking-[0.08em] ${ink ? "text-deep/70" : "text-silver"}`}>
              {aisle}-{String(bay).padStart(2, "0")}
            </span>
            <span className="mt-1 block truncate text-sm tracking-[-0.03em]">{sku ? sku.short : "Open"}</span>
            <span className={`mt-0.5 block font-mono text-[10px] ${ink ? "text-deep/80" : "text-silver"}`}>
              {sku ? `${sku.picks} picks` : "—"}
            </span>
          </button>
        )
      })}
    </>
  )
}
