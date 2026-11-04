import {useCallback, useEffect, useState} from "react";
import {useAdminAuth} from "../auth/AdminAuthContext.jsx";
import {deactivateAdminProduct, getAdminCategories, getAdminProducts, saveAdminProduct} from "../api/adminApi.js";
import {AdminMessage, buttonClass, Card, inputClass, PageHeading, secondaryButtonClass} from "../components/AdminUi.jsx";

const emptyForm = {name: "", description: "", price: "", stockQuantity: "0", categoryId: "", imageUrl: "", isFeatured: false, isAvailable: true};

export default function Products() {
  const {csrfToken} = useAdminAuth();
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [products, categoryList] = await Promise.all([
        getAdminProducts({page, pageSize: 10, search, availability}),
        getAdminCategories(true),
      ]);
      setData(products);
      setCategories(categoryList);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, availability]);

  useEffect(() => { void reload(); }, [reload]);

  function chooseProduct(product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      stockQuantity: String(product.stockQuantity),
      categoryId: product.categoryId,
      imageUrl: product.imageUrl ?? "",
      isFeatured: product.isFeatured,
      isAvailable: product.isAvailable,
    });
    setSuccess("");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveAdminProduct(editingId, {
        ...form,
        price: form.price,
        stockQuantity: Number(form.stockQuantity),
        imageUrl: form.imageUrl || "",
      }, csrfToken);
      setForm(emptyForm);
      setEditingId("");
      setSuccess(editingId ? "Product updated." : "Product created.");
      await reload();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(product) {
    setError("");
    setSuccess("");
    try {
      await deactivateAdminProduct(product.id, csrfToken);
      setSuccess("Product deactivated; existing order history is preserved.");
      await reload();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const field = (label, name, props = {}) => <label className="block text-xs font-medium text-stone-600">{label}
    <input className={`${inputClass} mt-1.5`} value={form[name]} onChange={event => setForm(current => ({...current, [name]: event.target.value}))} {...props}/>
  </label>;

  return <div>
    <PageHeading title="Products" description="Manage product details, pricing, stock, categories, and availability."/>
    {error && data && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    <Card className="mb-5">
      <h3 className="mb-4 font-display text-lg font-semibold">{editingId ? "Edit product" : "Add product"}</h3>
      <form onSubmit={event => void submit(event)} className="grid gap-4 md:grid-cols-2">
        {field("Product name", "name", {required: true, maxLength: 120})}
        <label className="block text-xs font-medium text-stone-600">Category
          <select required className={`${inputClass} mt-1.5`} value={form.categoryId} onChange={event => setForm(current => ({...current, categoryId: event.target.value}))}>
            <option value="">Choose category</option>{categories.filter(category => category.isActive).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        {field("Price (INR)", "price", {type: "number", min: "0.01", step: "0.01", required: true})}
        {field(editingId ? "Stock quantity (adjust in Inventory)" : "Initial stock quantity", "stockQuantity", {type: "number", min: "0", step: "1", required: true, readOnly: Boolean(editingId)})}
        <div className="md:col-span-2">{field("Image URL (optional)", "imageUrl", {type: "url", maxLength: 2048})}</div>
        <label className="block text-xs font-medium text-stone-600 md:col-span-2">Description
          <textarea required maxLength={4000} className={`${inputClass} mt-1.5 min-h-24`} value={form.description} onChange={event => setForm(current => ({...current, description: event.target.value}))}/>
        </label>
        <div className="flex flex-wrap gap-5 text-sm text-stone-600 md:col-span-2">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.isAvailable} onChange={event => setForm(current => ({...current, isAvailable: event.target.checked}))}/> Available</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.isFeatured} onChange={event => setForm(current => ({...current, isFeatured: event.target.checked}))}/> Featured</label>
        </div>
        <div className="flex gap-2 md:col-span-2">
          <button className={buttonClass} type="submit" disabled={saving || categories.length === 0}>{saving ? "Saving…" : editingId ? "Save changes" : "Create product"}</button>
          {editingId && <button className={secondaryButtonClass} type="button" onClick={() => {setEditingId(""); setForm(emptyForm);}}>Cancel edit</button>}
        </div>
      </form>
    </Card>

    <Card>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="min-w-[220px] flex-1 text-xs font-medium text-stone-600">Search products
          <input className={`${inputClass} mt-1.5`} value={search} onChange={event => {setSearch(event.target.value); setPage(1);}} placeholder="Name or slug"/>
        </label>
        <label className="text-xs font-medium text-stone-600">Availability
          <select className={`${inputClass} mt-1.5 min-w-40`} value={availability} onChange={event => {setAvailability(event.target.value); setPage(1);}}>
            <option value="all">All products</option><option value="available">Available</option><option value="unavailable">Unavailable</option>
          </select>
        </label>
      </div>
      {loading ? <AdminMessage loading/> : error && !data ? <AdminMessage error={error}/> : !data?.items.length
        ? <AdminMessage empty="No products found. Add your first product above."/>
        : <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead><tr className="border-b border-[#f0ebe3] text-[10px] uppercase tracking-wide text-stone-400"><th className="py-3 pr-3">Product</th><th className="py-3 pr-3">Category</th><th className="py-3 pr-3">Price</th><th className="py-3 pr-3">Stock</th><th className="py-3 pr-3">Status</th><th className="py-3">Actions</th></tr></thead>
            <tbody>{data.items.map(product => <tr key={product.id} className="border-b border-[#f3efe8] last:border-0">
              <td className="py-3 pr-3"><p className="font-medium">{product.name}</p><p className="text-xs text-stone-400">{product.isFeatured ? "Featured" : "—"}</p></td>
              <td className="py-3 pr-3">{product.category?.name ?? "—"}</td><td className="py-3 pr-3">₹{product.price}</td><td className="py-3 pr-3">{product.stockQuantity}</td>
              <td className="py-3 pr-3">{product.isAvailable ? "Available" : "Inactive"}</td>
              <td className="py-3"><div className="flex gap-2"><button type="button" className={secondaryButtonClass} onClick={() => chooseProduct(product)}>Edit</button>{product.isAvailable && <button type="button" className={secondaryButtonClass} onClick={() => void deactivate(product)}>Deactivate</button>}</div></td>
            </tr>)}</tbody>
          </table>
          <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
            <span>{data.total} product{data.total === 1 ? "" : "s"} · page {data.page} of {Math.max(data.totalPages, 1)}</span>
            <div className="flex gap-2"><button className={secondaryButtonClass} disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</button><button className={secondaryButtonClass} disabled={page >= data.totalPages} onClick={() => setPage(current => current + 1)}>Next</button></div>
          </div>
        </div>}
    </Card>
  </div>;
}
