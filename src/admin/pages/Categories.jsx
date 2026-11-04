import {useCallback, useEffect, useState} from "react";
import {useAdminAuth} from "../auth/AdminAuthContext.jsx";
import {activateAdminCategory, deactivateAdminCategory, deleteAdminCategory, getAdminCategories, saveAdminCategory} from "../api/adminApi.js";
import {AdminMessage, buttonClass, Card, inputClass, PageHeading, secondaryButtonClass} from "../components/AdminUi.jsx";

const emptyForm = {name: "", description: ""};

export default function Categories() {
  const {csrfToken} = useAdminAuth();
  const [categories, setCategories] = useState([]);
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
      setCategories(await getAdminCategories(true));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveAdminCategory(editingId, form, csrfToken);
      setEditingId("");
      setForm(emptyForm);
      setSuccess(editingId ? "Category updated." : "Category created.");
      await reload();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(category) {
    setError("");
    setSuccess("");
    try {
      await deactivateAdminCategory(category.id, csrfToken);
      setSuccess("Category deactivated. Its products remain intact and are hidden from the storefront.");
      await reload();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function remove(category) {
    setError("");
    setSuccess("");
    try {
      await deleteAdminCategory(category.id, csrfToken);
      setSuccess("Unused category deleted.");
      await reload();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function activate(category) {
    setError("");
    setSuccess("");
    try {
      await activateAdminCategory(category.id, csrfToken);
      setSuccess("Category activated and available for product assignments.");
      await reload();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return <div>
    <PageHeading title="Categories" description="Organize products and safely deactivate categories without losing history."/>
    {error && categories.length > 0 && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    <Card className="mb-5">
      <h3 className="mb-4 font-display text-lg font-semibold">{editingId ? "Edit category" : "Add category"}</h3>
      <form onSubmit={event => void submit(event)} className="grid gap-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <label className="block text-xs font-medium text-stone-600">Category name
          <input required maxLength={120} className={`${inputClass} mt-1.5`} value={form.name} onChange={event => setForm(current => ({...current, name: event.target.value}))}/>
        </label>
        <label className="block text-xs font-medium text-stone-600">Description
          <input maxLength={4000} className={`${inputClass} mt-1.5`} value={form.description} onChange={event => setForm(current => ({...current, description: event.target.value}))}/>
        </label>
        <div className="flex gap-2"><button className={buttonClass} type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create"}</button>
          {editingId && <button className={secondaryButtonClass} type="button" onClick={() => {setEditingId(""); setForm(emptyForm);}}>Cancel</button>}</div>
      </form>
    </Card>
    <Card>
      {loading ? <AdminMessage loading/> : error && categories.length === 0 ? <AdminMessage error={error}/> : categories.length === 0
        ? <AdminMessage empty="No categories yet. Add one above to start organizing products."/>
        : <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-[#f0ebe3] text-[10px] uppercase tracking-wide text-stone-400"><th className="py-3 pr-3">Category</th><th className="py-3 pr-3">Products</th><th className="py-3 pr-3">Status</th><th className="py-3">Actions</th></tr></thead>
            <tbody>{categories.map(category => <tr key={category.id} className="border-b border-[#f3efe8] last:border-0">
              <td className="py-3 pr-3"><p className="font-medium">{category.name}</p><p className="text-xs text-stone-400">{category.description || category.slug}</p></td>
              <td className="py-3 pr-3">{category._count?.products ?? 0}</td><td className="py-3 pr-3">{category.isActive ? "Active" : "Inactive"}</td>
              <td className="py-3"><div className="flex flex-wrap gap-2">
                <button className={secondaryButtonClass} type="button" onClick={() => {setEditingId(category.id); setForm({name: category.name, description: category.description ?? ""});}}>Edit</button>
                {category.isActive && <button className={secondaryButtonClass} type="button" onClick={() => void deactivate(category)}>Deactivate</button>}
                {!category.isActive && <button className={secondaryButtonClass} type="button" onClick={() => void activate(category)}>Activate</button>}
                <button className={secondaryButtonClass} type="button" onClick={() => void remove(category)}>Delete if unused</button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>}
    </Card>
  </div>;
}
