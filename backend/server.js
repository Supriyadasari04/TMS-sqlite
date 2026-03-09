// server.js — SmartDesk Backend (Supabase Edition)
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');
const nodemailer = require('nodemailer');

// ─── Email Config (Feature 14) ────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: (process.env.SMTP_PORT == '465'), // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ─── Multer Config (Memory Storage for streaming to Supabase) ──────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Groq Client (AI Services) ────────────────────────────────────────────────
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ─── Supabase Client (service_role bypasses RLS — backend use only) ────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── JWT Config ────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'smartdesk_fallback_secret';
const JWT_EXPIRES_IN = '8h';

// ─── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Standard CSP to clean up console errors (allows Supabase & Google Fonts)
app.use((req, res, next) => {
  res.set("Content-Security-Policy",
    "default-src 'self'; " +
    "connect-src 'self' http://localhost:3000 http://127.0.0.1:3000 https://ahwhjcahsdlibdjvtjot.supabase.co https://api.groq.com https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "img-src 'self' data: https://ahwhjcahsdlibdjvtjot.supabase.co https://img.icons8.com;"
  );
  next();
});

// Favicon Ghost Route (Clean console 404s)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Root Route: Serve Landing Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../html/landing.html'));
});

app.use(express.static(path.join(__dirname, '../')));

// ─── Supabase Auth Middleware & Demo Bypass ─────────────────────────────────────
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // 1. Try Demo JWT first (Local & Fast)
    const DEMO_SECRET = process.env.JWT_SECRET || 'ticketpro_jwt_secret_key_change_before_deploying_2026';
    try {
      const decoded = jwt.verify(token, DEMO_SECRET);
      if (decoded && decoded.is_demo) {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          username: decoded.username,
          role: decoded.role,
          is_demo: true
        };
        return next();
      }
    } catch (jwtErr) {
      // Not a demo token, proceed to Supabase check
    }

    // 2. Try Supabase Auth (Network Call)
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        req.user = user;
        // Map Supabase metadata to standard role/username
        req.user.role = user.user_metadata?.role || 'customer';
        req.user.username = user.user_metadata?.username || user.email.split('@')[0];
        return next();
      }
    } catch (supaErr) {
      console.error('[AUTH] Supabase connection error:', supaErr.message);
      // If it's a network reset, don't crash the server
      if (supaErr.code === 'ECONNRESET' || supaErr.code === 'UND_ERR_CONNECT_TIMEOUT') {
        return res.status(503).json({ error: 'Database connection timeout. Please try again.' });
      }
    }

    return res.status(403).json({ error: 'Invalid or expired session. Please sign in again.' });
  } catch (err) {
    console.error('[AUTH CRITICAL]:', err);
    res.status(500).json({ error: 'Internal authentication error' });
  }
}

// ─── Allowed search fields whitelist (SQL injection protection) ─────────────────
const ALLOWED_SEARCH_FIELDS = ['id', 'title', 'impact', 'accountHolder', 'status'];

