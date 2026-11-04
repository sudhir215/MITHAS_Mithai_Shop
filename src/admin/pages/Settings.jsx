import {useCallback, useEffect, useState} from "react";
import {useAdminAuth} from "../auth/AdminAuthContext.jsx";
import {getAdminSettings, saveAdminSettings} from "../api/adminApi.js";
import {buttonClass, Card, inputClass, PageHeading} from "../components/AdminUi.jsx";

const emptySettings = {
  shopName: "",
  phone: "",
  address: "",
  deliveryFee: "0.00",
  minimumOrderAmount: "0.00",
  isOperating: true,
};

function toForm(settings) {
  if (!settings) return emptySettings;
  return {
    shopName: settings.shopName ?? "",
    phone: settings.contactNumber ?? "",
    address: settings.address ?? "",
    deliveryFee: String(settings.deliveryFee ?? "0.00"),
    minimumOrderAmount: String(settings.minimumOrderAmount ?? "0.00"),
    isOperating: settings.isOperating ?? true,
  };
}

export default function Settings() {
  const {csrfToken, admin} = useAdminAuth();
  const [form, setForm] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setForm(toForm(await getAdminSettings()));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await saveAdminSettings({
        ...form,
        phone: form.phone || null,
        address: form.address || null,
      }, csrfToken);
      setForm(toForm(saved));
      setSuccess("Store settings saved.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return <div>
    <PageHeading title="Store settings" description="Keep shop contact, delivery pricing, minimum order, and operating status current."/>
    {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {success && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    {loading ? <p role="status" className="rounded-xl border border-[#eee7dc] bg-white p-5 text-sm text-stone-500">Loading store settings…</p>
      : <Card>
        <form onSubmit={event => void submit(event)} className="grid gap-5 md:grid-cols-2">
          <label className="block text-xs font-medium text-stone-600">Store name
            <input required maxLength={120} className={`${inputClass} mt-1.5`} value={form.shopName} onChange={event => setForm(current => ({...current, shopName: event.target.value}))}/>
          </label>
          <label className="block text-xs font-medium text-stone-600">Phone
            <input type="tel" maxLength={40} className={`${inputClass} mt-1.5`} value={form.phone} onChange={event => setForm(current => ({...current, phone: event.target.value}))}/>
          </label>
          <label className="block text-xs font-medium text-stone-600 md:col-span-2">Address
            <textarea maxLength={2000} className={`${inputClass} mt-1.5 min-h-24`} value={form.address} onChange={event => setForm(current => ({...current, address: event.target.value}))}/>
          </label>
          <label className="block text-xs font-medium text-stone-600">Delivery fee (INR)
            <input required type="number" min="0" step="0.01" className={`${inputClass} mt-1.5`} value={form.deliveryFee} onChange={event => setForm(current => ({...current, deliveryFee: event.target.value}))}/>
          </label>
          <label className="block text-xs font-medium text-stone-600">Minimum order amount (INR)
            <input required type="number" min="0" step="0.01" className={`${inputClass} mt-1.5`} value={form.minimumOrderAmount} onChange={event => setForm(current => ({...current, minimumOrderAmount: event.target.value}))}/>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-stone-700 md:col-span-2">
            <input type="checkbox" checked={form.isOperating} onChange={event => setForm(current => ({...current, isOperating: event.target.checked}))}/>
            Store is currently accepting orders
          </label>
          <div className="md:col-span-2">
            {admin?.role !== "OWNER" && <p className="mb-3 text-xs text-stone-500">Only an OWNER can save store settings.</p>}
            <button type="submit" className={buttonClass} disabled={saving || admin?.role !== "OWNER"}>{saving ? "Saving…" : "Save settings"}</button>
          </div>
        </form>
      </Card>}
  </div>;
}
