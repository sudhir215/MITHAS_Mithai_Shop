import {useEffect, useRef, useState} from "react";
import {Link, useNavigate, useParams} from "react-router-dom";
import {ArrowLeft, ArrowRight, CheckCircle2, Plus, Search, ShoppingBag, Sparkles} from "lucide-react";
import {createStorefrontOrder, getOrderConfirmation, getStorefrontProduct} from "./storefrontApi.js";

const money = value => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(Number(value || 0));
const fallbackImage = "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=1200&q=85";

export function CatalogSection({products, categories, loading, error, search, setSearch, category, setCategory, reload, add}) {
  return <section id="mithai" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24 md:px-8">
    <div className="mb-10 text-center">
      <span className="text-xs font-bold uppercase tracking-[.3em] text-gold">Handpicked favourites</span>
      <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">A box full of <em className="text-maroon">happiness</em></h2>
      <p className="mx-auto mt-4 max-w-xl text-stone-500">Explore fresh favourites, search the shop, and build your sweet box.</p>
    </div>
    <form className="mx-auto mb-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={event => {event.preventDefault(); void reload();}}>
      <label className="relative block"><span className="sr-only">Search mithai</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"/>
        <input value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-full border border-[#e8dfd2] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#a17d42]" placeholder="Search mithai"/>
      </label>
      <label><span className="sr-only">Filter by category</span><select value={category} onChange={event => {setCategory(event.target.value); void reload(event.target.value);}} className="h-full min-h-11 rounded-full border border-[#e8dfd2] bg-white px-4 text-sm outline-none focus:border-[#a17d42]">
        <option value="">All categories</option>{categories.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}
      </select></label>
      <button type="submit" className="rounded-full bg-maroon px-6 py-3 text-sm font-bold text-white">Search</button>
    </form>
    {error && <div role="alert" className="mx-auto mb-6 max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}<button type="button" className="ml-3 font-semibold underline" onClick={() => void reload()}>Try again</button></div>}
    {loading ? <p role="status" className="py-12 text-center text-sm text-stone-500">Loading fresh favourites…</p>
      : products.length === 0 ? <p className="rounded-2xl border border-dashed border-[#e8dfd2] p-12 text-center text-sm text-stone-500">No mithai matched your search. Try another name or category.</p>
        : <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => <article key={product.id} className="group overflow-hidden rounded-[1.8rem] border border-[#eee2ce] bg-white shadow-[0_12px_35px_rgba(61,35,22,.06)] transition hover:-translate-y-1.5">
            <Link to={`/products/${encodeURIComponent(product.slug)}`} className="relative block h-[300px] overflow-hidden sm:h-[340px]">
              <img src={product.imageUrl || fallbackImage} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105"/>
              <span className="absolute left-4 top-4 rounded-full bg-[#fffaf0]/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-maroon">{product.isFeatured ? "Bestseller" : product.category?.name ?? "MITHAS"}</span>
              <span className="absolute bottom-4 right-4 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-maroon shadow">{money(product.price)} <small className="font-normal text-stone-500">/ kg</small></span>
            </Link>
            <div className="p-6"><Link to={`/products/${encodeURIComponent(product.slug)}`} className="font-display text-2xl font-semibold hover:text-maroon">{product.name}</Link>
              <p className="mt-2 min-h-10 text-sm leading-6 text-stone-500">{product.description}</p>
              <button type="button" disabled={product.stockQuantity <= 0} onClick={() => add(product)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-[#d9bd85] bg-[#fffaf0] py-3.5 text-sm font-bold text-maroon transition hover:bg-maroon hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                <Plus size={17}/>{product.stockQuantity <= 0 ? "Out of stock" : "Add to sweet box"}
              </button>
            </div>
          </article>)}
        </div>}
  </section>;
}

export function ProductDetails({add}) {
  const {slug} = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getStorefrontProduct(slug).then(result => {
      if (active) setProduct(result);
    }).catch(requestError => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [slug]);

  if (loading) return <main className="min-h-[65vh] px-5 pb-20 pt-32 text-center text-stone-500">Loading product…</main>;
  if (error || !product) return <main className="min-h-[65vh] px-5 pb-20 pt-32 text-center"><p role="alert" className="text-stone-600">{error || "Product not found."}</p><Link className="mt-5 inline-flex items-center gap-2 font-semibold text-maroon" to="/#mithai"><ArrowLeft size={16}/> Back to mithai</Link></main>;
  return <main className="min-h-[70vh] bg-[linear-gradient(135deg,#fffaf0,#f8edda_55%,#fffaf0)] px-5 pb-20 pt-32 md:px-8">
    <div className="mx-auto max-w-6xl"><Link className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-maroon" to="/#mithai"><ArrowLeft size={16}/> Back to all mithai</Link>
      <div className="grid overflow-hidden rounded-[2rem] border border-[#eee2ce] bg-white shadow-xl md:grid-cols-2">
        <img src={product.imageUrl || fallbackImage} alt={product.name} className="h-full min-h-[320px] max-h-[620px] w-full object-cover"/>
        <div className="flex flex-col justify-center p-7 sm:p-12"><span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#fff8e9] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-maroon"><Sparkles size={13}/>{product.category?.name}</span>
          <h1 className="mt-5 font-display text-4xl font-semibold sm:text-5xl">{product.name}</h1>
          <p className="mt-4 leading-7 text-stone-600">{product.description}</p>
          <p className="mt-7 font-display text-3xl font-semibold text-maroon">{money(product.price)} <small className="font-sans text-sm font-normal text-stone-500">/ kg</small></p>
          <p className="mt-3 text-sm text-stone-500">{product.stockQuantity > 0 ? `${product.stockQuantity} available` : "Currently out of stock"}</p>
          <button type="button" disabled={product.stockQuantity <= 0} onClick={() => add(product)} className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-maroon px-7 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><ShoppingBag size={17}/>{product.stockQuantity <= 0 ? "Out of stock" : "Add to sweet box"}</button>
        </div>
      </div>
    </div>
  </main>;
}

export function CheckoutPage({cart, clearCart, settings}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const idempotency = useRef({payload: null, key: null});

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    if (!globalThis.crypto?.randomUUID) {
      setError("Secure checkout is unavailable in this browser. Please reload and try again.");
      return;
    }
    const checkoutInput = {
      customerName: name,
      phone,
      deliveryAddress: address,
      items: cart.map(item => ({productId: item.id, quantity: item.qty})),
    };
    const payload = JSON.stringify(checkoutInput);
    if (idempotency.current.payload !== payload) {
      idempotency.current = {payload, key: globalThis.crypto.randomUUID()};
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await createStorefrontOrder(checkoutInput, idempotency.current.key);
      clearCart();
      navigate(`/order-confirmation/${encodeURIComponent(result.order.orderNumber)}`, {replace: true});
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const subtotalEstimate = cart.reduce((total, item) => total + Number(item.price) * item.qty, 0);
  const deliveryFeeEstimate = Number(settings?.deliveryFee ?? 0);
  const canOperate = settings?.isOperating !== false;
  const minimum = Number(settings?.minimumOrderAmount ?? 0);

  if (!cart.length) return <main className="min-h-[65vh] px-5 pb-20 pt-36 text-center"><h1 className="font-display text-3xl">Your sweet box is empty</h1><Link to="/#mithai" className="mt-5 inline-flex items-center gap-2 font-semibold text-maroon">Explore the mithai <ArrowRight size={16}/></Link></main>;

  return <main className="min-h-[70vh] bg-[linear-gradient(135deg,#fffaf0,#f8edda_55%,#fffaf0)] px-5 pb-20 pt-32 md:px-8">
    <div className="mx-auto max-w-5xl"><Link to="/#mithai" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-maroon"><ArrowLeft size={16}/> Continue shopping</Link>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-[1.8rem] border border-[#eee2ce] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="font-display text-3xl font-semibold">Delivery details</h1>
          <p className="mt-2 text-sm text-stone-500">Please share only the contact and address details needed to deliver your order.</p>
          {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
          {!canOperate && <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">The store is not currently accepting orders.</p>}
          <form onSubmit={event => void submit(event)} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-stone-700">Name
              <input required minLength={2} maxLength={120} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-[#e8dfd2] px-4 py-3 outline-none focus:border-[#a17d42]" value={name} onChange={event => setName(event.target.value)}/>
            </label>
            <label className="block text-sm font-medium text-stone-700">Phone
              <input required type="tel" minLength={8} maxLength={25} autoComplete="tel" pattern="\\+?[0-9][0-9 ()-]{6,23}" className="mt-1.5 w-full rounded-xl border border-[#e8dfd2] px-4 py-3 outline-none focus:border-[#a17d42]" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+91 98765 43210"/>
            </label>
            <label className="block text-sm font-medium text-stone-700">Delivery address
              <textarea required minLength={8} maxLength={1000} autoComplete="street-address" className="mt-1.5 min-h-28 w-full rounded-xl border border-[#e8dfd2] px-4 py-3 outline-none focus:border-[#a17d42]" value={address} onChange={event => setAddress(event.target.value)} placeholder="House/flat, street, locality, city, PIN code"/>
            </label>
            <button type="submit" disabled={submitting || !canOperate} className="flex w-full items-center justify-center gap-2 rounded-full bg-maroon py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "Placing order…" : "Place order"} <ArrowRight size={17}/>
            </button>
            <p className="text-center text-xs text-stone-500">No online payment is collected. Payment remains pending until confirmed by the shop.</p>
          </form>
        </section>

        <aside className="h-fit rounded-[1.8rem] border border-[#eee2ce] bg-[#fffdf8] p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Your sweet box</h2>
          <div className="mt-5 space-y-4">{cart.map(item => <div key={item.id} className="flex justify-between gap-4 border-b border-[#eee7dc] pb-3 text-sm">
            <div><p className="font-medium">{item.name} × {item.qty}</p><p className="mt-1 text-xs text-stone-500">{money(item.price)} / kg</p></div><b>{money(Number(item.price) * item.qty)}</b>
          </div>)}</div>
          <div className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><span>Subtotal estimate</span><span>{money(subtotalEstimate)}</span></div><div className="flex justify-between"><span>Delivery fee estimate</span><span>{money(deliveryFeeEstimate)}</span></div>
            <div className="border-t border-[#eee7dc] pt-3"><div className="flex justify-between font-semibold"><span>Estimated total</span><span>{money(subtotalEstimate + deliveryFeeEstimate)}</span></div><p className="mt-2 text-xs text-stone-500">Final prices, stock, minimum order, and delivery fee are rechecked by the server before order creation.</p></div>
            {subtotalEstimate < minimum && <p role="alert" className="text-xs text-rose-700">Minimum order is {money(minimum)}.</p>}
          </div>
        </aside>
      </div>
    </div>
  </main>;
}

export function OrderConfirmation() {
  const {orderNumber} = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getOrderConfirmation(orderNumber).then(result => {
      if (active) setOrder(result);
    }).catch(requestError => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [orderNumber]);

  if (loading) return <main className="min-h-[65vh] px-5 pb-20 pt-36 text-center text-stone-500">Loading order confirmation…</main>;
  if (error || !order) return <main className="min-h-[65vh] px-5 pb-20 pt-36 text-center"><p role="alert">{error || "Order confirmation not found."}</p><Link to="/" className="mt-5 inline-flex items-center gap-2 font-semibold text-maroon">Return home <ArrowRight size={16}/></Link></main>;

  return <main className="min-h-[70vh] bg-[linear-gradient(135deg,#fffaf0,#f8edda_55%,#fffaf0)] px-5 pb-20 pt-36 md:px-8">
    <section className="mx-auto max-w-2xl rounded-[2rem] border border-[#eee2ce] bg-white p-7 text-center shadow-xl sm:p-12">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 size={32}/></span>
      <p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-gold">Order received</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Thank you for choosing MITHAS</h1>
      <p className="mt-3 text-sm text-stone-500">Your order reference is</p>
      <p className="mt-2 rounded-xl bg-[#fff8e9] px-4 py-3 font-mono text-lg font-bold text-maroon">{order.orderNumber}</p>
      <div className="mt-6 space-y-2 text-sm text-stone-600">
        {order.items.map((item, index) => <p key={`${item.productName}-${index}`}>{item.productName} × {item.quantity} <span className="text-stone-400">· {money(item.subtotal)}</span></p>)}
      </div>
      <div className="mx-auto mt-6 max-w-xs space-y-2 border-t border-[#eee7dc] pt-4 text-sm"><p className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal)}</span></p><p className="flex justify-between"><span>Delivery</span><span>{money(order.deliveryFee)}</span></p><p className="flex justify-between font-bold"><span>Total</span><span>{money(order.total)}</span></p></div>
      <p className="mt-5 text-xs text-stone-500">Payment is not collected online. The shop will confirm your order and payment details.</p>
      <Link to="/" className="mt-7 inline-flex items-center gap-2 rounded-full bg-maroon px-7 py-3.5 text-sm font-bold text-white">Back to MITHAS <ArrowRight size={16}/></Link>
    </section>
  </main>;
}
