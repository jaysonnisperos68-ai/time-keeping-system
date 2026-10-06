import React, { useCallback, useEffect, useState } from 'react';
import { api, fmtTime, fmtDate, fmtHours } from '../api.js';

const today = () => new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const [now, setNow] = useState(new Date());
  const [status, setStatus] = useState(null);
  const [data, setData] = useState({ logs: [], totalHours: 0 });
  const [error, setError] = useState('');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());

  const load = useCallback(async () => {
    try {
      setStatus(await api('/time/status'));
      setData(await api(`/time/logs?from=${from}&to=${to}`));
    } catch (e) { setError(e.message); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const punch = async (action) => {
    setError('');
    try { await api(`/time/${action}`, { method: 'POST' }); await load(); } catch (e) { setError(e.message); }
  };

  const elapsed = status?.clockedIn ? Math.max(0, now - new Date(status.since)) / 3600000 : 0;

  return (
    <>
      <section className="card center">
        <div className="clock">{now.toLocaleTimeString()}</div>
        <div>{now.toLocaleDateString(undefined, { dateStyle: 'full' })}</div>
        {status && (
          <p className={status.clockedIn ? 'in' : 'out'}>
            {status.clockedIn ? `Clocked in since ${fmtTime(status.since)} (${fmtHours(elapsed)})` : 'Currently clocked out'}
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button className="big in" disabled={!status || status.clockedIn} onClick={() => punch('clock-in')}>Clock In</button>{' '}
        <button className="big out" disabled={!status || !status.clockedIn} onClick={() => punch('clock-out')}>Clock Out</button>
      </section>
      <section className="card">
        <h3>Time Log</h3>
        <div className="row">
          <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <strong>Total: {fmtHours(data.totalHours)}</strong>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Hours</th></tr></thead>
          <tbody>
            {data.logs.map((l) => (
              <tr key={l.id}><td>{fmtDate(l.clock_in)}</td><td>{fmtTime(l.clock_in)}</td><td>{fmtTime(l.clock_out)}</td><td>{fmtHours(l.hours)}</td></tr>
            ))}
            {!data.logs.length && <tr><td colSpan="4">No records</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
