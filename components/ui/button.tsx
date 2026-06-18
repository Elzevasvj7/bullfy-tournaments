import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "text-[13px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        neonBlue:
          "border-[color:var(--bullfy-neon-blue)] bg-[color-mix(in_srgb,var(--bullfy-neon-blue)_10%,transparent)] text-[var(--bullfy-neon-blue)] shadow-[0_0_22px_rgb(0_229_255_/_0.36)] hover:bg-[color-mix(in_srgb,var(--bullfy-neon-blue)_16%,transparent)] hover:shadow-[0_0_30px_rgb(0_229_255_/_0.48)] focus-visible:ring-[color-mix(in_srgb,var(--bullfy-neon-blue)_42%,transparent)]",
        neonGreen:
          "text-bullfy-neon-green border-bullfy-neon-green/60 bg-bullfy-neon-green/5 shadow-[0_0_18px_rgba(182,255,61,0.45)] hover:shadow-[0_0_26px_rgba(182,255,61,0.75)] animate-pulse",
        neonRed:
          "border bg-[color-mix(in_srgb,var(--bullfy-neon-red)_10%,transparent)] text-[var(--bullfy-neon-red)] shadow-[0_0_22px_rgb(255_59_92_/_0.34)] hover:bg-[color-mix(in_srgb,var(--bullfy-neon-red)_16%,transparent)] hover:shadow-[0_0_30px_rgb(255_59_92_/_0.48)] focus-visible:ring-[color-mix(in_srgb,var(--bullfy-neon-red)_42%,transparent)]",
        neonBlueSolid:
          "border-[color:var(--bullfy-neon-blue)] bg-[var(--bullfy-neon-blue)] text-[#03111d] shadow-[0_0_22px_rgb(0_229_255_/_0.42)] hover:brightness-110 focus-visible:ring-[color-mix(in_srgb,var(--bullfy-neon-blue)_42%,transparent)]",
        neonGreenSolid:
          "border-[color:var(--bullfy-neon-green)] bg-[var(--bullfy-neon-green)] text-[#071102] shadow-[0_0_22px_rgb(182_255_61_/_0.46)] hover:brightness-110 focus-visible:ring-[color-mix(in_srgb,var(--bullfy-neon-green)_42%,transparent)]",
        neonRedSolid:
          "border-[color:var(--bullfy-neon-red)] bg-[var(--bullfy-neon-red)] text-white shadow-[0_0_22px_rgb(255_59_92_/_0.42)] hover:brightness-110 focus-visible:ring-[color-mix(in_srgb,var(--bullfy-neon-red)_42%,transparent)]",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
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
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
