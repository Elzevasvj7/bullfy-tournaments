import LPMarginAnalysis from "./LPMarginAnalysis";

interface Props {
  category: string;
  report: string;
}

export default function DealingReportRouter({ category, report }: Props) {
  if (category === "risk" && report === "lp_margin") return <LPMarginAnalysis />;
  return (
    <div className="p-8 text-center text-muted-foreground">
      Reporte no implementado: {category} / {report}
    </div>
  );
}
