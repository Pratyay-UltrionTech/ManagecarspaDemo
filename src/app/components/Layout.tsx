import { useEffect } from "react";
import { Outlet } from "react-router";
import { BRAND_NAME, PORTAL_LABELS } from "../lib/branding";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export default function Layout() {
  useEffect(() => {
    document.title = `${PORTAL_LABELS.admin} · ${BRAND_NAME}`;
  }, []);
  return (
    <div className="flex h-screen bg-[#f8fafc]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-6 py-8 md:px-8 md:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
