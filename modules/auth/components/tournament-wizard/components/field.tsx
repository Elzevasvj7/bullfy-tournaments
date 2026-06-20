import { Label } from "@/components/ui/label";

export function Field({
  children,
  htmlFor,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor} className="text-slate-300">
        {label}
      </Label>
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        ) : null}
        {children}
      </div>
    </div>
  );
}
