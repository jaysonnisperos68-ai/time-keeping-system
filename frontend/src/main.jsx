import React, { useEffect, useState, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from 'react-router-dom';
import { api, getToken, setToken } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admin from './pages/Admin.jsx';
import Reports from './pages/Reports.jsx';
import './styles.css';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function Layout() {
  const { user, logout } = useAuth();
  return (
    <>
      <nav className="nav">
        <strong>⏱ Time Keeping</strong>
        <NavLink to="/">Dashboard</NavLink>
        {user.role === 'admin' && <NavLink to="/admin">Employees</NavLink>}
        {user.role === 'admin' && <NavLink to="/reports">Reports</NavLink>}
        <span className="spacer" />
        <span>{user.name} ({user.role})</span>
        <button onClick={logout}>Logout</button>
      </nav>
      <main><Outlet /></main>
    </>
  );
}

function Protected({ adminOnly }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());

  useEffect(() => {
    if (getToken()) api('/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  const login = async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(r.token);
    setUser(r.user);
  };
  const logout = () => { setToken(null); setUser(null); };

  if (!ready) return <p>Loading…</p>;
  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route element={<Protected />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route element={<Protected adminOnly />}>
                <Route path="admin" element={<Admin />} />
                <Route path="reports" element={<Reports />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthCtx.Provider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
