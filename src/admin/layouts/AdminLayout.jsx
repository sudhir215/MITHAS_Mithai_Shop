import {useState} from "react";
import {Outlet} from "react-router-dom";
import AdminHeader from "../components/AdminHeader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import {useAdminAuth} from "../auth/AdminAuthContext.jsx";

export default function AdminLayout() {
  const {admin} = useAdminAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return <div className="min-h-screen bg-[#faf7f0] text-[#30252a]">
    <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)}/>
    <div className={`min-h-screen transition-[padding] duration-300 ${collapsed ? "lg:pl-[88px]" : "lg:pl-[268px]"}`}>
      <div className="lg:hidden"><AdminHeader onMenu={() => setMobileOpen(true)}/></div>
      <div className="hidden lg:block"><AdminHeader onMenu={() => setMobileOpen(true)}/></div>
      <main className="mx-auto max-w-[1500px] px-4 pb-10 pt-5 sm:px-7 sm:pt-7 lg:px-9">
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#eadfc7] bg-[#fffdf8] px-4 py-3.5 shadow-[0_3px_14px_rgba(70,50,33,.03)]">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f2ead8] text-[#8b6a36]">i</span>
          <p className="text-xs leading-5 text-stone-600"><b className="text-[#641c32]">Connected admin tools.</b> Product, category, order, and store-setting pages use protected server APIs. Dashboard overview and remaining modules may still show preview content.</p>
        </div>
        <div aria-label={`Signed in as ${admin.email}`}><Outlet/></div>
      </main>
    </div>
  </div>;
}
