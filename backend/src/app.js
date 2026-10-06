const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hoursBetween(a, b) {
  return (new Date(b) - new Date(a)) / 3600000;
}
const round = (n) => Math.round(n * 100) / 100;

function createApp(db, { jwtSecret, corsOrigin, staticDir, loginLimit = 20 } = {}) {
  if (!jwtSecret) throw new Error('jwtSecret is required');
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: corsOrigin || false }));
  app.use(express.json({ limit: '10kb' }));

  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: !!u.active });

  const auth = (req, res, next) => {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    try {
      const payload = jwt.verify(h.slice(7), jwtSecret);
      const user = db.prepare('SELECT * FROM users WHERE id=?').get(payload.id);
      if (!user || !user.active) return res.status(401).json({ error: 'Invalid account' });
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
  const admin = (req, res, next) =>
    req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' });

  const range = (req, res) => {
    const { from, to } = req.query;
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      res.status(400).json({ error: 'from/to must be YYYY-MM-DD' });
      return null;
    }
    return { from: from || '0000-01-01', to: to || '9999-12-31' };
  };

  const withHours = (l) => ({
    ...l,
    hours: l.clock_out ? round(hoursBetween(l.clock_in, l.clock_out)) : null,
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // ---- Auth
  app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: loginLimit }), (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string')
      return res.status(400).json({ error: 'Email and password required' });
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase());
    if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '12h' });
    res.json({ token, user: publicUser(user) });
  });
  app.get('/api/auth/me', auth, (req, res) => res.json(publicUser(req.user)));

  // ---- Time tracking
  const openLog = (id) => db.prepare('SELECT * FROM time_logs WHERE user_id=? AND clock_out IS NULL').get(id);

  app.get('/api/time/status', auth, (req, res) => {
    const open = openLog(req.user.id);
    res.json({ clockedIn: !!open, since: open ? open.clock_in : null, serverTime: new Date().toISOString() });
  });
  app.post('/api/time/clock-in', auth, (req, res) => {
    if (openLog(req.user.id)) return res.status(409).json({ error: 'Already clocked in' });
    const now = new Date().toISOString();
    const info = db.prepare('INSERT INTO time_logs (user_id,date,clock_in) VALUES (?,?,?)')
      .run(req.user.id, now.slice(0, 10), now);
    res.status(201).json({ id: info.lastInsertRowid, clock_in: now });
  });
  app.post('/api/time/clock-out', auth, (req, res) => {
    const open = openLog(req.user.id);
    if (!open) return res.status(409).json({ error: 'Not clocked in' });
    const now = new Date().toISOString();
    db.prepare('UPDATE time_logs SET clock_out=? WHERE id=?').run(now, open.id);
    res.json(withHours({ ...open, clock_out: now }));
  });
  app.get('/api/time/logs', auth, (req, res) => {
    const r = range(req, res);
    if (!r) return;
    const logs = db.prepare('SELECT * FROM time_logs WHERE user_id=? AND date BETWEEN ? AND ? ORDER BY clock_in DESC')
      .all(req.user.id, r.from, r.to).map(withHours);
    res.json({ logs, totalHours: round(logs.reduce((s, l) => s + (l.hours || 0), 0)) });
  });

  // ---- Employee management (admin)
  app.get('/api/employees', auth, admin, (req, res) => {
    const rows = db.prepare('SELECT * FROM users ORDER BY name').all();
    const openIds = new Set(db.prepare('SELECT user_id FROM time_logs WHERE clock_out IS NULL').all().map((r) => r.user_id));
    res.json(rows.map((u) => ({ ...publicUser(u), clockedIn: openIds.has(u.id) })));
  });
  app.post('/api/employees', auth, admin, (req, res) => {
    const { name, email, password, role = 'employee' } = req.body || {};
    if (!name || typeof name !== 'string' || !EMAIL_RE.test(email || '') || typeof password !== 'string' || password.length < 8)
      return res.status(400).json({ error: 'Valid name, email and password (min 8 chars) required' });
    if (!['employee', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    try {
      const info = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
        .run(name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10), role);
      res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid)));
    } catch (e) {
      if (String(e.code).startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'Email already exists' });
      throw e;
    }
  });
  app.put('/api/employees/:id', auth, admin, (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!u) return res.status(404).json({ error: 'Not found' });
    const { name, email, password, role, active } = req.body || {};
    if (email !== undefined && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email' });
    if (password !== undefined && (typeof password !== 'string' || password.length < 8))
      return res.status(400).json({ error: 'Password min 8 chars' });
    if (role !== undefined && !['employee', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (u.id === req.user.id && (active === false || (role && role !== 'admin')))
      return res.status(400).json({ error: 'You cannot deactivate or demote yourself' });
    try {
      db.prepare('UPDATE users SET name=?,email=?,password_hash=?,role=?,active=? WHERE id=?').run(
        name ?? u.name,
        email ? email.toLowerCase() : u.email,
        password ? bcrypt.hashSync(password, 10) : u.password_hash,
        role ?? u.role,
        active === undefined ? u.active : active ? 1 : 0,
        u.id
      );
    } catch (e) {
      if (String(e.code).startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'Email already exists' });
      throw e;
    }
    res.json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)));
  });

  // ---- Records & reports (admin)
  app.get('/api/admin/logs', auth, admin, (req, res) => {
    const r = range(req, res);
    if (!r) return;
    const params = [r.from, r.to];
    let sql = `SELECT l.*, u.name FROM time_logs l JOIN users u ON u.id=l.user_id WHERE l.date BETWEEN ? AND ?`;
    if (req.query.userId) { sql += ' AND l.user_id=?'; params.push(Number(req.query.userId)); }
    res.json(db.prepare(sql + ' ORDER BY l.clock_in DESC LIMIT 1000').all(...params).map(withHours));
  });
  app.get('/api/reports/summary', auth, admin, (req, res) => {
    const r = range(req, res);
    if (!r) return;
    const logs = db.prepare('SELECT user_id, date, clock_in, clock_out FROM time_logs WHERE date BETWEEN ? AND ?').all(r.from, r.to);
    const users = db.prepare("SELECT id,name,email FROM users WHERE role='employee' ORDER BY name").all();
    const byUser = new Map(users.map((u) => [u.id, { ...u, totalHours: 0, daysPresent: new Set() }]));
    const byDate = new Map();
    for (const l of logs) {
      const e = byUser.get(l.user_id);
      const h = l.clock_out ? hoursBetween(l.clock_in, l.clock_out) : 0;
      if (e) { e.totalHours += h; e.daysPresent.add(l.date); }
      const d = byDate.get(l.date) || { date: l.date, totalHours: 0, present: new Set() };
      d.totalHours += h; d.present.add(l.user_id);
      byDate.set(l.date, d);
    }
    const employees = [...byUser.values()].map((e) => ({
      id: e.id, name: e.name, email: e.email, totalHours: round(e.totalHours), daysPresent: e.daysPresent.size,
      avgHoursPerDay: e.daysPresent.size ? round(e.totalHours / e.daysPresent.size) : 0,
    }));
    const daily = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ date: d.date, totalHours: round(d.totalHours), employeesPresent: d.present.size }));
    res.json({ employees, daily, totalHours: round(employees.reduce((s, e) => s + e.totalHours, 0)) });
  });

  if (staticDir) {
    const path = require('path');
    app.use(express.static(staticDir));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

module.exports = { createApp };