// ─── Helper: Log activity ──────────────────────────────────────────────────────
async function logActivity(ticketId, action, performedBy, performedByRole, oldValue, newValue, details) {
  try {
    await supabase.from('ticket_activity').insert({
      ticketId,
      action,
      performedBy,
      performedByRole,
      oldValue: oldValue || null,
      newValue: newValue || null,
      details: details || null,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(`[DB ERROR] logActivity failed for ticket ${ticketId}:`, err);
  }
}

// ─── SLA Config (Service Level Agreements in MS) ────────────────────────────────
const SLA_CONFIG = {
  'High': { response: 1 * 3600000, resolve: 4 * 3600000 },    // 1h response, 4h resolve
  'Medium': { response: 4 * 3600000, resolve: 24 * 3600000 }, // 4h response, 24h resolve
  'Low': { response: 8 * 3600000, resolve: 72 * 3600000 }      // 8h response, 72h resolve
};

// ─── Helper: Build safe stats from ticket array ─────────────────────────────────
function buildStats(tickets) {
  return {
    total: tickets.length,
    pending: tickets.filter(t => t.status === 'Pending').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved').length,
    breached: tickets.filter(t => t.slaBreached).length
  };
}

// ─── Helper: Check and Mark SLA Breaches ────────────────────────────────────────
async function checkSlaBreach() {
  const now = new Date().toISOString();

  // 1. Mark Resolved tickets (those that have a deadline but aren't marked breached yet)
  // Check Response SLA (must respond before deadline)
  const { data: respBreaches } = await supabase
    .from('tickets')
    .select('id, slaResponseDeadline, createdBy, assignedTo')
    .is('firstResponseAt', null)
    .lt('slaResponseDeadline', now)
    .eq('slaBreached', false);

  // Check Resolution SLA (must resolve before deadline)
  const { data: resBreaches } = await supabase
    .from('tickets')
    .select('id, slaResolveDeadline, createdBy, assignedTo')
    .neq('status', 'Resolved')
    .lt('slaResolveDeadline', now)
    .eq('slaBreached', false);

  const breaches = [...(respBreaches || []), ...(resBreaches || [])];

  if (breaches.length > 0) {
    const ids = breaches.map(b => b.id);
    await supabase.from('tickets').update({ slaBreached: true }).in('id', ids);

    // SLA breached logic remains, but in-app notifications are removed.
    for (const b of breaches) {
      // Notify assigned agent via Email
      if (b.assignedTo) {
        const { data: agnt } = await supabase.from('users').select('email').eq('username', b.assignedTo).single();
        if (agnt) {
          sendTicketEmail(agnt.email, 'SLA BREACH ALERT', `Your assigned ticket #${b.id} has breached SLA.`, `This is a critical alert for ticket <b>#${b.id}</b>. Please resolve it immediately.`, b.id);
        }
      }
      // Notify admin
      sendTicketEmail(process.env.SMTP_USER, 'Global SLA Breach', `Ticket #${b.id} has breached SLA.`, `Urgent attention required for ticket <b>#${b.id}</b>.`, b.id);
    }
  }
}

// ─── Helper: Enrich tickets with user names ─────────────────────────────────────
async function enrichTicketsWithNames(tickets) {
  if (!tickets || tickets.length === 0) return [];

  const { data: users } = await supabase.from('users').select('email, username');
  if (!users) return tickets;

  const userMap = {};
  users.forEach(u => { userMap[u.email] = u.username; });

  return tickets.map(t => ({
    ...t,
    createdByName: userMap[t.createdBy] || t.createdBy,
    assignedToName: userMap[t.assignedTo] || t.assignedTo || 'Unassigned'
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
//  AUTH & DEMO LOGIN
// ══════════════════════════════════════════════════════════════════════════════

// Demo Login Bypass (Internal @smartdesk.com accounts only)
app.post('/api/signin/demo', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    if (!email.toLowerCase().endsWith('@smartdesk.com')) {
      return res.status(401).json({ error: 'Only professional @smartdesk.com accounts can use demo login.' });
    }

    console.log(`[LOGIN ATTEMPT] Demo login for: ${email} (Password length: ${password.length})`);

    // Check users table directly (Case-Insensitive)
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .single();

    if (error || !user) {
      console.warn(`[LOGIN FAILED] User not found: ${email}`);
      return res.status(401).json({ error: 'Professional account not found.' });
    }

    // Verify password (permanent demo password)
    const DEMO_PASSWORD_RAW = 'Smartdesk@123';
    const isValid = await bcrypt.compare(password, user.password);

    // Safety fallback: If bcrypt fails, check raw if it matches our permanent one
    if (!isValid && password === DEMO_PASSWORD_RAW) {
      console.warn(`[LOGIN RECOVERED] Using master bypass for: ${email}`);
    } else if (!isValid) {
      console.warn(`[LOGIN FAILED] Invalid password for: ${email}`);
      return res.status(401).json({
        error: 'Invalid professional credentials.',
        hint: 'Use the master demo password provided.'
      });
    }

    console.log(`[LOGIN SUCCESS] Demo user: ${email} (${user.role})`);

    // Issue a custom JWT that the backend recognizes
    // We'll use a specific 'demo' claim to distinguish from Supabase JWTs
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        username: user.username,
        is_demo: true
      },
      process.env.JWT_SECRET || 'ticketpro_jwt_secret_key_change_before_deploying_2026',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Professional login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        needsPasswordReset: user.needsPasswordReset
      }
    });

  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Profile Sync (Connects Supabase Auth to Public Profiles)
app.post('/api/user/sync', authenticateToken, async (req, res) => {
  try {
    const { username, role } = req.body;
    const user = req.user;

    // Handle both Supabase user format and Demo user format
    const user_id = user.id;
    const user_email = user.email;
    const user_metadata = user.user_metadata || { username, role };

    let finalRole = role;
    if (!username || !finalRole) {
      return res.status(400).json({ error: 'Username and role are required' });
    }

    // Force non-internal emails to be customers for security
    if (finalRole !== 'customer' && !user_email.toLowerCase().endsWith('@smartdesk.com')) {
      finalRole = 'customer';
    }

    // Check if profile exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single();

    const profileData = {
      id: user_id,
      email: user_email,
      username: username,
      role: finalRole,
      createdAt: user.created_at || new Date().toISOString(),
      needsPasswordReset: false,
      password: 'SYNCED_PROVIDER' // Provide dummy password if NOT NULL constraint exists
    };

    if (existing) {
      const { error } = await supabase.from('users').update(profileData).eq('id', user_id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('users').insert(profileData);
      if (error) throw error;
    }

    res.json({ message: 'Profile synced successfully', user: profileData });
  } catch (error) {
    console.error('[SYNC ERROR]:', error.message || error);
    res.status(500).json({ error: 'Failed to sync professional profile', details: error.message });
  }
});

// Seed Demo Data (Call this once to setup the professional environment)
app.post('/api/demo/seed', async (req, res) => {
  try {
    const demoPassword = await bcrypt.hash('Smartdesk@123', 10);
    const now = new Date().toISOString();

    // 1. Setup Professional Accounts
    const demoUsers = [
      { id: 'admin_1', email: 'admin@smartdesk.com', username: 'HeadAdmin', password: demoPassword, role: 'admin', createdAt: now, needsPasswordReset: false },
      { id: 'agent_1', email: 'agent1@smartdesk.com', username: 'AlexSupport', password: demoPassword, role: 'agent', createdAt: now, needsPasswordReset: false },
      { id: 'agent_2', email: 'agent2@smartdesk.com', username: 'SarahHelp', password: demoPassword, role: 'agent', createdAt: now, needsPasswordReset: false },
      { id: 'agent_3', email: 'agent3@smartdesk.com', username: 'MikeTech', password: demoPassword, role: 'agent', createdAt: now, needsPasswordReset: false }
    ];

    for (const u of demoUsers) {
      // Upsert: Reset to correct password permanently
      await supabase.from('users').upsert(u, { onConflict: 'email' });
    }

    // 2. Setup Demo Tickets
    const demoTickets = [
      { id: 'TKT-101', title: 'Unauthorized Transaction', description: 'I see a charge of $450 that I did not authorize on my card ending in 4242.', accountHolder: 'John Doe', impact: 'High', status: 'Pending', createdBy: 'customer@test.com', assignedTo: 'agent1@smartdesk.com', createdAt: now },
      { id: 'TKT-102', title: 'Login Issue', description: 'Cannot access my professional dashboard. Getting error 403.', accountHolder: 'Jane Smith', impact: 'Medium', status: 'In Progress', createdBy: 'jane@test.com', assignedTo: 'agent2@smartdesk.com', createdAt: now },
      { id: 'TKT-103', title: 'Card Blocked', description: 'My professional card was blocked at an ATM today.', accountHolder: 'Robert Brown', impact: 'High', status: 'Resolved', createdBy: 'rob@test.com', assignedTo: 'agent1@smartdesk.com', createdAt: now }
    ];

    for (const t of demoTickets) {
      const { data: exists } = await supabase.from('tickets').select('id').eq('id', t.id).single();
      if (!exists) {
        // Add SLA dates
        const slaTargets = { Low: 48, Medium: 24, High: 4 }; // hours
        const target = slaTargets[t.impact] || 24;
        t.slaResponseDeadline = new Date(Date.now() + target * 60 * 60 * 1000).toISOString();
        t.slaResolveDeadline = new Date(Date.now() + target * 2 * 60 * 60 * 1000).toISOString();
        await supabase.from('tickets').insert(t);
      }
    }

    res.json({ message: 'Professional environment seeded successfully with demo data.' });
  } catch (err) {
    console.error('Seeding error:', err);
    res.status(500).json({ error: 'Failed to seed demo data' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  PROTECTED ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// Get user by ID
app.get('/api/user/:id', authenticateToken, async (req, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, username, role, "createdAt", "needsPasswordReset"')
    .eq('id', req.params.id)
    .single();

  if (error || !user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Update user password
app.put('/api/user/:id/password', authenticateToken, async (req, res) => {
  const { newPassword, isPasswordReset = false, currentPassword } = req.body;

  // BLOCK password change for demo accounts @smartdesk.com
  if (req.user && req.user.email && req.user.email.endsWith('@smartdesk.com')) {
    return res.status(403).json({ error: 'Demo accounts are locked. Password cannot be changed.' });
  }

  if (!newPassword) return res.status(400).json({ error: 'New password is required' });

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);

  if (isPasswordReset) {
    const { error } = await supabase
      .from('users')
      .update({ password: hashedNewPassword, needsPasswordReset: false })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: 'Failed to update password' });
    return res.json({ message: 'Password updated successfully' });
  }

  // Regular password change — verify current password first
  const { data: user } = await supabase
    .from('users')
    .select('password')
    .eq('id', req.params.id)
    .single();

  if (!user) return res.status(404).json({ error: 'User not found' });

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

  const { error } = await supabase
    .from('users')
    .update({ password: hashedNewPassword, needsPasswordReset: false })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: 'Failed to update password' });
  res.json({ message: 'Password updated successfully' });
});

// ─── ADMIN: Get all tickets with optional search ────────────────────────────────
app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    await checkSlaBreach(); // Ensure status is fresh
    const { searchField, searchValue } = req.query;

    let query = supabase
      .from('tickets')
      .select('*')
      .order('createdAt', { ascending: false });

    if (searchField && searchValue) {
      if (!ALLOWED_SEARCH_FIELDS.includes(searchField)) {
        return res.status(400).json({ error: 'Invalid search field' });
      }
      query = query.ilike(searchField, `%${searchValue}%`);
    }

    const { data: tickets, error } = await query;
    if (error) {
      console.error('Tickets fetch error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Include feedback for each ticket
    const { data: feedbackData } = await supabase.from('feedback').select('*');
    const feedbackMap = {};
    if (feedbackData) feedbackData.forEach(f => { feedbackMap[f.ticketId] = f; });

    const enriched = await enrichTicketsWithNames(tickets);
    const fullyEnriched = enriched.map(t => ({
      ...t,
      feedback: feedbackMap[t.id] || null
    }));

    res.json(fullyEnriched);
  } catch (err) {
    console.error('Error in GET /api/tickets:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: Ticket stats ────────────────────────────────────────────────────────
app.get('/api/tickets/stats', authenticateToken, async (req, res) => {
  await checkSlaBreach(); // Fresh breach check
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('status, slaBreached');

  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(buildStats(tickets));
});

// ─── ADMIN: Assign agent to ticket ─────────────────────────────────────────────
app.put('/api/tickets/:id/assign', authenticateToken, async (req, res) => {
  const ticketId = req.params.id;
  const { agentUsername } = req.body;

  // Get old values for audit trail
  const { data: oldTicket } = await supabase.from('tickets').select('assignedTo, status').eq('id', ticketId).single();
  const oldAgent = oldTicket?.assignedTo || 'Unassigned';
  const oldStatus = oldTicket?.status || 'Pending';
  const newStatus = agentUsername ? 'In Progress' : 'Pending';

  const { error } = await supabase
    .from('tickets')
    .update({
      assignedTo: agentUsername || null,
      status: newStatus
    })
    .eq('id', ticketId);

  if (error) {
    console.error('[ASSIGN ERROR]:', error);
    return res.status(500).json({ error: 'Failed to assign ticket' });
  }

  // Log activity
  await logActivity(ticketId, 'agent_assigned', req.user.username || req.user.email, 'admin', oldAgent, agentUsername || 'Unassigned', `Ticket assigned to ${agentUsername || 'nobody'}`);
  if (oldStatus !== newStatus) {
    await logActivity(ticketId, 'status_changed', req.user.username || req.user.email, 'admin', oldStatus, newStatus, `Status changed from ${oldStatus} to ${newStatus}`);
  }
  // Send Email Notification to Customer & Agent
  const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ticketId).single();
  if (ticket) {
    if (ticket.createdBy) {
      sendTicketEmail(ticket.createdBy, 'Ticket Assigned', `Your ticket #${ticketId} has been assigned.`, `Agent <b>${agentUsername}</b> is now working on your ticket.`, ticketId);
    }
    if (agentUsername) {
      const { data: agent } = await supabase.from('users').select('email').eq('username', agentUsername).single();
      if (agent) {
        sendTicketEmail(agent.email, 'New Ticket Assigned', `You have been assigned to ticket #${ticketId}.`, `Please review <b>#${ticketId}</b>: ${ticket.title}`, ticketId);
      }
    }
  }

  res.json({ message: 'Ticket assigned successfully' });
});

// ─── ADMIN: Delete ticket ───────────────────────────────────────────────────────
app.delete('/api/tickets/:id', authenticateToken, async (req, res) => {
  const { error } = await supabase.from('tickets').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Failed to delete ticket' });
  res.json({ message: 'Ticket deleted successfully' });
});

// ─── ADMIN/AGENT: Get all users ─────────────────────────────────────────────────
app.get('/api/users', authenticateToken, async (req, res) => {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, username, role, "createdAt", "needsPasswordReset"')
    .order('role');

  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(users);
});

// ─── ADMIN: Create new user ─────────────────────────────────────────────────────
app.post('/api/users', authenticateToken, async (req, res) => {
  const { username, email, role } = req.body;
  if (!username || !email || !role) return res.status(400).json({ error: 'All fields are required' });

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .or(`email.eq.${email},username.eq.${username}`)
    .single();

  if (existing) return res.status(400).json({ error: 'Username or email already exists' });

  const hashedPassword = await bcrypt.hash('Smartdesk@123', 10);
  const newUser = {
    id: 'user_' + Date.now(),
    email,
    username,
    password: hashedPassword,
    role,
    createdAt: new Date().toISOString(),
    needsPasswordReset: true
  };

  const { error } = await supabase.from('users').insert(newUser);
  if (error) return res.status(500).json({ error: 'Failed to create user' });

  res.json({
    message: 'User created successfully',
    user: { id: newUser.id, email, username, role, createdAt: newUser.createdAt, needsPasswordReset: true }
  });
});

// ─── ADMIN: Delete user ─────────────────────────────────────────────────────────
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  // Only admins can delete others. Anyone can delete themselves.
  const { data: targetUser } = await supabase.from('users').select('email').eq('id', req.params.id).single();

  if (targetUser && targetUser.email !== req.user.email && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Permission denied: Restricted to Admins or Account Owner.' });
  }

  const { error } = await supabase.from('users').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Failed to delete user' });
  res.json({ message: 'User deleted successfully' });
});

// Notification endpoints removed


// ─── AGENT: Stats ──────────────────────────────────────────────────────────────
app.get('/api/agent/stats', authenticateToken, async (req, res) => {
  const { agentUsername } = req.query;

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('status')
    .eq('assignedTo', agentUsername);

  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(buildStats(tickets));
});

// ─── AGENT: Get tickets ─────────────────────────────────────────────────────────
app.get('/api/agent/tickets', authenticateToken, async (req, res) => {
  const { agentUsername, status, search } = req.query;

  let query = supabase
    .from('tickets')
    .select('*')
    .eq('assignedTo', agentUsername)
    .order('createdAt', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,accountHolder.ilike.%${search}%,id.ilike.%${search}%,description.ilike.%${search}%`
    );
  }

  const { data: tickets, error } = await query;
  if (error) {
    console.error('Agent tickets error:', error);
    return res.status(500).json({ error: 'Database error' });
  }

  const enriched = await enrichTicketsWithNames(tickets);
  res.json(enriched);
});

// ─── AGENT: Update ticket status ───────────────────────────────────────────────
app.put('/api/tickets/:id/status', authenticateToken, async (req, res) => {
  const ticketId = req.params.id;
  const { status, agentUsername } = req.body;

  // Get old status for audit trail
  const { data: oldTicket } = await supabase.from('tickets').select('status').eq('id', ticketId).single();
  const oldStatus = oldTicket?.status || 'Unknown';

  // Build update object
  const updateData = { status };
  if (status === 'Resolved') {
    updateData.resolvedAt = new Date().toISOString();
  }

  // Agents can update status. Admins can TOO. 
  // If role is admin, we skip the assignedTo check.
  let query = supabase.from('tickets').update(updateData).eq('id', ticketId);

  if (req.user.role !== 'admin') {
    query = query.eq('assignedTo', agentUsername);
  }

  const { data: updated, error } = await query.select();

  if (error) {
    console.error('[UPDATE STATUS ERROR]:', error);
    return res.status(500).json({ error: 'Failed to update ticket status' });
  }
  if (!updated || updated.length === 0) {
    console.warn(`[UPDATE STATUS FAILED] Ticket ${ticketId} not found or mismatch for agent ${agentUsername}`);
    return res.status(404).json({ error: 'Ticket not found or not assigned to you' });
  }

  // Log activity
  await logActivity(ticketId, 'status_changed', agentUsername, 'agent', oldStatus, status, `Status changed from ${oldStatus} to ${status}`);

  // Notify Customer via Email
  const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ticketId).single();
  if (ticket && ticket.createdBy) {
    sendTicketEmail(ticket.createdBy, 'Ticket Status Updated', `Status of #${ticketId} changed to ${status}.`, `Your ticket is now <b>${status}</b>.`, ticketId);
  }

  res.json({ message: 'Ticket status updated successfully' });
});

// ─── AGENT/CUSTOMER: Post feedback for resolved ticket ─────────────────────────
app.post('/api/tickets/:id/feedback', authenticateToken, async (req, res) => {
  const ticketId = req.params.id;
  const { rating, comment, customerEmail } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Valid rating (1-5) is required' });
  }

  // 1. Verify ticket is resolved and belongs to customer
  const { data: ticket } = await supabase
    .from('tickets')
    .select('status, createdBy')
    .eq('id', ticketId)
    .single();

  if (!ticket || ticket.status !== 'Resolved') {
    return res.status(400).json({ error: 'Feedback can only be provided for resolved tickets' });
  }

  // 2. Clear to insert feedback
  const { data, error } = await supabase
    .from('feedback')
    .insert({
      ticketId,
      customerEmail,
      customerName: req.user.username || 'Customer', // Fix: Added missing required column
      rating,
      comment: comment || '',
      createdAt: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Feedback already provided for this ticket' });
    return res.status(500).json({ error: 'Failed to save feedback' });
  }

  // 3. Log activity
  await logActivity(ticketId, 'feedback_submitted', customerEmail, 'customer', null, rating.toString(), `Customer provided rating: ${rating}/5`);

  res.json({ message: 'Feedback submitted successfully', feedback: data });
});
app.get('/api/customer/stats', authenticateToken, async (req, res) => {
  const { customerEmail } = req.query;

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('status')
    .eq('createdBy', customerEmail);

  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(buildStats(tickets));
});

// ─── CUSTOMER: Get tickets ──────────────────────────────────────────────────────
app.get('/api/customer/tickets', authenticateToken, async (req, res) => {
  const { customerEmail } = req.query;

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('createdBy', customerEmail)
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('Customer tickets error:', error);
    return res.status(500).json({ error: 'Database error' });
  }

  const enriched = await enrichTicketsWithNames(tickets);
  res.json(enriched);
});

// ─── AI: Analyze Ticket Context (Feature 9, 10, 13) ──────────────────────────────
app.post('/api/ai/analyze-issue', authenticateToken, async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required for analysis' });
  }

  try {
    const prompt = `
      Analyze the following IT support ticket:
      Title: "${title}"
      Description: "${description}"

      Provide a JSON object with:
      1. "impact": (Suggest one of: "High", "Medium", "Low")
      2. "sentiment": (Suggest one of: "Positive", "Neutral", "Negative")
      3. "tags": (Suggest 2-3 short relevant tags like "Security", "Hardware", "Billing")
      4. "reason": (Short single-sentence explanation for the impact choice)

      Return ONLY the JSON. No preamble.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an intelligent support system assistant. Your output must be valid JSON.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1, // Low temperature for consistent output
    });

    const aiResponseContent = chatCompletion.choices[0]?.message?.content || "";

    // Robust JSON extraction (removes preamble/markdown)
    const jsonMatch = aiResponseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response:', aiResponseContent);
      throw new Error('AI failed to return valid data structure.');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    res.json(analysis);

  } catch (error) {
    console.error('AI Analysis Error:', error);
    res.status(500).json({ error: 'AI analysis failed', details: error.message });
  }
});

// ─── AI: Draft Response (Feature 12) ──────────────────────────────────────────
app.post('/api/ai/draft-response', authenticateToken, async (req, res) => {
  const { ticketId, customerMessage } = req.body;

  if (!ticketId || !customerMessage) {
    return res.status(400).json({ error: 'Ticket ID and customer message are required' });
  }

  try {
    // 1. Fetch ticket for context
    const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ticketId).single();
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // 2. Draft Response using Groq
    const prompt = `
      You are an expert IT Support Agent for a banking company called SmartDesk.
      Analyze the following ticket and the customer's latest message to draft a professional response.

      Ticket Title: "${ticket.title}"
      Ticket Description: "${ticket.description}"
      Impact Level: "${ticket.impact}"
      
      Customer Message: "${customerMessage}"

      Instructions:
      - Be polite, empathetic, and professional.
      - If it's a security/access issue, mention you've prioritized it.
      - Keep it under 100 words.
      - Don't sign off as anyone specific, just end with "Best regards, SmartDesk Support Team".

      Draft the perfect reply.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a professional support agent writer.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
    });

    const draft = chatCompletion.choices[0]?.message?.content;
    res.json({ draft });

  } catch (error) {
    console.error('AI Draft Error:', error);
    res.status(500).json({ error: 'AI drafting failed' });
  }
});
async function routeTicketToAgent(ticketId) {
  try {
    // 1. Fetch available agents
    const { data: agents, error } = await supabase
      .from('users')
      .select('username, email')
      .eq('role', 'agent');

    if (error || !agents || agents.length === 0) return null;

    // 2. Fetch workload (In Progress/Pending tickets)
    const { data: activeTickets } = await supabase
      .from('tickets')
      .select('assignedTo')
      .in('status', ['Pending', 'In Progress']);

    const workloadMap = {};
    agents.forEach(a => workloadMap[a.username] = 0);

    if (activeTickets) {
      activeTickets.forEach(t => {
        if (t.assignedTo && workloadMap[t.assignedTo] !== undefined) {
          workloadMap[t.assignedTo]++;
        }
      });
    }

    // 3. Find agent with lowest workload
    const sortedAgents = agents.sort((a, b) => workloadMap[a.username] - workloadMap[b.username]);
    const bestAgent = sortedAgents[0].username;

    // 4. Update Ticket
    await supabase.from('tickets').update({ assignedTo: bestAgent, status: 'In Progress' }).eq('id', ticketId);

    // In-app notifications removed


    // 6. Log activity
    await logActivity(ticketId, 'agent_assigned', 'AI SYSTEM', 'system', null, bestAgent, `Intelligent Routing: Assigned to ${bestAgent} who has the lowest workload.`);

    return bestAgent;

  } catch (err) {
    console.error('Intelligent Routing Error:', err);
    return null;
  }
}

// ─── EMAIL: Send Notification (Feature 14) ───────────────────────────────────
async function sendTicketEmail(to, subject, title, msg, ticketId) {
  if (!to) return;

  const isDevMode = !process.env.SMTP_USER || process.env.SMTP_USER === 'your_email@example.com';
  if (isDevMode) {
    console.log(`\n📧 [DEV EMAIL SIMULATION] To: ${to}\n📝 Subject: SmartDesk: ${subject} [#${ticketId}]\n📄 Content: ${msg}\n`);
    return;
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 10px; overflow: hidden;">
      <div style="background: #2ECC71; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">SmartDesk Update</h2>
      </div>
      <div style="padding: 20px; color: #333333; line-height: 1.6;">
        <p><strong>Ticket ID: #${ticketId}</strong></p>
        <h3 style="color: #2ECC71;">${title}</h3>
        <p>${msg}</p>
        <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #777777;">
          This is an automated notification. Please log in to the portal to reply.
        </p>
      </div>
      <div style="background: #f9f9f9; padding: 15px; text-align: center; border-top: 1px solid #e1e1e1;">
        <p style="margin: 0; font-size: 12px; color: #999999;">&copy; 2026 SmartDesk Support Systems</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"SmartDesk Support" <support@smartdesk.com>',
      to,
      subject: `SmartDesk: ${subject} [#${ticketId}]`,
      html
    });
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error('Email sending failed:', err.message);
  }
}

