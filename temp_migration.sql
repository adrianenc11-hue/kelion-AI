CREATE TABLE IF NOT EXISTS bot_daily_reports (
    id BIGSERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    market TEXT NOT NULL DEFAULT 'US_STOCKS',
    mode TEXT DEFAULT 'paper',
    total_pnl TEXT,
    total_trades INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    win_rate TEXT,
    equity TEXT,
    buying_power TEXT,
    symbols_traded JSONB DEFAULT '[]',
    per_symbol JSONB DEFAULT '{}',
    positions_closed INT DEFAULT 0,
    observations TEXT,
    recommendations TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(report_date, market)
);
ALTER TABLE bot_daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON bot_daily_reports FOR ALL USING (true) WITH CHECK (true);
