import {useCallback, useEffect, useState} from "react";
import {useAdminAuth} from "../auth/AdminAuthContext.jsx";
import {getAdminOrder, getAdminOrders, updateAdminOrderStatus, updateAdminPaymentStatus} from "../api/adminApi.js";
import {AdminMessage, Card, inputClass, PageHeading, secondaryButtonClass} from "../components/AdminUi.jsx";

const orderStatuses = ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"];
const paymentStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED"];
const defaultFilters = {search: "", orderStatus: "", paymentStatus: "", from: "", to: ""};

export default function Orders() {
  const {csrfToken} = useAdminAuth();
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyOrder, setBusyOrder] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = Object.fromEntries(Object.entries({...appliedFilters, page, pageSize: 10}).filter(([, value]) => value !== ""));
      setData(await getAdminOrders(query));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => { void reload(); }, [reload]);

  async function viewOrder(id) {
    setDetailLoading(true);
    setError("");
    try {
      setSelectedOrder(await getAdminOrder(id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function changeStatus(order, field, value) {
    setBusyOrder(order.id);
    setError("");
    setSuccess("");
    try {
      if (field === "orderStatus") await updateAdminOrderStatus(order.id, value, csrfToken);
      else await updateAdminPaymentStatus(order.id, value, csrfToken);
      setSuccess(`${field === "orderStatus" ? "Order" : "Payment"} status updated.`);
      await reload();
      if (selectedOrder?.id === order.id) await viewOrder(order.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyOrder("");
    }
  }

  return <div>
    <PageHeading title="Orders" description="Review order details and update fulfillment and payment independently."/>
    {error && data && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    <Card className="mb-5">
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={event => {event.preventDefault(); setPage(1); setAppliedFilters({...filters});}}>
        <label className="text-xs font-medium text-stone-600 lg:col-span-2">Search
          <input className={`${inputClass} mt-1.5`} value={filters.search} onChange={event => setFilters(current => ({...current, search: event.target.value}))} placeholder="Order number or customer"/>
        </label>
        <label className="text-xs font-medium text-stone-600">Order status
          <select className={`${inputClass} mt-1.5`} value={filters.orderStatus} onChange={event => setFilters(current => ({...current, orderStatus: event.target.value}))}><option value="">All</option>{orderStatuses.map(status => <option key={status}>{status}</option>)}</select>
        </label>
        <label className="text-xs font-medium text-stone-600">Payment
          <select className={`${inputClass} mt-1.5`} value={filters.paymentStatus} onChange={event => setFilters(current => ({...current, paymentStatus: event.target.value}))}><option value="">All</option>{paymentStatuses.map(status => <option key={status}>{status}</option>)}</select>
        </label>
        <label className="text-xs font-medium text-stone-600">From
          <input type="date" className={`${inputClass} mt-1.5`} value={filters.from} onChange={event => setFilters(current => ({...current, from: event.target.value}))}/>
        </label>
        <label className="text-xs font-medium text-stone-600">To
          <input type="date" className={`${inputClass} mt-1.5`} value={filters.to} onChange={event => setFilters(current => ({...current, to: event.target.value}))}/>
        </label>
        <button type="submit" className={`${secondaryButtonClass} sm:col-span-2 lg:col-span-6 lg:justify-self-start`}>Apply filters</button>
      </form>
    </Card>

    {selectedOrder && <Card className="mb-5">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-display text-lg font-semibold">Order {selectedOrder.orderNumber}</h3><p className="mt-1 text-sm text-stone-500">{selectedOrder.customer?.name} · {selectedOrder.customer?.phone}</p></div>
        <button type="button" className={secondaryButtonClass} onClick={() => setSelectedOrder(null)}>Close details</button>
      </div>
      {detailLoading ? <p role="status" className="mt-4 text-sm text-stone-500">Loading order details…</p> : <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-stone-400"><th className="py-2">Item</th><th className="py-2">Qty</th><th className="py-2">Unit price</th><th className="py-2">Subtotal</th></tr></thead>
          <tbody>{selectedOrder.items?.map(item => <tr key={item.id} className="border-b last:border-0"><td className="py-2">{item.productName}</td><td className="py-2">{item.quantity}</td><td className="py-2">₹{item.unitPrice}</td><td className="py-2">₹{item.subtotal}</td></tr>)}</tbody>
        </table>
        <div className="mt-3 flex flex-wrap gap-5 text-sm"><span>Subtotal: ₹{selectedOrder.subtotal}</span><span>Delivery: ₹{selectedOrder.deliveryFee}</span><b>Total: ₹{selectedOrder.total}</b><span>Payment: {selectedOrder.paymentStatus}</span></div>
        {selectedOrder.deliveryAddress && <p className="mt-3 text-sm text-stone-600"><b>Delivery address:</b> {selectedOrder.deliveryAddress}</p>}
      </div>}
    </Card>}

    <Card>
      {loading ? <AdminMessage loading/> : error && !data ? <AdminMessage error={error}/> : !data?.items.length
        ? <AdminMessage empty="No orders match the selected filters."/>
        : <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead><tr className="border-b border-[#f0ebe3] text-[10px] uppercase tracking-wide text-stone-400"><th className="py-3 pr-3">Order</th><th className="py-3 pr-3">Customer</th><th className="py-3 pr-3">Total</th><th className="py-3 pr-3">Order status</th><th className="py-3 pr-3">Payment status</th><th className="py-3 pr-3">Date</th><th className="py-3">Details</th></tr></thead>
            <tbody>{data.items.map(order => <tr key={order.id} className="border-b border-[#f3efe8] last:border-0">
              <td className="py-3 pr-3 font-semibold text-[#641c32]">{order.orderNumber}</td><td className="py-3 pr-3">{order.customer?.name ?? "—"}</td><td className="py-3 pr-3">₹{order.total}</td>
              <td className="py-3 pr-3"><select aria-label={`Order status ${order.orderNumber}`} disabled={busyOrder === order.id} className={`${inputClass} min-w-36`} value={order.orderStatus} onChange={event => void changeStatus(order, "orderStatus", event.target.value)}>{orderStatuses.map(status => <option key={status}>{status}</option>)}</select></td>
              <td className="py-3 pr-3"><select aria-label={`Payment status ${order.orderNumber}`} disabled={busyOrder === order.id} className={`${inputClass} min-w-32`} value={order.paymentStatus} onChange={event => void changeStatus(order, "paymentStatus", event.target.value)}>{paymentStatuses.map(status => <option key={status}>{status}</option>)}</select></td>
              <td className="py-3 pr-3 text-xs text-stone-500">{new Date(order.createdAt).toLocaleString()}</td>
              <td className="py-3"><button className={secondaryButtonClass} type="button" onClick={() => void viewOrder(order.id)}>View</button></td>
            </tr>)}</tbody>
          </table>
          <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
            <span>{data.total} order{data.total === 1 ? "" : "s"} · page {data.page} of {Math.max(data.totalPages, 1)}</span>
            <div className="flex gap-2"><button className={secondaryButtonClass} disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</button><button className={secondaryButtonClass} disabled={page >= data.totalPages} onClick={() => setPage(current => current + 1)}>Next</button></div>
          </div>
        </div>}
    </Card>
  </div>;
}
