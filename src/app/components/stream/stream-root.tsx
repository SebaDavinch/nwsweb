import { Outlet } from "react-router";

export function StreamRoot() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-transparent">
      <Outlet />
    </div>
  );
}
