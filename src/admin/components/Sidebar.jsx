import {useState} from "react";
import {NavLink, useNavigate} from "react-router-dom";
import {Archive, BarChart3, Boxes, ChevronLeft, ChevronRight, CircleHelp, LayoutDashboard, LogOut, Settings, ShoppingBag, Users, X} from "lucide-react";
import {useAdminAuth} from "../auth/AdminAuthContext.jsx";

const links = [
  {label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true},
  {label: "Products", to: "/admin/products", icon: ShoppingBag},
  {label: "Orders", to: "/admin/orders", icon: Archive},
  {label: "Categories", to: "/admin/categories", icon: Boxes},
  {label: "Inventory", to: "/admin/inventory", icon: BarChart3},
  {label: "Customers", to: "/admin/customers", icon: Users},
  {label: "Store Settings", to: "/admin/settings", icon: Settings},
];

export default function Sidebar({collapsed, onToggle, mobileOpen, onClose}) {
  const navigate = useNavigate();
  const {logout} = useAdminAuth();
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
      navigate("/admin/login", {replace: true});
    } catch (error) {
      setLogoutError(error.message);
    }
  }

  return <>
    {mobileOpen && <button aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-40 bg-[#21141a]/50 lg:hidden"/>}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col bg-[#641c32] text-white transition-all duration-300 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[88px]" : "lg:w-[268px]"}`}>
      <div className={`flex h-[84px] items-center border-b border-white/10 ${collapsed ? "justify-center px-3" : "justify-between px-6"}`}>
        <button onClick={() => navigate("/admin")} aria-label="MITHAS admin dashboard" className="flex items-center gap-3 text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#c69b52] font-display text-2xl font-bold text-[#641c32]">M</span>
          {!collapsed && <span className="hidden lg:block"><b className="block font-display text-xl tracking-wide">MITHAS</b><small className="text-[9px] uppercase tracking-[.24em] text-white/55">The Mithai House</small></span>}
          {mobileOpen && <span className="lg:hidden"><b className="block font-display text-xl tracking-wide">MITHAS</b><small className="text-[9px] uppercase tracking-[.24em] text-white/55">The Mithai House</small></span>}
        </button>
        <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-2 text-white/70 hover:bg-white/10 lg:hidden"><X size={19}/></button>
      </div>
      <p className={`px-6 pb-3 pt-7 text-[10px] font-semibold uppercase tracking-[.2em] text-white/40 ${collapsed ? "lg:hidden" : ""}`}>Shop management</p>
      <nav className="flex-1 space-y-1 px-3">
        {links.map(({label, to, icon: Icon, end}) => <NavLink key={to} to={to} end={end} onClick={onClose} title={collapsed ? label : undefined} className={({isActive}) => `group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition ${isActive ? "bg-white text-[#641c32] shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"} ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <Icon size={18} strokeWidth={1.8} className="shrink-0"/>
          <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
        </NavLink>)}
      </nav>
      <div className={`mx-3 mb-3 rounded-2xl border border-white/10 bg-white/[.06] p-3 ${collapsed ? "lg:hidden" : ""}`}>
        <div className="flex items-center gap-2 text-[#e2c47f]"><CircleHelp size={16}/><span className="text-xs font-semibold">Need a hand?</span></div>
        <p className="mt-1.5 text-[11px] leading-5 text-white/55">Store tools will be connected in a future step.</p>
      </div>
      <div className="border-t border-white/10 p-3">
        {logoutError && <p role="alert" className="mb-2 rounded-lg bg-white/10 p-2 text-[11px] leading-4 text-white">{logoutError}</p>}
        <button type="button" onClick={() => void handleLogout()} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] text-white/75 hover:bg-white/10 hover:text-white ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <LogOut size={18} className="shrink-0"/><span className={collapsed ? "lg:hidden" : ""}>Logout</span>
        </button>
      </div>
      <button onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="absolute -right-3 top-[94px] hidden h-7 w-7 items-center justify-center rounded-full border border-[#eee5d9] bg-white text-[#641c32] shadow-sm lg:flex">
        {collapsed ? <ChevronRight size={15}/> : <ChevronLeft size={15}/>}
      </button>
    </aside>
  </>;
}
