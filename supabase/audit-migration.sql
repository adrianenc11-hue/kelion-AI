-- ═══ K System Audit — New Tables Migration ═══
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- Created: 2026-02-07 after audit fixes

-- ═══════════════════════════════════════════════
-- 1. BOOKINGS (for booking-system.js)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'rescheduled', 'completed')),
    client_name TEXT,
    client_phone TEXT,
    client_email TEXT,
    service TEXT,
    provider TEXT,
    date DATE,
    time TEXT,
    duration_minutes INT DEFAULT 60,
    end_time TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider);

-- ═══════════════════════════════════════════════
-- 2. INVENTORY (for inventory-tracker.js)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    sku TEXT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    quantity INT DEFAULT 0,
    unit TEXT DEFAULT 'buc',
    price NUMERIC DEFAULT 0,
    min_stock INT DEFAULT 5,
    location TEXT,
    supplier TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES inventory(id) ON DELETE SET NULL,
    product_name TEXT,
    type TEXT CHECK (type IN ('intrare', 'iesire', 'ajustare')),
    quantity_change INT,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_date ON inventory_movements(created_at DESC);

-- ═══════════════════════════════════════════════
-- 3. MESSENGER LOGS (for social-media-stats.js)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS messenger_logs (
    id SERIAL PRIMARY KEY,
    platform TEXT,
    sender_id TEXT,
    message TEXT,
    topic TEXT,
    response_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messenger_logs_platform ON messenger_logs(platform);
CREATE INDEX IF NOT EXISTS idx_messenger_logs_date ON messenger_logs(created_at DESC);

-- ═══════════════════════════════════════════════
-- DONE — Verify tables exist
-- ═══════════════════════════════════════════════
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('bookings', 'inventory', 'inventory_movements', 'messenger_logs')
ORDER BY table_name;
