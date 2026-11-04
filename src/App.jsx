import {useCallback,useEffect,useMemo,useState} from "react";
import {AnimatePresence,motion} from "framer-motion";
import {ShoppingBag,Star,Truck,Award,Clock,Heart,Menu,X,Phone,MapPin,Plus,Minus,Trash2,MessageCircle,ArrowRight,Sparkles} from "lucide-react";
import {Link,Route,Routes,useLocation,useNavigate} from "react-router-dom";
import Story from "./Story.jsx";
import AdminLayout from "./admin/layouts/AdminLayout.jsx";
import Dashboard from "./admin/pages/Dashboard.jsx";
import Login from "./admin/pages/Login.jsx";
import Products from "./admin/pages/Products.jsx";
import Orders from "./admin/pages/Orders.jsx";
import Categories from "./admin/pages/Categories.jsx";
import Inventory from "./admin/pages/Inventory.jsx";
import Customers from "./admin/pages/Customers.jsx";
import CustomerDetails from "./admin/pages/CustomerDetails.jsx";
import Settings from "./admin/pages/Settings.jsx";
import {AdminAuthProvider} from "./admin/auth/AdminAuthContext.jsx";
import RequireAdmin from "./admin/auth/RequireAdmin.jsx";
import {CatalogSection, CheckoutPage, OrderConfirmation, ProductDetails} from "./StorefrontViews.jsx";
import {getStorefrontCategories, getStorefrontProducts, getStorefrontSettings} from "./storefrontApi.js";

const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n||0));

