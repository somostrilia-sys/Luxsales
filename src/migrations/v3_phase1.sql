-- ============================================================
-- LuxSales V3 — Phase 1 Migrations
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Novos campos em consultant_lead_pool
ALTER TABLE consultant_lead_pool ADD COLUMN IF NOT EXISTS call_attempts INTEGER DEFAULT 0;
ALTER TABLE consultant_lead_pool ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMPTZ;
ALTER TABLE consultant_lead_pool ADD COLUMN IF NOT EXISTS interest_status TEXT DEFAULT 'pending';
-- interest_status: pending | interested | not_interested_1 | not_interested_2 | discarded
ALTER TABLE consultant_lead_pool ADD COLUMN IF NOT EXISTS dispatch_count INTEGER DEFAULT 0;
ALTER TABLE consultant_lead_pool ADD COLUMN IF NOT EXISTS dispatch_available BOOLEAN DEFAULT FALSE;
ALTER TABLE consultant_lead_pool ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

-- 2. Novos campos em call_logs (se existir)
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS lucas_summary TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS interest_detected BOOLEAN;

-- 3. Config de distribuição por empresa (usar system_configs existente como key/value)
-- Não criar tabela nova, usar INSERT com chaves:
-- distribution_batch_size_{companyId} = 5000
-- distribution_threshold_{companyId} = 500
-- meta_tier_daily_{companyId} = 250

-- 4. Criar function para normalizar telefone
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS TEXT AS $$
DECLARE
  cleaned TEXT;
  result TEXT;
BEGIN
  -- Remove tudo que não é número
  cleaned := regexp_replace(phone, '[^0-9]', '', 'g');

  -- Se começa com 55 e tem 12+ dígitos, já tem código país
  IF length(cleaned) >= 12 AND cleaned LIKE '55%' THEN
    result := '+' || cleaned;
  -- Se tem 11 dígitos (DDD + 9 + número), adicionar +55
  ELSIF length(cleaned) = 11 AND substring(cleaned, 3, 1) = '9' THEN
    result := '+55' || cleaned;
  -- Se tem 10 dígitos (DDD + número sem 9), adicionar +55 e 9
  ELSIF length(cleaned) = 10 THEN
    result := '+55' || substring(cleaned, 1, 2) || '9' || substring(cleaned, 3);
  -- Se tem 9 dígitos (só número com 9), precisa DDD — retornar NULL
  ELSIF length(cleaned) = 9 AND cleaned LIKE '9%' THEN
    result := NULL; -- sem DDD, não normalizar
  ELSE
    result := NULL; -- formato inválido
  END IF;

  -- Validar: deve ser celular (+55XX9XXXXXXXX = 14 chars)
  IF result IS NOT NULL AND (length(result) != 14 OR substring(result, 5, 1) != '9') THEN
    result := NULL; -- telefone fixo ou formato errado = descartar
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
