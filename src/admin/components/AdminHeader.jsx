import {Bell, Menu, Search, Sparkles} from "lucide-react";
import {useLocation} from "react-router-dom";
import {useAdminAuth} from "../auth/AdminAuthContext.jsx";

const pageNames = {
  "/admin": "Dashboard",
  "/admin/products": "Products",
  "/admin/orders": "Orders",
  "/admin/categories": "Categories",
  "/admin/inventory": "Inventory",
  "/admin/customers": "Customers",
  "/admin/settings": "Store Settings",
};

export default function AdminHeader({onMenu}) {
  const {pathname} = useLocation();
  const {admin} = useAdminAuth();
  const page = pageNames[pathname] || "Dashboard";

  return <header className="sticky top-0 z-30 border-b border-[#e9e1d5] bg-[#faf7f0]/95 backdrop-blur">
    <div className="flex h-[76px] items-center justify-between gap-4 px-4 sm:px-7 lg:px-9">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onMenu} aria-label="Open navigation" className="rounded-xl border border-[#e9e1d5] bg-white p-2.5 text-[#641c32] lg:hidden"><Menu size={19}/></button>
        <div className="min-w-0">
          <p className="hidden text-[10px] font-medium uppercase tracking-[.18em] text-stone-400 sm:block">MITHAS <span className="mx-1.5 text-[#c69b52]">/</span> Admin</p>
          <h1 className="truncate font-display text-xl font-semibold text-[#30252a] sm:mt-0.5 sm:text-2xl">{page}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <span className="hidden items-center gap-1.5 rounded-full border border-[#e9dfcb] bg-[#fffdf8] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#8b6a36] md:flex"><Sparkles size={13}/> Admin</span>
        <button aria-label="Search (not connected)" title="Search will be available when shop data is connected" className="rounded-xl p-2.5 text-stone-500 transition hover:bg-white hover:text-[#641c32]"><Search size={19}/></button>
        <button aria-label="Notifications (not connected)" title="Notifications are not connected" className="relative rounded-xl p-2.5 text-stone-500 transition hover:bg-white hover:text-[#641c32]"><Bell size={19}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#c69b52]"/></button>
        <div className="flex items-center gap-2 border-l border-[#e9e1d5] pl-3 sm:gap-3 sm:pl-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eadfc7] text-xs font-bold text-[#641c32]">{admin.email.slice(0, 2).toUpperCase()}</span>
          <div className="hidden sm:block"><p className="text-xs font-semibold text-[#30252a]">{admin.email}</p><p className="mt-0.5 text-[10px] text-stone-400">{admin.role}</p></div>
        </div>
      </div>
    </div>
  </header>;
}
