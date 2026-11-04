import {useCallback, useEffect, useState} from "react";
import {useAdminAuth} from "../auth/AdminAuthContext.jsx";
import {adjustAdminInventory, getAdminInventory, getStockMovements} from "../api/adminApi.js";
import {AdminMessage, buttonClass, Card, inputClass, PageHeading, secondaryButtonClass} from "../components/AdminUi.jsx";

export default function Inventory() {
  const {csrfToken} = useAdminAuth();
  const [inventory, setInventory] = useState(null);
  const [movements, setMovements] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantityChange, setQuantityChange] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [currentInventory, history] = await Promise.all([
        getAdminInventory({page, pageSize: 10, search, stock, lowStockThreshold: 5}),
        getStockMovements({page: 1, pageSize: 20}),
      ]);
      setInventory(currentInventory);
      setMovements(history);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, stock]);

  useEffect(() => { void reload(); }, [reload]);

  async function submitAdjustment(event) {
    event.preventDefault();
    if (!selectedProduct) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await adjustAdminInventory(selectedProduct.id, {
        quantityChange: Number(quantityChange),
        reason,
      }, csrfToken);
      setSuccess(`${result.product.name} stock changed from ${result.previousQuantity} to ${result.newQuantity}.`);
      setSelectedProduct(null);
      setQuantityChange("");
      setReason("");
      await reload();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function stockLabel(quantity) {
    if (quantity === 0) return {text: "Out of stock", className: "bg-rose-50 text-rose-700"};
    if (quantity <= 5) return {text: "Low stock", className: "bg-amber-50 text-amber-800"};
    return {text: "In stock", className: "bg-emerald-50 text-emerald-800"};
  }

  return <div>
    <PageHeading title="Inventory" description="Monitor stock, flag low inventory, and record every adjustment with a reason."/>
    {error && inventory && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

    {selectedProduct && <Card className="mb-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-display text-lg font-semibold">Adjust {selectedProduct.name}</h3><p className="mt-1 text-sm text-stone-500">Current stock: {selectedProduct.stockQuantity}. Positive values add stock; negative values remove it.</p></div>
        <button type="button" className={secondaryButtonClass} onClick={() => setSelectedProduct(null)}>Cancel</button>
      </div>
      <form onSubmit={event => void submitAdjustment(event)} className="grid gap-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <label className="block text-xs font-medium text-stone-600">Quantity change
          <input required type="number" step="1" min={-selectedProduct.stockQuantity} className={`${inputClass} mt-1.5`} value={quantityChange} onChange={event => setQuantityChange(event.target.value)} placeholder="e.g. 10 or -2"/>
        </label>
        <label className="block text-xs font-medium text-stone-600">Reason
          <input required minLength={3} maxLength={500} className={`${inputClass} mt-1.5`} value={reason} onChange={event => setReason(event.target.value)} placeholder="Restock, damage, stock count correction…"/>
        </label>
        <button className={buttonClass} type="submit" disabled={saving}>{saving ? "Saving…" : "Record adjustment"}</button>
      </form>
    </Card>}

    <Card className="mb-5">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-xs font-medium text-stone-600">Search products
          <input className={`${inputClass} mt-1.5`} value={search} onChange={event => {setSearch(event.target.value); setPage(1);}} placeholder="Product name or slug"/>
        </label>
        <label className="text-xs font-medium text-stone-600">Stock level
          <select className={`${inputClass} mt-1.5 min-w-40`} value={stock} onChange={event => {setStock(event.target.value); setPage(1);}}>
            <option value="all">All stock</option><option value="low">Low (1–5)</option><option value="out">Out of stock</option>
          </select>
        </label>
      </div>
      {loading ? <AdminMessage loading/> : error && !inventory ? <AdminMessage error={error}/> : !inventory?.items.length
        ? <AdminMessage empty="No products match this inventory filter."/>
        : <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead><tr className="border-b border-[#f0ebe3] text-[10px] uppercase tracking-wide text-stone-400"><th className="py-3 pr-3">Product</th><th className="py-3 pr-3">Category</th><th className="py-3 pr-3">Current stock</th><th className="py-3 pr-3">Indicator</th><th className="py-3">Action</th></tr></thead>
            <tbody>{inventory.items.map(product => {
              const status = stockLabel(product.stockQuantity);
              return <tr key={product.id} className="border-b border-[#f3efe8] last:border-0">
                <td className="py-3 pr-3 font-medium">{product.name}</td><td className="py-3 pr-3">{product.category?.name ?? "—"}</td><td className="py-3 pr-3 font-semibold">{product.stockQuantity}</td>
                <td className="py-3 pr-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.text}</span></td>
                <td className="py-3"><button type="button" className={secondaryButtonClass} onClick={() => setSelectedProduct(product)}>Adjust stock</button></td>
              </tr>;
            })}</tbody>
          </table>
          <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
            <span>{inventory.total} product{inventory.total === 1 ? "" : "s"} · page {inventory.page} of {Math.max(inventory.totalPages, 1)}</span>
            <div className="flex gap-2"><button className={secondaryButtonClass} disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</button><button className={secondaryButtonClass} disabled={page >= inventory.totalPages} onClick={() => setPage(current => current + 1)}>Next</button></div>
          </div>
        </div>}
    </Card>

    <Card>
      <h3 className="mb-4 font-display text-lg font-semibold">Stock movement history</h3>
      {loading && !movements ? <AdminMessage loading/> : !movements?.items.length
        ? <AdminMessage empty="No stock adjustments have been recorded."/>
        : <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead><tr className="border-b border-[#f0ebe3] text-[10px] uppercase tracking-wide text-stone-400"><th className="py-3 pr-3">Date</th><th className="py-3 pr-3">Product</th><th className="py-3 pr-3">Change</th><th className="py-3 pr-3">Before → after</th><th className="py-3 pr-3">Reason</th><th className="py-3">Admin</th></tr></thead>
            <tbody>{movements.items.map(movement => <tr key={movement.id} className="border-b border-[#f3efe8] last:border-0">
              <td className="py-3 pr-3 text-xs text-stone-500">{new Date(movement.createdAt).toLocaleString()}</td><td className="py-3 pr-3">{movement.product.name}</td>
              <td className={`py-3 pr-3 font-semibold ${movement.quantityChange > 0 ? "text-emerald-700" : "text-rose-700"}`}>{movement.quantityChange > 0 ? "+" : ""}{movement.quantityChange}</td>
              <td className="py-3 pr-3">{movement.previousQuantity} → {movement.newQuantity}</td><td className="max-w-56 truncate py-3 pr-3" title={movement.reason}>{movement.reason}</td>              <td className="py-3 text-xs">{movement.admin?.email ?? (movement.order ? `Order ${movement.order.orderNumber}` : "System")}</td>
            </tr>)}</tbody>
          </table>
        </div>}
    </Card>
  </div>;
}
