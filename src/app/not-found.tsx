import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="content" className="flex min-h-[70vh] flex-col justify-end px-5 py-16 sm:px-8 lg:px-12">
        <p className="font-mono text-[11px] tracking-[0.18em] text-silver uppercase">Missing bay</p>
        <h1 className="mt-4 max-w-4xl text-heading-3xl">This aisle does not exist</h1>
        <p className="mt-6 max-w-md text-silver">
          The site keeps three rooms: the index, the face, and the dock. This address is none of them.
        </p>
        <Link href="/" className={`${buttonVariants({ size: "lg" })} mt-8 w-fit`}>
          Back to the index
        </Link>
      </main>
    </>
  )
}
