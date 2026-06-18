import { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getBenefitMilestoneByThreshold } from "@/lib/benefitMilestones";

interface BenefitMilestoneDialogProps {
  thresholds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const BenefitMilestoneDialog = ({ thresholds, open, onOpenChange }: BenefitMilestoneDialogProps) => {
  const milestones = thresholds
    .map((t) => getBenefitMilestoneByThreshold(t))
    .filter(Boolean) as NonNullable<ReturnType<typeof getBenefitMilestoneByThreshold>>[];

  // Sort by threshold descending (highest value first)
  const sortedMilestones = [...milestones].sort((a, b) => b.threshold - a.threshold);

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset index when thresholds change
  useEffect(() => {
    setActiveIndex(0);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [thresholds]);

  if (sortedMilestones.length === 0) return null;

  const single = sortedMilestones.length === 1;

  const scrollTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, sortedMilestones.length - 1));
    setActiveIndex(clamped);
    if (scrollRef.current) {
      const child = scrollRef.current.children[clamped] as HTMLElement | undefined;
      child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-border/50 bg-card">
        <div className="p-4 sm:p-6 space-y-4">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl sm:text-2xl">
              {single
                ? "¡Te estás acercando a un beneficio!"
                : `¡Tienes ${sortedMilestones.length} beneficios por desbloquear!`}
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-muted-foreground">
              <span className="text-gradient-gold glow-gold font-semibold">
                ¿Sabes que si cumples estas métricas te estarías calificando para{" "}
                {single ? "este beneficio" : "estos beneficios"}?
              </span>
              {single && (
                <span className="block font-semibold text-foreground mt-1">
                  Meta detectada: {usdFormatter.format(sortedMilestones[0].threshold)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Carousel area */}
          <div className="relative">
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {sortedMilestones.map((milestone) => (
                <div
                  key={milestone.threshold}
                  className="snap-center shrink-0 w-full space-y-2"
                >
                  <p className="text-xs font-mono uppercase text-muted-foreground text-center">
                    Meta: {usdFormatter.format(milestone.threshold)}
                  </p>
                  <img
                    src={milestone.image}
                    alt={`Beneficio desbloqueable al alcanzar ${usdFormatter.format(milestone.threshold)} de facturación estimada`}
                    className="w-full h-auto rounded-md border border-border/40"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>

            {/* Nav arrows (only for multi) */}
            {!single && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border-border/50 z-10"
                  onClick={() => scrollTo(activeIndex - 1)}
                  disabled={activeIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border-border/50 z-10"
                  onClick={() => scrollTo(activeIndex + 1)}
                  disabled={activeIndex === sortedMilestones.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Dots indicator */}
          {!single && (
            <div className="flex justify-center gap-1.5">
              {sortedMilestones.map((m, i) => (
                <button
                  key={m.threshold}
                  onClick={() => scrollTo(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === activeIndex ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)} className="bg-gradient-brand shadow-brand">
              Entendido
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BenefitMilestoneDialog;
