import {
  partnersOf,
  returnWalkMeters,
  skuById,
  slotById,
  slotOf,
  levelName,
  weightWord,
  type Assignment,
} from "@/lib/warehouse"

function kinWord(strength: number) {
  if (strength >= 0.75) return "Usually together"
  if (strength >= 0.5) return "Often together"
  return "Sometimes together"
}

export function BayDetail({
  slotId,
  skuId,
  assignment,
  note,
  arrived,
  onFocusSku,
}: {
  slotId: string | null
  skuId: string | null
  assignment: Assignment
  note?: string
  arrived: boolean
  onFocusSku: (skuId: string) => void
}) {
  const slot = slotId ? slotById.get(slotId) : undefined
  const assignedId = slot ? assignment[slot.id] : skuId
  const sku = assignedId ? skuById.get(assignedId) : undefined

  if (!slot && !sku) {
    return (
      <div className="flex min-h-48 flex-col justify-end">
        <p className="font-mono text-[11px] tracking-[0.16em] text-signal uppercase">Nothing selected</p>
        <p className="mt-4 text-2xl tracking-[-0.04em]">Choose a bay, or a carton in the list.</p>
        <p className="mt-3 text-sm leading-relaxed text-silver">
          The face is readable cell by cell. Open bays stay hollow. Greener cells leave the dock more often.
        </p>
      </div>
    )
  }

  const partners = sku ? partnersOf(sku.id) : []

  return (
    <div>
      {slot ? (
        <>
          <p className="font-mono text-[11px] tracking-[0.16em] text-signal uppercase">{slot.id}</p>
          <h2 className="mt-3 text-3xl tracking-[-0.04em]">{levelName(slot.level)}</h2>
          <p className="mt-2 text-sm text-silver">
            {slot.golden ? "Golden band · waist to shoulder" : levelName(slot.level)}
            {" · "}
            {Math.round(returnWalkMeters(slot))} m return
            {" · "}
            {slot.cubeLiters} L {slot.wide ? "wide bay" : "standard bay"}
          </p>
        </>
      ) : (
        <p className="font-mono text-[11px] tracking-[0.16em] text-signal uppercase">Off the face</p>
      )}

      {sku ? (
        <div className="mt-8">
          <p className="text-2xl tracking-[-0.04em]">{sku.name}</p>
          <p className="mt-1 font-mono text-[11px] tracking-[0.14em] text-silver uppercase">{sku.id}</p>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
            <div>
              <dt className="font-mono text-[10px] tracking-[0.14em] text-silver uppercase">Picks</dt>
              <dd className="mt-1 text-lg">{sku.picks}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-[0.14em] text-silver uppercase">Cube</dt>
              <dd className="mt-1 text-lg">{sku.cubeLiters} L</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-[0.14em] text-silver uppercase">Weight</dt>
              <dd className="mt-1 text-lg">
                {sku.weightKg}
                <span className="ml-1 font-mono text-[10px] text-silver">{weightWord(sku.weightKg)}</span>
              </dd>
            </div>
          </dl>
          {slot ? (
            <p className="mt-4 text-sm text-silver">
              Fills {Math.round((sku.cubeLiters / slot.cubeLiters) * 100)}% of this bay.
            </p>
          ) : (
            <p className="mt-4 text-sm text-silver">This carton is not standing anywhere on the current face.</p>
          )}
          {arrived || note ? (
            <p className="mt-4 text-sm leading-relaxed text-paper/90">
              {arrived
                ? "This is where the extract found it. Fast cartons were pushed toward the north end and the top beam, into the first hole that could hold their cube."
                : note}
            </p>
          ) : null}
          <div className="mt-8">
            <p className="font-mono text-[11px] tracking-[0.16em] text-silver uppercase">Leaves with</p>
            {partners.length === 0 ? (
              <p className="mt-3 text-sm text-silver">No co-pick tie is recorded for this carton.</p>
            ) : (
              <ul className="mt-2">
                {partners.map((partner) => {
                  const other = skuById.get(partner.id)
                  const otherSlot = slotOf(assignment, partner.id)
                  return (
                    <li key={partner.id} className="border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => onFocusSku(partner.id)}
                        className="flex w-full items-baseline justify-between gap-4 py-3 text-left hover:text-signal"
                      >
                        <span>{other?.name}</span>
                        <span className="shrink-0 text-right font-mono text-[10px] tracking-[0.12em] text-silver uppercase">
                          {kinWord(partner.strength)}
                          <span className="mt-1 block normal-case tracking-normal">
                            {otherSlot ? otherSlot.id : "Off the face"}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-8 text-sm leading-relaxed text-silver">
          Open bay. Nothing in the current layout stands here. A fast, light carton would rather have a golden hole like this than a long walk north.
        </p>
      )}
    </div>
  )
}
