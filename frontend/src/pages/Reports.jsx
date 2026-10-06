import React, { useEffect, useState } from 'react';
import { api, fmtHours } from '../api.js';

const iso = (d) => d.toISOString().slice(0, 10);

export default function Reports() {
  const [from, setFrom] = useState(iso(new Date(Date.now() - 6 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/reports/summary?from=${from}&to=${to}`).then(setData).catch((e) => setError(e.message));
  }, [from, to]);

  const max = data ? Math.max(1, ...data.daily.map((d) => d.totalHours)) : 1;

  return (
    <section className="card">
      <h3>Attendance Reports</h3>
      <div className="row">
        <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {data && <strong>Total: {fmtHours(data.totalHours)}</strong>}
      </div>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <table>
            <thead><tr><th>Employee</th><th>Days present</th><th>Total hours</th><th>Avg / day</th></tr></thead>
            <tbody>
              {data.employees.map((e) => (
                <tr key={e.id}><td>{e.name}</td><td>{e.daysPresent}</td><td>{fmtHours(e.totalHours)}</td><td>{fmtHours(e.avgHoursPerDay)}</td></tr>
              ))}
            </tbody>
          </table>
          <h4>Hours per day</h4>
          {data.daily.map((d) => (
            <div key={d.date} className="bar-row">
              <span>{d.date}</span>
              <div className="bar" style={{ width: `${(d.totalHours / max) * 60}%` }} />
              <span>{fmtHours(d.totalHours)} · {d.employeesPresent} present</span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
