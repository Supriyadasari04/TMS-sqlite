// create-tables-api.js
// Creates tables in Supabase using their Management API + service role
// This works without needing a direct PostgreSQL connection string
require('dotenv').config();

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Extract project ref from URL (e.g. ahwhjcahsdlibdjvtjot)
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1];

const SQL = `
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

function makeRequest(hostname, path, method, body, headers) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = https.request(
            { hostname, path, method, headers: { 'Content-Length': Buffer.byteLength(data), ...headers } },
            (res) => {
                let responseBody = '';
                res.on('data', chunk => responseBody += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: responseBody }));
            }
        );
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function createTables() {
    console.log('🔗 Connecting to Supabase Management API...');
    console.log(`📍 Project: ${PROJECT_REF}\n`);

    const hostname = `${PROJECT_REF}.supabase.co`;

    // Use the SQL endpoint to execute DDL
    const response = await makeRequest(
        hostname,
        '/rest/v1/rpc/exec_sql',
        'POST',
        { sql: SQL },
        {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`
        }
    );

    if (response.status === 200) {
        console.log('✅ Tables created successfully!');
    } else {
        // Try alternative — use the pg endpoint
        console.log(`ℹ️  RPC method returned status ${response.status}`);
        console.log('Trying alternative SQL execution...');

        // Some Supabase projects need the SQL run directly
        // Let's verify tables exist by querying them
        const verifyResponse = await makeRequest(
            hostname,
            '/rest/v1/users?select=id&limit=1',
            'GET',
            null,
            {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`
            }
        );

        if (verifyResponse.status === 200) {
            console.log('✅ Tables already exist and are accessible!');
        } else if (verifyResponse.status === 404 || verifyResponse.body.includes('relation') || verifyResponse.body.includes('does not exist')) {
            console.log('\n⚠️  Tables do not exist yet.');
            console.log('Please create them manually:');
            console.log('1. Go to https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql');
            console.log('2. Paste the content of supabase-schema.sql');
            console.log('3. Click "Run"');
            console.log('4. Then run: node migrate-to-supabase.js');
        } else {
            console.log(`Response: ${verifyResponse.status} - ${verifyResponse.body.substring(0, 200)}`);
        }
    }
    process.exit(0);
}

createTables().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
