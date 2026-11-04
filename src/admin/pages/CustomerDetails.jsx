import {useEffect, useState} from "react";
import {Link, useParams} from "react-router-dom";
import {getAdminCustomer} from "../api/adminApi.js";
import {AdminMessage, Card, PageHeading, secondaryButtonClass} from "../components/AdminUi.jsx";

export default function CustomerDetails() {
  const {id} = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getAdminCustomer(id).then(result => {
      if (active) setCustomer(result);
    }).catch(requestError => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  if (loading) return <AdminMessage loading/>;
  if (error) return <AdminMessage error={error}/>;
  if (!customer) return <AdminMessage empty="Customer record not found."/>;

  return <div>
    <PageHeading title="Customer details" description="Personal contact information and order history." action={<Link className={secondaryButtonClass} to="/admin/customers">Back to customers</Link>}/>
    <Card className="mb-5">
      <h3 className="font-display text-xl font-semibold">{customer.name}</h3>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-stone-400">Phone</dt><dd className="mt-1">{customer.phone}</dd></div>
        <div><dt className="text-xs text-stone-400">Email</dt><dd className="mt-1">{customer.email || "—"}</dd></div>
        <div><dt className="text-xs text-stone-400">Total orders</dt><dd className="mt-1">{customer.totalOrders}</dd></div>
        <div><dt className="text-xs text-stone-400">Paid spending</dt><dd className="mt-1 font-semibold">₹{customer.totalSpending}</dd></div>
      </dl>
    </Card>
    <Card>
      <h3 className="mb-4 font-display text-lg font-semibold">Order history</h3>
      {!customer.orders.length ? <AdminMessage empty="This customer has no orders."/> : <div className="space-y-4">
        {customer.orders.map(order => <article key={order.id} className="rounded-xl border border-[#f0ebe3] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-semibold text-[#641c32]">{order.orderNumber}</p><p className="mt-1 text-xs text-stone-500">{new Date(order.createdAt).toLocaleString()}</p></div>
            <div className="text-right text-xs"><p>{order.orderStatus} · Payment {order.paymentStatus}</p><p className="mt-1 font-semibold">Total ₹{order.total}</p></div>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-stone-600">
            {order.items.map((item, index) => <li key={`${order.id}-${index}`}>{item.productName} × {item.quantity} <span className="text-stone-400">· ₹{item.subtotal}</span></li>)}
          </ul>
        </article>)}
      </div>}
    </Card>
  </div>;
}
