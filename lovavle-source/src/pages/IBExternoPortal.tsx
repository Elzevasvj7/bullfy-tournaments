import { Routes, Route } from "react-router-dom";
import IBExternoLayout from "@/components/ib-externo/IBExternoLayout";
import IBExternoLanding from "@/components/ib-externo/IBExternoLanding";
import IBExternoDashboard from "@/components/ib-externo/IBExternoDashboard";
import IBExternoNewRequest from "@/components/ib-externo/IBExternoNewRequest";
import IBExternoSubIBs from "@/components/ib-externo/IBExternoSubIBs";
import IBExternoCampaigns from "@/components/ib-externo/IBExternoCampaigns";

const IBExternoPortal = () => {
  return (
    <IBExternoLayout>
      <Routes>
        <Route index element={<IBExternoLanding />} />
        <Route path="mis-sub-ibs" element={<IBExternoSubIBs />} />
        <Route path="solicitudes" element={<IBExternoDashboard />} />
        <Route path="nueva" element={<IBExternoNewRequest />} />
        <Route path="campanas" element={<IBExternoCampaigns />} />
      </Routes>
    </IBExternoLayout>
  );
};

export default IBExternoPortal;
