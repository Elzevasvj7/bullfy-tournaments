import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "polygon-shape group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 rounded-none border border-transparent px-2 py-0.5 text-xs font-black uppercase tracking-[0.08em] whitespace-nowrap transition-all [--polygon-border:transparent] [--polygon-bg:transparent] focus-visible:ring-[2px] focus-visible:ring-ring/45 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "text-primary-foreground [--polygon-bg:var(--primary)] [a]:hover:[--polygon-bg:var(--primary)]",
        secondary:
          "text-secondary-foreground [--polygon-bg:var(--secondary)] [a]:hover:[--polygon-bg:var(--secondary)]",
        destructive:
          "text-destructive [--polygon-bg:color-mix(in_srgb,var(--destructive)_12%,transparent)] [--polygon-border:color-mix(in_srgb,var(--destructive)_35%,transparent)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "text-foreground [--polygon-border:var(--border)] [--polygon-hover-bg:var(--muted)]",
        ghost:
          "text-muted-foreground [--polygon-hover-bg:var(--muted)] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        neonBlue:
          "text-bullfy-neon-blue [--polygon-bg:rgb(0_229_255_/_0.08)] [--polygon-border:rgb(0_229_255_/_0.42)] [--polygon-hover-border:rgb(0_229_255_/_0.75)]",
        neonGreen:
          "text-bullfy-neon-green [--polygon-bg:rgb(182_255_61_/_0.08)] [--polygon-border:rgb(182_255_61_/_0.42)] [--polygon-hover-border:rgb(182_255_61_/_0.75)]",
        neonRed:
          "text-bullfy-neon-red [--polygon-bg:rgb(255_59_92_/_0.08)] [--polygon-border:rgb(255_59_92_/_0.42)] [--polygon-hover-border:rgb(255_59_92_/_0.75)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
