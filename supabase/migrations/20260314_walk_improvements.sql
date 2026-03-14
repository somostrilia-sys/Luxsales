-- ============================================================
-- WALK Agente Central Hub — Migration: Improvements
-- Run this in Supabase SQL Editor after review
-- ============================================================

-- 1. Add uazapi_account column to disposable_chips
-- Identifies which UaZapi account (B or C) the chip belongs to
ALTER TABLE disposable_chips
  ADD COLUMN IF NOT EXISTS uazapi_account TEXT DEFAULT 'account_b'
  CHECK (uazapi_account IN ('account_b', 'account_c'));

COMMENT ON COLUMN disposable_chips.uazapi_account IS 'Which UaZapi account: account_b (chips 1-3) or account_c (chips 4-5)';

-- 2. Add direction and chip_id columns to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'inbound'
  CHECK (direction IN ('inbound', 'outbound'));

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS chip_id UUID REFERENCES disposable_chips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_chip_id ON messages(chip_id);

-- 3. Create uazapi_accounts table — Registry of the 3 UaZapi accounts
CREATE TABLE IF NOT EXISTS uazapi_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key TEXT UNIQUE NOT NULL CHECK (account_key IN ('account_a', 'account_b', 'account_c')),
  api_url TEXT NOT NULL,
  admin_token TEXT NOT NULL DEFAULT '',
  description TEXT,
  max_instances INTEGER DEFAULT 300,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default accounts (IMPORTANTE: atualizar admin_token via Supabase dashboard!)
INSERT INTO uazapi_accounts (account_key, api_url, description) VALUES
  ('account_a', 'https://trilhoassist.uazapi.com', 'Conta A (trilhoassist) — Chips fixos dos consultores (142 já existem)'),
  ('account_b', 'https://walk2.uazapi.com', 'Conta B (walk2) — Chips descartáveis 1-3 de cada consultor'),
  ('account_c', 'https://walkholding.uazapi.com', 'Conta C (walkholding) — Chips descartáveis 4-5 de cada consultor')
ON CONFLICT (account_key) DO NOTHING;

-- RLS for uazapi_accounts (only authenticated can read)
ALTER TABLE uazapi_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read uazapi_accounts" ON uazapi_accounts FOR SELECT TO authenticated USING (true);

-- 4. Create blast_config table — Anti-ban configuration per collaborator
CREATE TABLE IF NOT EXISTS blast_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
  intervalo_min_sec INTEGER DEFAULT 30,
  intervalo_max_sec INTEGER DEFAULT 120,
  pausa_padrao_1_min INTEGER DEFAULT 45,
  pausa_padrao_1_offline_min INTEGER DEFAULT 8,
  pausa_padrao_2_min INTEGER DEFAULT 65,
  pausa_padrao_2_offline_min INTEGER DEFAULT 12,
  erro_digitacao_a_cada INTEGER DEFAULT 30,
  horario_inicio TIME DEFAULT '08:00',
  horario_fim TIME DEFAULT '18:00',
  max_msgs_dia_por_chip INTEGER DEFAULT 200,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(collaborator_id)
);

CREATE INDEX IF NOT EXISTS idx_blast_config_collaborator ON blast_config(collaborator_id);

-- RLS for blast_config
ALTER TABLE blast_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage own blast_config" ON blast_config
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Ensure whatsapp_instances table exists (for chip fixo)
-- This table may already exist; CREATE IF NOT EXISTS prevents errors
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  instance_token TEXT,
  phone_number TEXT,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'connecting', 'disconnected', 'banned')),
  qr_code TEXT,
  chip_type TEXT DEFAULT 'fixo' CHECK (chip_type IN ('fixo', 'descartavel')),
  bot_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_collaborator ON whatsapp_instances(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_chip_type ON whatsapp_instances(chip_type);

-- RLS for whatsapp_instances
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage whatsapp_instances" ON whatsapp_instances
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Add banned status to disposable_chips
-- Update the CHECK constraint to include 'banned'
ALTER TABLE disposable_chips DROP CONSTRAINT IF EXISTS disposable_chips_status_check;
ALTER TABLE disposable_chips ADD CONSTRAINT disposable_chips_status_check
  CHECK (status IN ('connected', 'connecting', 'disconnected', 'banned'));

-- 7. Add daily_msg_count and last_reset_at to disposable_chips for per-chip daily tracking
ALTER TABLE disposable_chips
  ADD COLUMN IF NOT EXISTS daily_msg_count INTEGER DEFAULT 0;
ALTER TABLE disposable_chips
  ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE disposable_chips
  ADD COLUMN IF NOT EXISTS created_at_date DATE DEFAULT CURRENT_DATE;

-- 8. Function to reset daily chip counts (call via CRON at midnight BRT)
CREATE OR REPLACE FUNCTION reset_daily_chip_counts()
RETURNS void AS $$
BEGIN
  UPDATE disposable_chips
  SET daily_msg_count = 0, last_reset_at = now(), updated_at = now()
  WHERE daily_msg_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
