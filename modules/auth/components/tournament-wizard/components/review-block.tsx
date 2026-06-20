export function ReviewBlock({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-white/10 bg-black/25 p-4">
      <Icon className="size-5 text-[#00E5FF]" />
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-base font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
