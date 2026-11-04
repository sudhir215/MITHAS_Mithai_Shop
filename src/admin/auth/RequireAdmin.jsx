import {Navigate, Outlet, useLocation} from "react-router-dom";
import {useAdminAuth} from "./AdminAuthContext.jsx";

export default function RequireAdmin() {
  const {status, sessionError, checkSession} = useAdminAuth();
  const location = useLocation();

  if (status === "checking") {
    return <main className="grid min-h-screen place-items-center bg-[#faf7f0] text-sm text-stone-600">Checking admin session…</main>;
  }

  if (status === "error") {
    return <main className="grid min-h-screen place-items-center bg-[#faf7f0] px-4">
      <section role="alert" className="max-w-md rounded-2xl border border-[#eadfc7] bg-white p-6 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold text-[#641c32]">Session check failed</h1>
        <p className="mt-2 text-sm text-stone-600">{sessionError}</p>
        <button type="button" onClick={() => void checkSession()} className="mt-5 rounded-xl bg-[#641c32] px-5 py-3 text-sm font-semibold text-white">Try again</button>
      </section>
    </main>;
  }

  if (status !== "authenticated") {
    return <Navigate to="/admin/login" replace state={{from: location}}/>;
  }

  return <Outlet/>;
}
