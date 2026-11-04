import {useEffect, useState} from "react";
import {Link, Navigate, useLocation, useNavigate} from "react-router-dom";
import {ArrowLeft, LockKeyhole, Sparkles} from "lucide-react";
import {useAdminAuth} from "../auth/AdminAuthContext.jsx";

export default function Login() {
  const {status, sessionError, login, checkSession} = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const destination = location.state?.from?.pathname;
  const redirectTo = destination?.startsWith("/admin") && destination !== "/admin/login"
    ? destination
    : "/admin";

  useEffect(() => {
    if (status === "authenticated") {
      navigate(redirectTo, {replace: true});
    }
  }, [status, navigate, redirectTo]);

  if (status === "checking") {
    return <main className="grid min-h-screen place-items-center bg-[#faf7f0] text-sm text-stone-600">Checking admin session…</main>;
  }

  if (status === "error") {
    return <main className="grid min-h-screen place-items-center bg-[#faf7f0] px-4">
      <section role="alert" className="max-w-md rounded-2xl border border-[#eadfc7] bg-white p-6 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold text-[#641c32]">Unable to check your session</h1>
        <p className="mt-2 text-sm text-stone-600">{sessionError}</p>
        <button type="button" onClick={() => void checkSession()} className="mt-5 rounded-xl bg-[#641c32] px-5 py-3 text-sm font-semibold text-white">Try again</button>
      </section>
    </main>;
  }

  if (status === "authenticated") {
    return <Navigate to={redirectTo} replace/>;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login({email: normalizedEmail, password});
      setPassword("");
      navigate(redirectTo, {replace: true});
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#faf7f0] px-4 py-12">
    <section className="w-full max-w-[440px] rounded-[28px] border border-[#eee7dc] bg-white p-7 shadow-[0_20px_70px_rgba(70,50,33,.09)] sm:p-10">
      <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500 transition hover:text-[#641c32]"><ArrowLeft size={15}/> Back to storefront</Link>
      <div className="mt-8 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#641c32] font-display text-2xl font-bold text-[#e8cb88]">M</span><div><p className="font-display text-xl font-semibold text-[#641c32]">MITHAS</p><p className="text-[9px] uppercase tracking-[.22em] text-stone-400">The Mithai House</p></div></div>
      <div className="mt-8"><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.17em] text-[#a17d42]"><Sparkles size={13}/> Admin access</span><h1 className="mt-2 font-display text-3xl font-semibold text-[#30252a]">Welcome back</h1><p className="mt-2 text-sm leading-6 text-stone-500">Sign in with your authorized MITHAS admin account.</p></div>
      <form className="mt-7 space-y-5" onSubmit={handleSubmit} noValidate>
        <label className="block text-sm font-medium text-stone-700" htmlFor="admin-email">
          Email address
          <input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={isSubmitting} className="mt-2 w-full rounded-xl border border-[#e5ded2] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#9b7440] focus:ring-2 focus:ring-[#9b7440]/15 disabled:bg-stone-50"/>
        </label>
        <label className="block text-sm font-medium text-stone-700" htmlFor="admin-password">
          Password
          <input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={isSubmitting} className="mt-2 w-full rounded-xl border border-[#e5ded2] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#9b7440] focus:ring-2 focus:ring-[#9b7440]/15 disabled:bg-stone-50"/>
        </label>
        {error && <p role="alert" aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#641c32] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#511629] disabled:cursor-not-allowed disabled:opacity-60">
          <LockKeyhole size={16}/>{isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-center text-[10px] text-stone-400">Authorized administrators only · Secure session</p>
    </section>
  </main>;
}
