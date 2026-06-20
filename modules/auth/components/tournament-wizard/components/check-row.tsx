import { CheckCircle2 } from "lucide-react";

export function CheckRow({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border border-white/5 bg-black/20 p-3 text-sm text-slate-300">
      <CheckCircle2
        className={[
          "size-4 shrink-0",
          active ? "text-[#B6FF3D]" : "text-slate-600",
        ].join(" ")}
      />
      <span>{children}</span>
    </div>
  );
}
