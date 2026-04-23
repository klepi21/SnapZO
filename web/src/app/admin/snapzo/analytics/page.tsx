import { SnapZoAnalyticsAdminView } from "@/components/admin/snapzo-analytics-admin-view";
import { SnapZoAdminGate } from "@/components/admin/snapzo-admin-gate";

export default function SnapZoAdminAnalyticsPage() {
  return (
    <SnapZoAdminGate>
      <SnapZoAnalyticsAdminView />
    </SnapZoAdminGate>
  );
}
