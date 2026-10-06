require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createDb, seedAdmin } = require('./db');
const { createApp } = require('./app');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 16) {
  console.error('JWT_SECRET must be set (min 16 chars). See backend/.env.example');
  process.exit(1);
}
const dbFile = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'timekeeping.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = createDb(dbFile);

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  if (seedAdmin(db, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD)) console.log('Seeded admin account');
}

const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
const app = createApp(db, {
  jwtSecret,
  corsOrigin: process.env.CORS_ORIGIN,
  staticDir: fs.existsSync(dist) ? dist : undefined,
});
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Time keeping API listening on :${port}`));
