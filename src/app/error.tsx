"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main id="content" className="flex min-h-[70vh] flex-col justify-end px-5 py-16 sm:px-8 lg:px-12">
      <p className="font-mono text-[11px] tracking-[0.18em] text-destructive uppercase">Stalled</p>
      <h1 className="mt-4 max-w-3xl text-5xl tracking-[-0.045em] sm:text-7xl">The page stalled.</h1>
      <p className="mt-5 max-w-md text-silver">Something in the browser stopped the floor from drawing. Try the page again.</p>
      <Button className="mt-8 w-fit" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  )
}
