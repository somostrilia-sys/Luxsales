-- wa_templates: rascunhos de templates gerados por IA, antes de submeter à Meta
CREATE TABLE IF NOT EXISTS wa_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'MARKETING',
  language TEXT NOT NULL DEFAULT 'pt_BR',
  body TEXT,
  header TEXT,
  footer TEXT,
  buttons JSONB DEFAULT '[]',
  strategy_notes TEXT,
  confidence_score INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_company_status ON wa_templates(company_id, status);

-- RLS
ALTER TABLE wa_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_templates_tenant ON wa_templates
  USING (company_id IN (
    SELECT company_id FROM collaborators WHERE auth_user_id = auth.uid()
  ));

-- Typing indicator em wa_conversations
ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS is_typing BOOLEAN DEFAULT FALSE;
ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS typing_updated_at TIMESTAMPTZ;
