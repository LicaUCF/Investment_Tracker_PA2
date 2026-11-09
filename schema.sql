PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
    quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 10000),
    unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents BETWEEN 1 AND 100000000),
    category_id INTEGER NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Seed initial categories
INSERT OR IGNORE INTO categories (name) VALUES ('Stock');
INSERT OR IGNORE INTO categories (name) VALUES ('Fund');
INSERT OR IGNORE INTO categories (name) VALUES ('Crypto');
INSERT OR IGNORE INTO categories (name) VALUES ('Bond');