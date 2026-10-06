import React, { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, fmtTime, fmtHours } from '../api.js';

const blank = { name: '', email: '', password: '', role: 'employee' };

export default function Admin() {
  const [employees, setEmployees] = useState([]);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setEmployees(await api('/employees'));
      setLogs(await api('/admin/logs'));
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try { await api('/employees', { method: 'POST', body: form }); setForm(blank); load(); } catch (err) { setError(err.message); }
  };
  const toggle = async (u) => {
    setError('');
    try { await api(`/employees/${u.id}`, { method: 'PUT', body: { active: !u.active } }); load(); } catch (err) { setError(err.message); }
  };

  return (
    <>
      {error && <p className="error">{error}</p>}
      <section className="card">
        <h3>Employees</h3>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
          <tbody>
            {employees.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
                <td>{!u.active ? 'Inactive' : u.clockedIn ? '🟢 Clocked in' : '⚪ Clocked out'}</td>
                <td><button onClick={() => toggle(u)}>{u.active ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="row" onSubmit={add}>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input type="password" placeholder="Password (min 8)" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="employee">Employee</option><option value="admin">Admin</option>
          </select>
          <button type="submit">Add</button>
        </form>
      </section>
      <section className="card">
        <h3>Recent Records</h3>
        <table>
          <thead><tr><th>Employee</th><th>Date</th><th>In</th><th>Out</th><th>Hours</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}><td>{l.name}</td><td>{fmtDate(l.clock_in)}</td><td>{fmtTime(l.clock_in)}</td><td>{fmtTime(l.clock_out)}</td><td>{fmtHours(l.hours)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