function Header({count,onCart}){
 const [menu,setMenu]=useState(false),loc=useLocation();
 useEffect(()=>{setMenu(false);},[loc.pathname]);
 const links=[["Home","/"],["Our Mithai","/#mithai"],["Our Story","/story"],["Contact","/#contact"]];
 return <motion.header initial={{y:-80}} animate={{y:0}} transition={{duration:.6}} className="fixed inset-x-0 top-0 z-40 border-b border-[#eadfce]/70 bg-[#fffaf0]/90 backdrop-blur-xl">
 <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 md:px-8">
 <Link to="/" className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-maroon text-xl font-bold text-[#f7d98e] shadow-md">M</span><span><b className="block font-display text-2xl text-maroon">MITHAS</b><small className="text-[10px] uppercase tracking-[.25em] text-stone-500">The Mithai House</small></span></Link>
 <nav className="hidden items-center gap-9 text-sm font-semibold md:flex">{links.map(([n,to])=><Link key={n} to={to} className="transition hover:text-maroon">{n}</Link>)}</nav>
 <div className="flex items-center gap-2"><button onClick={onCart} className="relative flex items-center gap-2 rounded-full bg-maroon px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"><ShoppingBag size={17}/> <span className="hidden sm:inline">Your Box</span>{count>0&&<span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#f7d98e] px-1 text-xs text-maroon">{count}</span>}</button><button className="rounded-full p-2 text-maroon md:hidden" onClick={()=>setMenu(!menu)} aria-label="Toggle menu">{menu?<X/>:<Menu/>}</button></div></div>
 <AnimatePresence>{menu&&<motion.nav initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden bg-cream px-6 md:hidden"><div className="flex flex-col gap-4 py-5">{links.map(([n,to])=><Link key={n} to={to} onClick={()=>setMenu(false)}>{n}</Link>)}</div></motion.nav>}</AnimatePresence>
 </motion.header>
}

function Cart({open,onClose,cart,qty,remove,onCheckout,settings}){
 const estimate=cart.reduce((total,item)=>total+Number(item.price)*item.qty,0);
 const totalItems=cart.reduce((total,item)=>total+item.qty,0);
 return <AnimatePresence>{open&&<><motion.button aria-label="Close cart" onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/45"/><motion.aside initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}} transition={{type:"spring",damping:28}} className="fixed right-0 top-0 z-[60] flex h-full w-full max-w-md flex-col bg-[#fffdf8] shadow-2xl">
 <div className="flex items-center justify-between border-b border-amber-100 p-6"><div><h2 className="font-display text-2xl text-maroon">Your Sweet Box</h2><p className="text-xs text-stone-500">{totalItems} items selected</p></div><button onClick={onClose} aria-label="Close cart"><X/></button></div>
 {cart.length===0?<div className="flex flex-1 flex-col items-center justify-center text-center"><ShoppingBag size={44} className="text-amber-300"/><h3 className="mt-4 font-display text-2xl">A little sweetness?</h3><p className="mt-2 text-sm text-stone-500">Your box is waiting for its first mithai.</p></div>:<><div className="flex-1 space-y-4 overflow-y-auto p-5">{cart.map(item=><div key={item.id} className="flex gap-4 border-b border-amber-100 pb-4"><img src={item.imageUrl||"https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=300&q=75"} alt={item.name} className="h-24 w-24 rounded-2xl object-cover"/><div className="min-w-0 flex-1"><div className="flex justify-between"><div><Link to={`/products/${encodeURIComponent(item.slug)}`} onClick={onClose} className="font-semibold">{item.name}</Link><p className="text-xs text-stone-500">{money(item.price)} / kg</p></div><button onClick={()=>remove(item.id)} aria-label={`Remove ${item.name}`}><Trash2 size={17}/></button></div><div className="mt-4 flex items-center justify-between"><div className="flex items-center gap-3 rounded-full border px-3 py-1"><button onClick={()=>qty(item.id,-1)} aria-label={`Decrease ${item.name}`}><Minus size={14}/></button><span>{item.qty}</span><button onClick={()=>qty(item.id,1)} aria-label={`Increase ${item.name}`} disabled={item.qty>=item.stockQuantity} className="disabled:opacity-40"><Plus size={14}/></button></div><b className="text-maroon">{money(Number(item.price)*item.qty)}</b></div>{item.qty>item.stockQuantity&&<p role="alert" className="mt-2 text-xs text-rose-700">Quantity exceeds the latest known stock.</p>}</div></div>)}</div><div className="border-t bg-[#fff8e9] p-6"><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal estimate</span><span>{money(estimate)}</span></div><div className="flex justify-between"><span>Delivery estimate</span><span>{money(settings?.deliveryFee??0)}</span></div><div className="flex justify-between border-t border-amber-200 pt-2 text-lg font-bold"><span>Total estimate</span><span className="text-maroon">{money(estimate+Number(settings?.deliveryFee??0))}</span></div></div><button onClick={onCheckout} disabled={!cart.length||settings?.isOperating===false} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-maroon py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><ShoppingBag size={18}/> Proceed to checkout</button><p className="mt-3 text-center text-xs text-stone-500">Final price and availability are confirmed securely at checkout.</p></div></>}
 </motion.aside></>}</AnimatePresence>
}

function Footer(){return <footer id="contact" className="bg-[#241916] px-5 py-14 text-white md:px-8"><div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3"><div><p className="font-display text-3xl">MITHAS</p><p className="mt-3 max-w-sm text-sm leading-7 text-white/55">A little sweetness for life's most meaningful moments.</p></div><div><h4 className="font-bold text-[#f2d38d]">Get in touch</h4><p className="mt-4 flex gap-2 text-sm text-white/65"><Phone size={16}/> +91 98765 43210</p><p className="mt-3 flex gap-2 text-sm text-white/65"><MapPin size={16}/> Kolhapur, Maharashtra</p></div><div><h4 className="font-bold text-[#f2d38d]">Explore</h4><div className="mt-4 flex flex-col gap-3 text-sm text-white/65"><Link to="/">Home</Link><Link to="/story">Our story</Link><a href="/#mithai">Our mithai</a></div></div></div><div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-6 text-center text-xs text-white/40">© {new Date().getFullYear()} MITHAS. Made with care in Kolhapur.</div></footer>}

function Home({add, products, categories, loading, error, search, setSearch, category, setCategory, reload}){
 return <main>
 <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_80%_20%,#f3dfb5_0,transparent_35%),linear-gradient(135deg,#fffaf0,#f8edda_55%,#fffaf0)] px-5 pb-24 pt-32 md:px-8 md:pb-32 md:pt-40"><div className="pointer-events-none absolute -left-28 top-36 h-72 w-72 rounded-full bg-rose-100/60 blur-3xl"/><div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[.92fr_1.08fr]">
 <motion.div initial={{opacity:0,y:35}} animate={{opacity:1,y:0}} transition={{duration:.8}}><span className="inline-flex items-center gap-2 rounded-full border border-[#d9bd85] bg-white/70 px-4 py-2 text-[11px] font-bold uppercase tracking-[.2em] text-maroon"><Sparkles size={14}/> A little joy in every bite</span><h1 className="mt-7 max-w-2xl font-display text-6xl font-semibold leading-[1.02] text-[#30231e] sm:text-7xl lg:text-[5.7rem]">Made with love.<br/><em className="text-maroon">Remembered</em><br/>with every bite.</h1><p className="mt-7 max-w-lg text-base leading-8 text-stone-600 md:text-lg">Discover timeless Indian sweets, crafted with care and made to make ordinary moments feel special.</p><div className="mt-9 flex flex-wrap gap-4"><a href="#mithai" className="group inline-flex items-center gap-3 rounded-full bg-maroon px-7 py-4 text-sm font-bold text-white shadow-xl transition hover:-translate-y-1">Explore our mithai <ArrowRight size={17}/></a><Link to="/story" className="rounded-full border border-stone-300 bg-white/60 px-7 py-4 text-sm font-bold">Our story</Link></div><div className="mt-12 flex flex-wrap gap-8 border-t border-[#ddcdb2] pt-7"><div><b className="font-display text-3xl text-maroon">Made fresh</b><p className="text-xs uppercase tracking-widest text-stone-500">Every day</p></div><div><b className="font-display text-3xl text-maroon">Pure joy</b><p className="text-xs uppercase tracking-widest text-stone-500">In every box</p></div><div><b className="font-display text-3xl text-maroon">Since 1985*</b><p className="text-xs uppercase tracking-widest text-stone-500">Family tradition</p></div></div></motion.div>
 <motion.div initial={{opacity:0,scale:.92}} animate={{opacity:1,scale:1}} transition={{duration:1,delay:.15}} className="relative mx-auto w-full max-w-2xl"><div className="absolute -inset-5 rounded-[3rem] border border-[#d5b879]/60"/><div className="shine-wrap relative h-[430px] overflow-hidden rounded-[2.5rem] shadow-soft sm:h-[560px]"><img src="https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=1600&q=90" alt="Assorted Indian sweets" className="h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-[#2d160f]/55 to-transparent"/><div className="absolute bottom-8 left-8 text-white"><p className="text-xs font-bold uppercase tracking-[.25em] text-[#f7d98e]">The art of mithai</p><p className="mt-2 font-display text-3xl sm:text-4xl">Sweet moments, beautifully made.</p></div></div><motion.div animate={{y:[0,-10,0]}} transition={{duration:4,repeat:Infinity}} className="absolute -left-4 top-10 rounded-2xl bg-white/95 p-4 shadow-xl sm:-left-10"><div className="flex items-center gap-2 text-sm font-bold"><Star size={17} className="fill-gold text-gold"/> Crafted with care</div><p className="mt-1 text-xs text-stone-500">A tradition worth sharing</p></motion.div><motion.div animate={{y:[0,9,0]}} transition={{duration:4.5,repeat:Infinity}} className="absolute -bottom-5 right-4 rounded-2xl bg-maroon px-5 py-4 text-white shadow-xl sm:-right-7"><p className="text-xs uppercase tracking-widest text-[#f4d89c]">Make it a celebration</p><p className="mt-1 font-display text-xl">Gift a little happiness</p></motion.div></motion.div>
 </div></section>
 <CatalogSection products={products} categories={categories} loading={loading} error={error} search={search} setSearch={setSearch} category={category} setCategory={setCategory} reload={reload} add={add}/>
 <section className="overflow-hidden bg-[#f2e6d2] px-5 py-20 md:px-8"><div className="mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-2"><div><span className="text-xs font-bold uppercase tracking-[.25em] text-maroon">The MITHAS promise</span><h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">Not just sweets.<br/><em className="text-maroon">A reason to gather.</em></h2><p className="mt-5 max-w-lg leading-8 text-stone-600">From a family celebration to a small personal treat, every sweet moment deserves something made with thought and care.</p><Link to="/story" className="mt-7 inline-flex items-center gap-2 font-bold text-maroon">Discover our story <ArrowRight size={17}/></Link></div><div className="grid grid-cols-2 gap-4">{[{I:Award,t:"Carefully crafted",d:"Made with attention to every detail"},{I:Clock,t:"Fresh batches",d:"Prepared in small, fresh batches"},{I:Heart,t:"Made to share",d:"For family, friends and festivities"},{I:Truck,t:"Easy ordering",d:"Build a box and order with WhatsApp"}].map((f,i)=><motion.div key={f.t} whileHover={{y:-5}} className={`rounded-3xl bg-white p-5 shadow-sm ${i%2?"mt-8":""}`}><f.I className="text-maroon" size={27}/><h3 className="mt-4 font-display text-xl font-semibold">{f.t}</h3><p className="mt-2 text-xs leading-5 text-stone-500">{f.d}</p></motion.div>)}</div></div></section>
 <section className="px-5 py-20 md:px-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 rounded-[2rem] bg-maroon px-8 py-12 text-center text-white md:flex-row md:px-14 md:text-left"><div><span className="text-xs font-bold uppercase tracking-[.25em] text-[#f4d89c]">A thoughtful little gift</span><h2 className="mt-3 font-display text-3xl sm:text-4xl">Make someone's day sweeter.</h2><p className="mt-3 text-sm text-white/70">Create a sweet box for the people you love.</p></div><a href="#mithai" className="rounded-full bg-[#f2d38d] px-8 py-4 text-sm font-bold text-maroon transition hover:scale-105">Build your sweet box <ArrowRight className="ml-2 inline" size={16}/></a></div></section><Footer/></main>
}

export default function App(){
 return <Routes>
  <Route path="/admin/login" element={<AdminAuthProvider><Login/></AdminAuthProvider>}/>
  <Route path="/admin" element={<AdminAuthProvider><RequireAdmin/></AdminAuthProvider>}>
   <Route element={<AdminLayout/>}>
   <Route index element={<Dashboard/>}/>
   <Route path="products" element={<Products/>}/>
   <Route path="orders" element={<Orders/>}/>
   <Route path="categories" element={<Categories/>}/>
   <Route path="inventory" element={<Inventory/>}/>
   <Route path="customers" element={<Customers/>}/>
   <Route path="customers/:id" element={<CustomerDetails/>}/>
   <Route path="settings" element={<Settings/>}/>
   </Route>
  </Route>
  <Route path="*" element={<Storefront/>}/>
 </Routes>;
}

function Storefront(){
 const navigate=useNavigate();
 const [cart,setCart]=useState([]),[open,setOpen]=useState(false);
 const [products,setProducts]=useState([]);
 const [categories,setCategories]=useState([]);
 const [settings,setSettings]=useState(null);
 const [loading,setLoading]=useState(true);
 const [catalogError,setCatalogError]=useState("");
 const [search,setSearch]=useState("");
 const [category,setCategory]=useState("");
 const [appliedSearch,setAppliedSearch]=useState("");
 const count=useMemo(()=>cart.reduce((s,i)=>s+i.qty,0),[cart]);
 const loadCatalog=useCallback(async(nextSearch="",nextCategory="")=>{
  setLoading(true);setCatalogError("");
  try{
   const result=await getStorefrontProducts({search:nextSearch,category:nextCategory});
   setProducts(result.items);
   setAppliedSearch(nextSearch);
  }catch(error){setCatalogError(error.message)}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{
  let active=true;
  Promise.allSettled([getStorefrontCategories(),getStorefrontSettings(),getStorefrontProducts()])
   .then(([categoryResult,settingsResult,productsResult])=>{
    if(!active)return;
    if(categoryResult.status==="fulfilled")setCategories(categoryResult.value);
    if(settingsResult.status==="fulfilled")setSettings(settingsResult.value);
    if(productsResult.status==="fulfilled")setProducts(productsResult.value.items);
    else setCatalogError(productsResult.reason.message);
   })
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 const reload=(nextCategory=category,nextSearch=search)=>loadCatalog(nextSearch,nextCategory);
 const add=p=>{
  if(p.stockQuantity<=0)return;
  setCart(old=>{
   const found=old.find(item=>item.id===p.id);
   if(found)return old.map(item=>item.id===p.id?{...item,...p,qty:Math.min(found.qty+1,p.stockQuantity)}:item);
   return [...old,{...p,qty:1}];
  });
  setOpen(true);
 };
 const qty=(id,d)=>setCart(old=>old.map(item=>item.id===id?{...item,qty:Math.max(0,Math.min(item.stockQuantity,item.qty+d))}:item).filter(item=>item.qty>0));
 const remove=id=>setCart(old=>old.filter(i=>i.id!==id));
 const checkout=()=>{setOpen(false);navigate("/checkout")};
 const home=<Home add={add} products={products} categories={categories} loading={loading} error={catalogError} search={search} setSearch={setSearch} category={category} setCategory={value=>{setCategory(value);void reload(value,appliedSearch)}} reload={()=>reload(category,search)}/>;
 return <><Header count={count} onCart={()=>setOpen(true)}/><Routes>
  <Route path="/" element={home}/>
  <Route path="/story" element={<Story/>}/>
  <Route path="/products/:slug" element={<ProductDetails add={add}/>}/>
  <Route path="/checkout" element={<CheckoutPage cart={cart} clearCart={()=>setCart([])} settings={settings}/>}/>
  <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmation/>}/>
  <Route path="*" element={home}/>
 </Routes><Cart open={open} onClose={()=>setOpen(false)} cart={cart} qty={qty} remove={remove} onCheckout={checkout} settings={settings}/></>;
}