import { SnapZoHubAdminView } from "@/components/admin/snapzo-hub-admin-view";
import { SnapZoAdminGate } from "@/components/admin/snapzo-admin-gate";

export default function SnapZoAdminPage() {
  return (
    <SnapZoAdminGate>
      <SnapZoHubAdminView />
    </SnapZoAdminGate>
  );
}
