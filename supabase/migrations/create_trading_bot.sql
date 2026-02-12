-- ═══════════════════════════════════════════════════════════
-- TRADING BOT — Supabase Tables
-- Memory, learning, signals, trade log, config
-- ═══════════════════════════════════════════════════════════

-- 1. BOT CONFIG — Settings & state
CREATE TABLE IF NOT EXISTS bot_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default config
INSERT INTO bot_config (key, value) VALUES
    ('bot_enabled', '{"enabled": false, "mode": "paper", "reason": "Initial setup"}'::jsonb),
    ('risk_settings', '{"max_position_pct": 5, "max_portfolio_risk_pct": 15, "trailing_stop_pct": 3, "stop_loss_pct": 5, "take_profit_pct": 10, "max_daily_trades": 10, "min_confidence": 65}'::jsonb),
    ('watchlist', '{"symbols": ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD"], "crypto": ["bitcoin", "ethereum"]}'::jsonb),
    ('strategies', '{"rsi_oversold": true, "macd_crossover": true, "ema_crossover": true, "bollinger_squeeze": true, "volume_breakout": true, "ai_analysis": true}'::jsonb),
    ('weights', '{"rsi": 20, "macd": 20, "ema": 15, "bollinger": 15, "volume": 10, "ai": 20}'::jsonb),
    ('schedule', '{"interval_minutes": 5, "market_hours_only": true, "timezone": "America/New_York"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. BOT TRADE LOG — every executed trade
CREATE TABLE IF NOT EXISTS bot_trade_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    qty NUMERIC NOT NULL,
    entry_price NUMERIC,
    exit_price NUMERIC,
    pnl NUMERIC,
    pnl_pct NUMERIC,
    order_id TEXT,
    strategy TEXT,
    signals_used JSONB DEFAULT '{}',
    confidence NUMERIC,
    ai_reasoning TEXT,
    classic_signals JSONB DEFAULT '{}',
    ai_signals JSONB DEFAULT '{}',
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled', 'error')),
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    duration_minutes NUMERIC,
    market_conditions JSONB DEFAULT '{}',
    lesson_learned TEXT
);

CREATE INDEX IF NOT EXISTS idx_trade_log_symbol ON bot_trade_log(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_log_status ON bot_trade_log(status);
CREATE INDEX IF NOT EXISTS idx_trade_log_opened ON bot_trade_log(opened_at DESC);

-- 3. BOT SIGNALS — every signal generated (for accuracy tracking)
CREATE TABLE IF NOT EXISTS bot_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol TEXT NOT NULL,
    signal_type TEXT NOT NULL, -- 'buy', 'sell', 'hold'
    source TEXT NOT NULL,      -- 'rsi', 'macd', 'ema', 'bollinger', 'volume', 'ai', 'combined'
    confidence NUMERIC,
    data JSONB DEFAULT '{}',   -- indicator values, AI reasoning
    price_at_signal NUMERIC,
    price_after_1h NUMERIC,
    price_after_24h NUMERIC,
    was_correct BOOLEAN,       -- filled after outcome known
    acted_on BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_symbol ON bot_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_source ON bot_signals(source);
CREATE INDEX IF NOT EXISTS idx_signals_created ON bot_signals(created_at DESC);

-- 4. BOT PATTERNS — learned patterns (memory/learning)
CREATE TABLE IF NOT EXISTS bot_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pattern_type TEXT NOT NULL,  -- 'strategy_performance', 'time_performance', 'symbol_affinity', 'signal_accuracy'
    symbol TEXT,
    strategy TEXT,
    data JSONB NOT NULL DEFAULT '{}',
    -- Aggregated stats
    total_trades INTEGER DEFAULT 0,
    win_rate NUMERIC DEFAULT 0,
    avg_profit_pct NUMERIC DEFAULT 0,
    avg_loss_pct NUMERIC DEFAULT 0,
    sharpe_ratio NUMERIC DEFAULT 0,
    max_drawdown_pct NUMERIC DEFAULT 0,
    best_time_of_day TEXT,
    -- Learning
    weight_adjustment NUMERIC DEFAULT 0,  -- how much to adjust this strategy's weight
    confidence_level NUMERIC DEFAULT 50,
    last_updated TIMESTAMPTZ DEFAULT now(),
    UNIQUE(pattern_type, symbol, strategy)
);

CREATE INDEX IF NOT EXISTS idx_patterns_type ON bot_patterns(pattern_type);

-- 5. BOT RUNS — cron execution log
CREATE TABLE IF NOT EXISTS bot_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    started_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error', 'skipped')),
    symbols_checked INTEGER DEFAULT 0,
    signals_generated INTEGER DEFAULT 0,
    trades_executed INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    summary TEXT,
    market_status TEXT -- 'open', 'closed', 'pre-market', 'after-hours'
);

CREATE INDEX IF NOT EXISTS idx_runs_started ON bot_runs(started_at DESC);

-- 6. BOT LEARNING LOG — auto-learning session records
CREATE TABLE IF NOT EXISTS bot_learning_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trades_analyzed INTEGER DEFAULT 0,
    adjustments JSONB DEFAULT '[]',
    analysis JSONB DEFAULT '{}',
    patterns_saved INTEGER DEFAULT 0,
    learned_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_log_learned ON bot_learning_log(learned_at DESC);

-- ═══ RLS Policies ═══
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_trade_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_runs ENABLE ROW LEVEL SECURITY;

-- Service role has full access (bot runs as service)
CREATE POLICY "Service full access" ON bot_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full access" ON bot_trade_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full access" ON bot_signals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full access" ON bot_patterns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full access" ON bot_runs FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE bot_learning_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service full access" ON bot_learning_log FOR ALL USING (true) WITH CHECK (true);
