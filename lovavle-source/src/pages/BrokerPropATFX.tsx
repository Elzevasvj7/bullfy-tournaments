import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import DateRangePicker, { type DateRangeValue } from "@/components/atfx/DateRangePicker";
import { subDays } from "date-fns";
import ATFXReportSidebar from "@/components/atfx/ATFXReportSidebar";
import { ATFX_SECTIONS, findReport } from "@/components/atfx/reportRegistry";
import { ChevronRight } from "lucide-react";

import BrokerOverview from "@/components/atfx/broker/BrokerOverview";
import PropOverview from "@/components/atfx/prop/PropOverview";
import BrokerReportRouter from "@/components/atfx/broker/BrokerReportRouter";
import PropReportRouter from "@/components/atfx/prop/PropReportRouter";
import SystemReportRouter from "@/components/atfx/system/SystemReportRouter";
import DealingReportRouter from "@/components/atfx/dealing/DealingReportRouter";

export default function BrokerPropATFX() {
  const [range, setRange] = useState<DateRangeValue>({ from: subDays(new Date(), 29), to: new Date() });
  const [section, setSection] = useState<"broker" | "prop" | "system" | "dealing">("broker");
  const [category, setCategory] = useState("overview");
  const [report, setReport] = useState("dashboard");

  const handleSelect = (s: string, c: string, r: string) => {
    setSection(s as any); setCategory(c); setReport(r);
  };

  const meta = findReport(section, category, report);

  const renderContent = () => {
    if (section === "broker") {
      if (category === "overview" && report === "dashboard") return <BrokerOverview range={range} />;
      return <BrokerReportRouter range={range} category={category} report={report} />;
    }
    if (section === "prop") {
      if (category === "overview" && report === "dashboard") return <PropOverview range={range} />;
      return <PropReportRouter range={range} category={category} report={report} />;
    }
    if (section === "system") return <SystemReportRouter report={report} />;
    if (section === "dealing") return <DealingReportRouter category={category} report={report} />;
    return null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Broker_Prop ATFX</h1>
          <p className="text-sm text-muted-foreground">Sistema de reportes en tiempo real conectado a la API de ATFX.</p>
        </div>

        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Rango:</span>
            <DateRangePicker value={range} onChange={setRange} />
          </CardContent>
        </Card>

        <div className="flex gap-4 items-start">
          <ATFXReportSidebar section={section} category={category} report={report} onSelect={handleSelect} />

          <div className="flex-1 min-w-0 space-y-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>{meta.section?.icon} {meta.section?.label}</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span>{meta.category?.icon} {meta.category?.label}</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium">{meta.report?.label}</span>
            </div>

            {renderContent()}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
