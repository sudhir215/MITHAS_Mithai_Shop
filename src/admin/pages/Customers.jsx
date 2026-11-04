import {useCallback, useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {getAdminCustomers} from "../api/adminApi.js";
import {AdminMessage, Card, inputClass, PageHeading, secondaryButtonClass} from "../components/AdminUi.jsx";

export default function Customers() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getAdminCustomers({page, pageSize: 10, search}));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void reload(); }, [reload]);

  return <div>
    <PageHeading title="Customers" description="Customer contact details and order spending are visible only to signed-in administrators."/>
    {error && data && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    <Card>
      <label className="mb-4 block max-w-lg text-xs font-medium text-stone-600">Search customers
        <input className={`${inputClass} mt-1.5`} value={search} onChange={event => {setSearch(event.target.value); setPage(1);}} placeholder="Name, phone, or email"/>
      </label>
      {loading ? <AdminMessage loading/> : error && !data ? <AdminMessage error={error}/> : !data?.items.length
        ? <AdminMessage empty="No customers match your search."/>
        : <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead><tr className="border-b border-[#f0ebe3] text-[10px] uppercase tracking-wide text-stone-400"><th className="py-3 pr-3">Customer</th><th className="py-3 pr-3">Phone</th><th className="py-3 pr-3">Email</th><th className="py-3 pr-3">Orders</th><th className="py-3 pr-3">Paid spending</th><th className="py-3">Details</th></tr></thead>
            <tbody>{data.items.map(customer => <tr key={customer.id} className="border-b border-[#f3efe8] last:border-0">
              <td className="py-3 pr-3 font-medium">{customer.name}</td><td className="py-3 pr-3">{customer.phone}</td><td className="py-3 pr-3">{customer.email || "—"}</td>
              <td className="py-3 pr-3">{customer.totalOrders}</td><td className="py-3 pr-3">₹{customer.totalSpending}</td>
              <td className="py-3"><Link className={secondaryButtonClass} to={`/admin/customers/${encodeURIComponent(customer.id)}`}>View details</Link></td>
            </tr>)}</tbody>
          </table>
          <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
            <span>{data.total} customer{data.total === 1 ? "" : "s"} · page {data.page} of {Math.max(data.totalPages, 1)}</span>
            <div className="flex gap-2"><button className={secondaryButtonClass} disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</button><button className={secondaryButtonClass} disabled={page >= data.totalPages} onClick={() => setPage(current => current + 1)}>Next</button></div>
          </div>
        </div>}
    </Card>
  </div>;
}
