import { AdminGuard } from "./admin-guard";
import { AdminLayout } from "./admin-layout";

export function AdminRoot() {
  return (
    <AdminGuard>
      <AdminLayout />
    </AdminGuard>
  );
}
