import {useCallback, useEffect, useState} from "react";
import {ArrowRight, Boxes, IndianRupee, PackageCheck, ShoppingBag, TriangleAlert} from "lucide-react";
import {Link} from "react-router-dom";
import {getAdminInventory, getDashboardAnalytics} from "../api/adminApi.js";
import {AdminMessage} from "../components/AdminUi.jsx";
import StatCard from "../components/StatCard.jsx";

const money = value => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(Number(value || 0));

function SummaryTable({title, description, rows, periodLabel}) {
  return <section className="overflow-hidden rounded-2xl border border-[#eee7dc] bg-white shadow-[0_5px_20px_rgba(70,50,33,.035)]">
    <div className="px-5 py-5 sm:px-6"><h3 className="font-display text-lg font-semibold">{title}</h3><p className="mt-1 text-xs text-stone-400">{description}</p></div>
    {!rows.length ? <p className="px-6 pb-6 text-sm text-stone-500">No eligible sales in this period.</p> : <div className="max-h-[390px] overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-[#fdfbf7]"><tr className="border-y border-[#f0ebe3] text-[10px] uppercase tracking-wide text-stone-400"><th className="px-5 py-3">{periodLabel}</th><th className="px-4 py-3">Orders</th><th className="px-5 py-3 text-right">Revenue</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.period} className="border-b border-[#f3efe8] last:border-0"><td className="px-5 py-3">{row.period}</td><td className="px-4 py-3">{row.orders}</td><td className="px-5 py-3 text-right font-medium">{money(row.revenue)}</td></tr>)}</tbody>
      </table>
    </div>}
  </section>;
}

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [result, inventory] = await Promise.all([
        getDashboardAnalytics(),
        getAdminInventory({page: 1, pageSize: 5, stock: "low", lowStockThreshold: 5}),
      ]);
      setAnalytics(result);
      setLowStock(inventory.items);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  if (loading) return <AdminMessage loading/>;
  if (error) return <section><AdminMessage error={error}/><button type="button" onClick={() => void reload()} className="mt-3 rounded-xl bg-[#641c32] px-4 py-2 text-sm font-semibold text-white">Try again</button></section>;
  if (!analytics) return <AdminMessage empty="Dashboard analytics are unavailable." />;

  const dailyRows = analytics.dailySales.slice(-7).reverse();
  const monthlyRows = analytics.monthlySales.slice().reverse();

  return <div>
    <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-xs font-medium text-stone-400">Live totals from saved shop records</p><h2 className="mt-1 font-display text-2xl font-semibold text-[#30252a] sm:text-[28px]">Dashboard overview</h2></div>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#eadfc7] bg-[#fffdf8] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#8b6a36]">Connected analytics</span>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <StatCard label="Total orders" value={analytics.totalOrders.toLocaleString("en-IN")} note="All order records" icon={ShoppingBag} tone="burgundy" index={0}/>
      <StatCard label="Pending orders" value={analytics.pendingOrders.toLocaleString("en-IN")} note="Awaiting confirmation" icon={Boxes} tone="blue" index={1}/>
      <StatCard label="Eligible revenue" value={money(analytics.revenue)} note="Paid and completed orders" icon={IndianRupee} tone="green" index={2}/>
      <StatCard label="Revenue this month" value={money(analytics.monthRevenue)} note={`${analytics.monthOrders} paid, completed orders`} icon={PackageCheck} tone="gold" index={3}/>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <SummaryTable title="Daily sales" description="Last 7 days, UTC · paid and completed orders only" rows={dailyRows} periodLabel="Day"/>
      <SummaryTable title="Monthly sales" description="Last 12 months · paid and completed orders only" rows={monthlyRows} periodLabel="Month"/>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
      <section className="overflow-hidden rounded-2xl border border-[#eee7dc] bg-white shadow-[0_5px_20px_rgba(70,50,33,.035)]">
        <div className="px-5 py-5 sm:px-6"><h3 className="font-display text-lg font-semibold">Best-selling products</h3><p className="mt-1 text-xs text-stone-400">By units in paid and completed orders</p></div>
        {!analytics.bestSellingProducts.length ? <p className="px-6 pb-6 text-sm text-stone-500">No completed sales yet.</p> : <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm"><thead><tr className="border-y border-[#f0ebe3] bg-[#fdfbf7] text-[10px] uppercase tracking-wide text-stone-400"><th className="px-6 py-3">Product</th><th className="px-4 py-3">Units</th><th className="px-6 py-3 text-right">Sales</th></tr></thead>
            <tbody>{analytics.bestSellingProducts.map(product => <tr key={product.id} className="border-b border-[#f3efe8] last:border-0"><td className="px-6 py-3 font-medium">{product.name}</td><td className="px-4 py-3">{product.quantitySold}</td><td className="px-6 py-3 text-right">{money(product.revenue)}</td></tr>)}</tbody>
          </table>
        </div>}
      </section>

      <section className="rounded-2xl border border-[#eee7dc] bg-white p-5 shadow-[0_5px_20px_rgba(70,50,33,.035)] sm:p-6">
        <div className="flex items-start justify-between"><div><h3 className="font-display text-lg font-semibold">Low-stock alerts</h3><p className="mt-1 text-xs text-stone-400">Five or fewer units</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f7ebe5] text-[#9b6549]"><TriangleAlert size={18}/></span></div>
        {!lowStock.length ? <p className="mt-5 text-sm text-stone-500">No products currently below the threshold.</p> : <div className="mt-5 space-y-4">
          {lowStock.map(product => <div key={product.id} className="flex items-center justify-between gap-3 border-b border-[#f1ece4] pb-3 last:border-0 last:pb-0"><div className="min-w-0"><p className="truncate text-xs font-semibold">{product.name}</p><p className="mt-1 text-[10px] text-stone-400">{product.category?.name}</p></div><span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${product.stockQuantity === 0 ? "bg-[#f7ebe5] text-[#9b6549]" : "bg-[#f5efdf] text-[#8a682f]"}`}>{product.stockQuantity === 0 ? "Out of stock" : `${product.stockQuantity} left`}</span></div>)}
        </div>}
        <Link to="/admin/inventory" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#641c32] hover:underline">Manage inventory <ArrowRight size={14}/></Link>
      </section>
    </div>
  </div>;
}
