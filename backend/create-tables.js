// create-tables.js — Creates all Supabase tables directly via PostgreSQL connection
// Run once: node create-tables.js
require('dotenv').config();
const { Client } = require('pg');

// Supabase connection string format
// Find yours at: Supabase Dashboard → Settings → Database → Connection String → URI
// It looks like: postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres
const DB_PASSWORD = encodeURIComponent('Supriya@3012');
const PROJECT_REF = 'ahwhjcahsdlibdjvtjot';
const CONNECTION_STRING = `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;

const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });

async function createTables() {
    try {
        await client.connect();
        console.log('✅ Connected to Supabase PostgreSQL\n');

        const schema = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'agent', 'customer')),
        "createdAt" TEXT,
        "needsPasswordReset" BOOLEAN DEFAULT FALSE
      );

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

      CREATE TABLE IF NOT EXISTS notifications (
        id BIGSERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        role TEXT,
        email TEXT,
        timestamp TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE
      );

      ALTER TABLE users DISABLE ROW LEVEL SECURITY;
      ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
      ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
    `;

        await client.query(schema);
        console.log('✅ All tables created successfully!');
        console.log('   - users');
        console.log('   - tickets');
        console.log('   - notifications');
        console.log('\nNext: run  node migrate-to-supabase.js  to import your data');

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.log('\nIf connection failed, try these steps:');
        console.log('1. Go to Supabase Dashboard → SQL Editor');
        console.log('2. Paste the contents of supabase-schema.sql');
        console.log('3. Click Run');
    } finally {
        await client.end();
        process.exit(0);
    }
}

createTables();
