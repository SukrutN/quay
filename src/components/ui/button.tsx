import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[2px] border bg-clip-padding font-mono text-[11px] tracking-[0.14em] uppercase whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-signal/50 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-signal text-paper hover:bg-signal hover:text-deep",
        outline: "border-paper/25 text-paper hover:border-paper",
        secondary: "border-paper/15 bg-smoke text-paper hover:border-signal",
        ghost:
          "border-transparent font-sans text-sm tracking-normal text-silver normal-case hover:text-paper",
        destructive:
          "border-destructive text-destructive hover:bg-destructive hover:text-paper",
        link: "border-transparent font-sans text-sm tracking-normal text-signal normal-case underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-4",
        xs: "h-7 px-2 text-[10px]",
        sm: "h-8 gap-1.5 px-3",
        lg: "h-12 gap-2 px-5 text-xs",
        icon: "size-10",
        "icon-xs": "size-6",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
