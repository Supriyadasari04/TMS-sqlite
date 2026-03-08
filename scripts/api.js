// scripts/api.js
// ─────────────────────────────────────────────────────────────────
//  Centralized API utility — No more custom JWT!
//  Powered by Supabase Auth & Professional Google SMTP
// ─────────────────────────────────────────────────────────────────

// ✅ Supabase Configuration (Public Keys)
const SUPABASE_URL = 'https://ahwhjcahsdlibdjvtjot.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFod2hqY2Foc2RsaWJkanZ0am90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MjQ1NDUsImV4cCI6MjA4NzQwMDU0NX0.twSQBNlOkgJ5suc0XO49-UuGXxMEEk5Xn4XWFV3nvQ0';

// Initialize Supabase Client (CDN version)
let supabaseClient = null;
if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const API_BASE = '';

// ─── Token helpers (Backward Compatibility with existing code) ─────
async function getToken() {
    // 1. Try Supabase session first
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.access_token) {
            setToken(session.access_token); // Keep in sync
            return session.access_token;
        }
    }

    // 2. Fallback to manually stored token (Demo Bypass)
    return localStorage.getItem('authToken');
}

function setToken(token) {
    localStorage.setItem('authToken', token);
}

function removeToken() {
    localStorage.removeItem('authToken');
}

// ─── Authenticated fetch wrapper ──────────────────────────────────
// Automatically attaches Supabase JWT header to every request
async function authFetch(url, options = {}) {
    const token = await getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers,
    });

    // If token is invalid/expired, force logout
    if (response.status === 401 || response.status === 403) {
        const data = await response.json().catch(() => ({}));
        if (data.error && (data.error.includes('expired') || data.error.includes('Access denied'))) {
            handleSessionExpired();
            throw new Error('Session expired. Please sign in again.');
        }
        return new Response(JSON.stringify(data), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }

    return response;
}

// ─── Session helpers ──────────────────────────────────────────────
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('currentUser'));
    } catch {
        return null;
    }
}

function setCurrentUser(user) {
    // Store essential info for the UI
    const safeUser = {
        id: user.id || user.user_id, // Handle Supabase vs custom format
        email: user.email,
        username: user.username || user.user_metadata?.username || user.email.split('@')[0],
        role: user.role || user.user_metadata?.role || 'customer',
        createdAt: user.createdAt || user.created_at,
        needsPasswordReset: user.needsPasswordReset || false
    };
    localStorage.setItem('currentUser', JSON.stringify(safeUser));
}

async function logout() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    removeToken();
    localStorage.removeItem('currentUser');
    window.location.href = '../html/landing.html';
}

async function syncUserProfile(username, role) {
    try {
        const response = await authFetch('/api/user/sync', {
            method: 'POST',
            body: JSON.stringify({ username, role })
        });
        if (!response.ok) throw new Error('Profile synchronization failed');
        const data = await response.json();
        setCurrentUser(data.user);
        return data.user;
    } catch (error) {
        console.error('Sync Error:', error);
        throw error;
    }
}

function handleSessionExpired() {
    removeToken();
    localStorage.removeItem('currentUser');
    alert('Your session has expired. Please sign in again.');
    window.location.href = '../html/signin.html';
}
