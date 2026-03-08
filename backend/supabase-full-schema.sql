-- ══════════════════════════════════════════════════════════════════════
--  TicketPro — COMPLETE Schema for ALL 14 Features
--  Run this ONCE in Supabase Dashboard → SQL Editor
--  This covers Features 1-14 so we NEVER need to come back here
-- ══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- FEATURE 1: Ticket Comments / Conversation Thread
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_comments (
  id BIGSERIAL PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userRole" TEXT NOT NULL CHECK("userRole" IN ('admin', 'agent', 'customer')),
  "userName" TEXT NOT NULL,
  message TEXT NOT NULL,
  "isAiDraft" BOOLEAN DEFAULT FALSE,
  "createdAt" TEXT NOT NULL,
  CONSTRAINT fk_comment_ticket FOREIGN KEY ("ticketId") REFERENCES tickets(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────
-- FEATURE 2: Ticket Activity History / Audit Trail
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_activity (
  id BIGSERIAL PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  action TEXT NOT NULL,
  "performedBy" TEXT NOT NULL,
  "performedByRole" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  details TEXT,
  "createdAt" TEXT NOT NULL,
  CONSTRAINT fk_activity_ticket FOREIGN KEY ("ticketId") REFERENCES tickets(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────
-- FEATURE 3: File Attachments
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attachments (
  id BIGSERIAL PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "commentId" BIGINT,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "fileType" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  CONSTRAINT fk_attachment_ticket FOREIGN KEY ("ticketId") REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_attachment_comment FOREIGN KEY ("commentId") REFERENCES ticket_comments(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────────────
-- FEATURE 4 & 5: SLA Tracking + Breach Alerts
-- Add columns to existing tickets table
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS "firstResponseAt" TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS "resolvedAt" TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS "slaBreached" BOOLEAN DEFAULT FALSE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS "slaWarning" BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────
-- FEATURE 8: Customer Feedback / CSAT Rating
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  "ticketId" TEXT UNIQUE NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT,
  "createdAt" TEXT NOT NULL,
  CONSTRAINT fk_feedback_ticket FOREIGN KEY ("ticketId") REFERENCES tickets(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────
-- FEATURES 9, 10, 13: AI columns on tickets
-- Smart Auto-Fill, Priority Detection, Sentiment Analysis
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS "aiSuggestedCategory" TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS "aiSuggestedImpact" TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS "aiConfidence" REAL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK(sentiment IN ('angry', 'frustrated', 'neutral', 'satisfied', NULL));

-- ─────────────────────────────────────────────────────────────────────
-- INDEXES for performance (future-proofing for large datasets)
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON ticket_comments("ticketId");
CREATE INDEX IF NOT EXISTS idx_activity_ticket ON ticket_activity("ticketId");
CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON attachments("ticketId");
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assignedto ON tickets("assignedTo");
CREATE INDEX IF NOT EXISTS idx_tickets_createdby ON tickets("createdBy");
CREATE INDEX IF NOT EXISTS idx_tickets_createdat ON tickets("createdAt");
CREATE INDEX IF NOT EXISTS idx_tickets_sla ON tickets("slaBreached");
CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(email);
CREATE INDEX IF NOT EXISTS idx_feedback_ticket ON feedback("ticketId");

-- ─────────────────────────────────────────────────────────────────────
-- DISABLE RLS on all new tables (backend uses service_role key)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE ticket_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activity DISABLE ROW LEVEL SECURITY;
ALTER TABLE attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- SUPABASE STORAGE: Create bucket for file attachments
-- (This needs to be done via Dashboard → Storage → New Bucket)
-- Bucket name: ticket-attachments
-- Public: YES (so files are accessible via URL)
-- ─────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
-- ✅ DONE! All tables, columns, indexes, and RLS configs ready.
-- You will NEVER need to run SQL in this editor again.
-- ═══════════════════════════════════════════════════════════════
