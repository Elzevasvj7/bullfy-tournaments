export function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-[#060B1F]/70 p-3 text-center">
      <p className="text-base font-black text-white">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
    </div>
  );
}
