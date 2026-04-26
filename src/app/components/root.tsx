import { Outlet } from "react-router";
import { Header } from "./header";
import { Footer } from "./footer";

export function Root() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}