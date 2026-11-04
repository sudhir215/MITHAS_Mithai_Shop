export const inputClass = "w-full rounded-xl border border-[#e8dfd2] bg-white px-3 py-2.5 text-sm text-[#30252a] outline-none transition focus:border-[#a17d42] focus:ring-2 focus:ring-[#eadfc7]";
export const buttonClass = "inline-flex min-h-10 items-center justify-center rounded-xl bg-[#641c32] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a2a42] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass = "inline-flex min-h-10 items-center justify-center rounded-xl border border-[#e8dfd2] bg-white px-4 py-2 text-sm font-medium text-[#51434a] transition hover:bg-[#fdfbf7] disabled:opacity-50";

export function PageHeading({title, description, action}) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h2 className="font-display text-2xl font-semibold text-[#30252a] sm:text-[28px]">{title}</h2><p className="mt-1 text-sm text-stone-500">{description}</p></div>
    {action}
  </div>;
}

export function AdminMessage({loading, error, success, empty, children}) {
  if (loading) return <p role="status" className="rounded-xl border border-[#eee7dc] bg-white p-5 text-sm text-stone-500">Loading…</p>;
  if (error) return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>;
  if (success) return <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>;
  if (empty) return <p className="rounded-xl border border-dashed border-[#e8dfd2] bg-white p-8 text-center text-sm text-stone-500">{empty}</p>;
  return children ?? null;
}

export function Card({children, className = ""}) {
  return <section className={`rounded-2xl border border-[#eee7dc] bg-white p-5 shadow-[0_5px_20px_rgba(70,50,33,.035)] sm:p-6 ${className}`}>{children}</section>;
}
