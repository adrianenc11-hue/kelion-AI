// Run SQL migration using DATABASE_URL directly  
require('dotenv').config();
const { Client } = require('pg');

const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is missing.');
    process.exit(1);
}

const MIGRATION_FILE = path.join(__dirname, 'supabase', 'migrations', 'k1_audit_analytics_full.sql');
const SQL = fs.readFileSync(MIGRATION_FILE, 'utf8');

async function run() {
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        console.log('Connected to Supabase PostgreSQL');
        const result = await client.query(SQL);
        console.log('Migration SUCCESS');
    } catch (e) {
        console.error('Migration ERROR:', e.message);
    } finally {
        await client.end();
    }
}

run();
