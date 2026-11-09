require('dotenv').config();
const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const argon2 = require('argon2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { validatePurchase } = require('./validation');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const dbFile = process.env.DB_FILE || 'database.sqlite';
const db = new Database(dbFile);

// Initialize schema
const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schemaSQL);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_at_least_32_chars_long_xyz',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

// CSRF & Origin middleware
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  const origin = req.get('Origin');
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    if (origin) {
      const host = req.get('Host');
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          return res.status(403).json({ error: 'Origin mismatch.' });
        }
      } catch (err) {
        return res.status(403).json({ error: 'Invalid origin.' });
      }
    }

    const clientToken = req.get('X-CSRF-Token') || req.body._csrf;
    if (!clientToken || clientToken !== req.session.csrfToken) {
      return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
    }
  }
  next();
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

function getValidCategoryIds() {
  const rows = db.prepare('SELECT id FROM categories').all();
  return new Set(rows.map(r => r.id));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// CSRF token endpoint
app.get('/api/csrf', (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (trimmedEmail.length < 3 || trimmedEmail.length > 254 || !emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email format or length.' });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(trimmedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    const passwordHash = await argon2.hash(password);
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(trimmedEmail, passwordHash);

    res.status(201).json({ id: result.lastInsertRowid, email: trimmedEmail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error during registration.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(trimmedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const validPassword = await argon2.verify(user.password_hash, password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session regeneration failed.' });
      }
      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ error: 'Session save failed.' });
        }
        res.json({ id: user.id, email: user.email });
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error during login.' });
  }
});

app.get('/api/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed.' });
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// Categories Route
app.get('/api/categories', requireAuth, (req, res) => {
  try {
    const categories = db.prepare('SELECT id, name FROM categories').all();
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
});

// Purchases Routes
app.get('/api/purchases', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT p.id, p.name, p.quantity, p.unit_price_cents AS unitPriceCents,
             p.category_id AS categoryId, c.name AS categoryName,
             (p.quantity * p.unit_price_cents) AS costCents
      FROM purchases p
      JOIN categories c ON p.category_id = c.id
      WHERE p.owner_id = ?
      ORDER BY p.id ASC
    `);
    const purchases = stmt.all(req.session.userId);
    res.json(purchases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
});

app.post('/api/purchases', requireAuth, (req, res) => {
  try {
    const validCategories = getValidCategoryIds();
    const validation = validatePurchase(req.body, validCategories);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const { name, quantity, unitPriceCents, categoryId } = validation.value;
    const ownerId = req.session.userId;

    const stmt = db.prepare(`
      INSERT INTO purchases (owner_id, name, quantity, unit_price_cents, category_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(ownerId, name, quantity, unitPriceCents, categoryId);
    const purchaseId = result.lastInsertRowid;

    const created = db.prepare(`
      SELECT p.id, p.name, p.quantity, p.unit_price_cents AS unitPriceCents,
             p.category_id AS categoryId, c.name AS categoryName,
             (p.quantity * p.unit_price_cents) AS costCents
      FROM purchases p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.owner_id = ?
    `).get(purchaseId, ownerId);

    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
});

app.put('/api/purchases/:id', requireAuth, (req, res) => {
  try {
    const rawId = Number(req.params.id);
    if (!Number.isInteger(rawId) || rawId < 1) {
      return res.status(400).json({ error: 'Invalid purchase ID.' });
    }

    const existing = db.prepare('SELECT * FROM purchases WHERE id = ? AND owner_id = ?').get(rawId, req.session.userId);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase not found or unauthorized.' });
    }

    const validCategories = getValidCategoryIds();
    const validation = validatePurchase(req.body, validCategories);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const { name, quantity, unitPriceCents, categoryId } = validation.value;

    db.prepare(`
      UPDATE purchases
      SET name = ?, quantity = ?, unit_price_cents = ?, category_id = ?
      WHERE id = ? AND owner_id = ?
    `).run(name, quantity, unitPriceCents, categoryId, rawId, req.session.userId);

    const updated = db.prepare(`
      SELECT p.id, p.name, p.quantity, p.unit_price_cents AS unitPriceCents,
             p.category_id AS categoryId, c.name AS categoryName,
             (p.quantity * p.unit_price_cents) AS costCents
      FROM purchases p
      JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.owner_id = ?
    `).get(rawId, req.session.userId);

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
});

app.delete('/api/purchases/:id', requireAuth, (req, res) => {
  try {
    const rawId = Number(req.params.id);
    if (!Number.isInteger(rawId) || rawId < 1) {
      return res.status(400).json({ error: 'Invalid purchase ID.' });
    }

    const existing = db.prepare('SELECT * FROM purchases WHERE id = ? AND owner_id = ?').get(rawId, req.session.userId);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase not found or unauthorized.' });
    }

    db.prepare('DELETE FROM purchases WHERE id = ? AND owner_id = ?').run(rawId, req.session.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});