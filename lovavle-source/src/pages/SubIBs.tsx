import DashboardLayout from "@/components/DashboardLayout";
import SubIBWizard from "@/components/sub-ibs/SubIBWizard";
import { UserPlus } from "lucide-react";

const SubIBs = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-primary" />
            Nuevo Sub IB
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Crea un Sub IB vinculado a un Master IB existente
          </p>
        </div>
        <SubIBWizard />
      </div>
    </DashboardLayout>
  );
};

export default SubIBs;
