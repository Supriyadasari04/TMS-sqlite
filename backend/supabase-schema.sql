-- ══════════════════════════════════════════════════════════════
--  TicketPro — Supabase Schema
--  Run this entire script in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ─── Users Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'agent', 'customer')),
  "createdAt" TEXT,
  "needsPasswordReset" BOOLEAN DEFAULT FALSE
);

-- ─── Tickets Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact TEXT NOT NULL CHECK(impact IN ('Low', 'Medium', 'High')),
  "accountHolder" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "ifscCode" TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'In Progress', 'Resolved', 'Closed')),
  "createdBy" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "assignedTo" TEXT
);

-- ─── Notifications Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  role TEXT,
  email TEXT,
  timestamp TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE
);

-- ─── Disable RLS (backend uses service_role key which bypasses RLS anyway) ───
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Done! Tables are ready for data migration.