// ─── CUSTOMER: Create ticket ────────────────────────────────────────────────────
app.post('/api/tickets', authenticateToken, async (req, res) => {
  const {
    title, description, impact, accountHolder,
    accountNumber, ifscCode, createdBy, aiData
  } = req.body;

  if (!title || !description || !impact || !accountHolder || !accountNumber || !ifscCode || !createdBy) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const now = new Date();
  const slaTargets = SLA_CONFIG[impact] || SLA_CONFIG['Medium'];

  const newTicket = {
    id: 'TCKT-' + Date.now(),
    title,
    description,
    impact,
    accountHolder,
    accountNumber,
    ifscCode,
    status: 'Pending',
    createdBy,
    createdAt: now.toISOString(),
    assignedTo: null,
    // AI Data (Feature 9, 10, 13)
    sentiment: aiData ? (aiData.sentiment === 'Positive' ? 'satisfied' : aiData.sentiment === 'Negative' ? 'frustrated' : 'neutral') : 'neutral',
    // ai_reason: aiData ? aiData.reason : null, // Skipping until column is confirmed added
    aiSuggestedImpact: aiData ? aiData.impact : null,
    aiSuggestedCategory: aiData && aiData.tags ? aiData.tags.join(', ') : null
  };

  console.log('Inserting Ticket:', newTicket.id);
  const { error } = await supabase.from('tickets').insert(newTicket);
  if (error) {
    console.error('CREATE TICKET DATABASE ERROR:', error);
    return res.status(500).json({ error: 'Database creation failed: ' + error.message });
  }

  // In-app notifications removed


  // Intelligent Routing: Assign to agent automatically (Feature 11)
  const routedAgent = await routeTicketToAgent(newTicket.id);
  if (routedAgent) {
    newTicket.assignedTo = routedAgent;
    newTicket.status = 'In Progress';
  }

  // Email Notification (Feature 14)
  sendTicketEmail(createdBy, 'Ticket Created', 'Your support ticket has been received!', `We've successfully opened ticket <b>#${newTicket.id}</b>. It has been assigned to a support agent and is currently <b>In Progress</b>.`, newTicket.id);

  res.json({ message: 'Ticket created successfully!', ticket: newTicket });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FEATURE 3: FILE ATTACHMENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Upload attachment for a ticket or comment
app.post('/api/tickets/:id/attachments', authenticateToken, upload.single('file'), async (req, res) => {
  const ticketId = req.params.id;
  const { userId, userRole, userName, commentId } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file provided' });

  const fileExt = path.extname(file.originalname);
  const fileName = `${Date.now()}_${file.originalname}`;
  const filePath = `${ticketId}/${fileName}`;

  // 1. Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('ticket-attachments')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    return res.status(500).json({ error: 'Failed to upload to storage' });
  }

  // 2. Get Public URL
  const { data: { publicUrl } } = supabase.storage
    .from('ticket-attachments')
    .getPublicUrl(filePath);

  // 3. Save to database
  const attachment = {
    ticketId,
    commentId: commentId || null,
    fileName: file.originalname,
    fileUrl: publicUrl,
    fileSize: file.size,
    fileType: file.mimetype,
    uploadedBy: userName,
    createdAt: new Date().toISOString()
  };

  const { data: dbData, error: dbError } = await supabase
    .from('attachments')
    .insert(attachment)
    .select()
    .single();

  if (dbError) {
    console.error('Database insert error:', dbError);
    return res.status(500).json({ error: 'Failed to save attachment metadata' });
  }

  // 4. Log activity
  await logActivity(ticketId, 'file_attached', userName, userRole, null, file.originalname, `Attached file: ${file.originalname}`);

  res.json({ message: 'File uploaded successfully', attachment: dbData });
});

// Update GET detailed ticket to include attachments
app.get('/api/tickets/:id/detail', authenticateToken, async (req, res) => {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !ticket) return res.status(404).json({ error: 'Ticket not found' });

  // Get attachments
  const { data: attachments } = await supabase
    .from('attachments')
    .select('*')
    .eq('ticketId', req.params.id);

  // Get feedback
  const { data: feedback } = await supabase
    .from('feedback')
    .select('*')
    .eq('ticketId', req.params.id)
    .single();

  // Enrich with user names
  const { data: users } = await supabase.from('users').select('email, username');
  const userMap = {};
  if (users) users.forEach(u => { userMap[u.email] = u.username; });

  ticket.createdByName = userMap[ticket.createdBy] || ticket.createdBy;
  ticket.assignedToName = userMap[ticket.assignedTo] || ticket.assignedTo;
  ticket.attachments = attachments || [];
  ticket.feedback = feedback || null;

  // ✅ Fix: Calculate SLA deadlines if missing from DB (resolves NaNm error)
  if (!ticket.slaResponseDeadline || !ticket.slaResolveDeadline) {
    const slaTargets = SLA_CONFIG[ticket.impact] || SLA_CONFIG['Medium'];
    const createdDate = new Date(ticket.createdAt);
    if (!ticket.slaResponseDeadline) {
      ticket.slaResponseDeadline = new Date(createdDate.getTime() + slaTargets.response).toISOString();
    }
    if (!ticket.slaResolveDeadline) {
      ticket.slaResolveDeadline = new Date(createdDate.getTime() + slaTargets.resolve).toISOString();
    }
  }

  res.json(ticket);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FEATURE 1: TICKET COMMENTS / CONVERSATION THREAD
// ═══════════════════════════════════════════════════════════════════════════════

// Get all comments for a ticket
app.get('/api/tickets/:id/comments', authenticateToken, async (req, res) => {
  const { data: comments, error } = await supabase
    .from('ticket_comments')
    .select('*')
    .eq('ticketId', req.params.id)
    .order('createdAt', { ascending: true });

  if (error) return res.status(500).json({ error: 'Failed to fetch comments' });
  res.json(comments || []);
});

// Add a comment to a ticket
app.post('/api/tickets/:id/comments', authenticateToken, async (req, res) => {
  const ticketId = req.params.id;
  const { message, userId, userRole, userName } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const comment = {
    ticketId,
    userId,
    userRole,
    userName,
    message: message.trim(),
    isAiDraft: false,
    createdAt: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('ticket_comments')
    .insert(comment)
    .select()
    .single();

  if (error) {
    console.error('Comment insert error:', error);
    return res.status(500).json({ error: 'Failed to add comment' });
  }

  // Log activity
  await logActivity(ticketId, 'comment_added', userName, userRole, null, null, `Comment added by ${userName}`);

  // If this is the first agent/admin response, set firstResponseAt (for SLA tracking)
  if (userRole === 'agent' || userRole === 'admin') {
    const { data: ticket } = await supabase.from('tickets').select('firstResponseAt').eq('id', ticketId).single();
    if (ticket && !ticket.firstResponseAt) {
      await supabase.from('tickets').update({ firstResponseAt: new Date().toISOString() }).eq('id', ticketId);
    }
  }

  const { data: ticketMetadata } = await supabase.from('tickets').select('createdBy, assignedTo, title').eq('id', ticketId).single();
  if (ticketMetadata) {
    if (userRole === 'customer') {
      if (ticketMetadata.assignedTo) {
        const { data: agentUser } = await supabase.from('users').select('email').eq('username', ticketMetadata.assignedTo).single();
        if (agentUser) {
          sendTicketEmail(agentUser.email, 'New Reply Received', `The customer has replied to ticket #${ticketId}.`, `<b>${userName}:</b> ${message.trim()}`, ticketId);
        }
      }
    } else {
      sendTicketEmail(ticketMetadata.createdBy, 'New Support Reply', `An agent has replied to your ticket #${ticketId}.`, `<b>Support:</b> ${message.trim()}`, ticketId);
    }
  }

  res.json({ message: 'Comment added successfully', comment: data });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FEATURE 2: TICKET ACTIVITY HISTORY / AUDIT TRAIL
// ═══════════════════════════════════════════════════════════════════════════════

// Get activity history for a ticket
app.get('/api/tickets/:id/activity', authenticateToken, async (req, res) => {
  const { data: activity, error } = await supabase
    .from('ticket_activity')
    .select('*')
    .eq('ticketId', req.params.id)
    .order('createdAt', { ascending: true });

  if (error) return res.status(500).json({ error: 'Failed to fetch activity' });
  res.json(activity || []);
});

// ─── Error Handling & Start Server ──────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

// Start Server
app.listen(PORT, async () => {
  console.log(`\n🚀 SmartDesk server running on http://localhost:${PORT}`);
  console.log(`📦 Database: Supabase Connected.`);

  // Warm up connection to refresh schema cache (solves PGRST204)
  const { data, error } = await supabase.from('tickets').select('id').limit(1);
  if (error) {
    console.warn('⚠️ Initial connection check:', error.message);
  } else {
    console.log('✅ Database schema verified.');
  }
});