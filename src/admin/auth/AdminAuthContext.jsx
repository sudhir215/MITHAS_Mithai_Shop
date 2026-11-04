import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {AdminAuthError, getAdminSession, loginAdmin as requestLogin, logoutAdmin as requestLogout} from "./adminAuthApi.js";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({children}) {
  const [status, setStatus] = useState("checking");
  const [admin, setAdmin] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const [sessionError, setSessionError] = useState("");

  const checkSession = useCallback(async () => {
    setStatus("checking");
    setSessionError("");
    try {
      const session = await getAdminSession();
      setAdmin(session.admin);
      setCsrfToken(session.csrfToken);
      setStatus("authenticated");
    } catch (error) {
      setAdmin(null);
      setCsrfToken(null);
      if (error instanceof AdminAuthError && error.status === 401) {
        setStatus("unauthenticated");
        return;
      }
      setSessionError(error.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const login = useCallback(async credentials => {
    const result = await requestLogin(credentials);
    setAdmin(result.admin);
    setCsrfToken(result.csrfToken);
    setSessionError("");
    setStatus("authenticated");
    return result.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await requestLogout(csrfToken);
    } catch (error) {
      if (!(error instanceof AdminAuthError && error.status === 401)) {
        throw error;
      }
    }
    setAdmin(null);
    setCsrfToken(null);
    setStatus("unauthenticated");
  }, [csrfToken]);

  const value = useMemo(() => ({
    status,
    admin,
    csrfToken,
    sessionError,
    login,
    logout,
    checkSession,
  }), [status, admin, csrfToken, sessionError, login, logout, checkSession]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}
