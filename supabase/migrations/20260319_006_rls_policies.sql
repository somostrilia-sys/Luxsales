-- ============================================================
-- FASE 6: RLS POLICIES - ISOLAMENTO MULTI-TENANT
-- Pre-requisitos: Todas as fases anteriores
-- ============================================================

BEGIN;

-- ============================================================
-- NOVAS TABELAS (criadas nas fases 1-5)
-- ============================================================

-- audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (true); -- sistema pode inserir para qualquer company

-- billing_usage
ALTER TABLE billing_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_usage_tenant ON billing_usage
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_phone_numbers
ALTER TABLE whatsapp_meta_phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_phone_numbers_tenant ON whatsapp_meta_phone_numbers
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_templates
ALTER TABLE whatsapp_meta_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_templates_tenant ON whatsapp_meta_templates
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_opt_ins
ALTER TABLE whatsapp_meta_opt_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_opt_ins_tenant ON whatsapp_meta_opt_ins
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_webhook_events
ALTER TABLE whatsapp_meta_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_webhook_select ON whatsapp_meta_webhook_events FOR SELECT
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);
CREATE POLICY wa_webhook_insert ON whatsapp_meta_webhook_events FOR INSERT
  WITH CHECK (true); -- webhooks podem chegar sem company_id resolvido

-- whatsapp_meta_conversations_billing
ALTER TABLE whatsapp_meta_conversations_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_billing_tenant ON whatsapp_meta_conversations_billing
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_rate_limits
ALTER TABLE whatsapp_meta_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_rate_limits_tenant ON whatsapp_meta_rate_limits
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- whatsapp_meta_quality_signals
ALTER TABLE whatsapp_meta_quality_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_quality_signals_tenant ON whatsapp_meta_quality_signals
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- sip_trunks
ALTER TABLE sip_trunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY sip_trunks_tenant ON sip_trunks
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- sip_extensions
ALTER TABLE sip_extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sip_extensions_tenant ON sip_extensions
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- call_recordings
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_recordings_tenant ON call_recordings
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- call_quality_metrics
ALTER TABLE call_quality_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_quality_tenant ON call_quality_metrics
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ivr_menus
ALTER TABLE ivr_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY ivr_menus_tenant ON ivr_menus
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- call_transfers
ALTER TABLE call_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_transfers_tenant ON call_transfers
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- pbx_config
ALTER TABLE pbx_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY pbx_config_tenant ON pbx_config
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ai_call_scripts
ALTER TABLE ai_call_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_scripts_tenant ON ai_call_scripts
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ai_call_training
ALTER TABLE ai_call_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_training_tenant ON ai_call_training
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ai_voice_clones
ALTER TABLE ai_voice_clones ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_voice_clones_tenant ON ai_voice_clones
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ai_call_analytics
ALTER TABLE ai_call_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_analytics_tenant ON ai_call_analytics
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ai_call_compliance
ALTER TABLE ai_call_compliance ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_compliance_own ON ai_call_compliance FOR SELECT
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);
CREATE POLICY ai_compliance_insert ON ai_call_compliance FOR INSERT
  WITH CHECK (company_id = (auth.jwt() ->> 'company_id')::UUID);
-- DNC lookup cross-company via function fn_check_dnc (SECURITY DEFINER)

-- omnichannel_conversations
ALTER TABLE omnichannel_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY omni_conv_tenant ON omnichannel_conversations
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- channel_routing
ALTER TABLE channel_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY channel_routing_tenant ON channel_routing
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- omnichannel_messages
ALTER TABLE omnichannel_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY omni_msgs_tenant ON omnichannel_messages
  USING (company_id = (auth.jwt() ->> 'company_id')::UUID);

-- ============================================================
-- TABELAS EXISTENTES - habilitar RLS se ainda nao ativo
-- (usar DO block para evitar erro se RLS ja estiver ativo)
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tables_with_company_id TEXT[] := ARRAY[
    'companies', 'collaborators', 'roles', 'sectors', 'units',
    'agent_definitions', 'agent_conversations', 'agent_messages',
    'agents', 'calls', 'campaigns', 'dial_queue', 'daily_metrics',
    'call_campaigns', 'call_logs',
    'bot_instances', 'bot_messages',
    'whatsapp_meta_credentials', 'whatsapp_meta_messages',
    'whatsapp_conversations', 'whatsapp_messages', 'whatsapp_instances',
    'whatsapp_bot_conversations',
    'leads', 'contact_leads', 'lead_items', 'lead_batches', 'lead_distributions',
    'conversations', 'messages',
    'blast_config', 'blast_jobs', 'blast_logs', 'blasted_phones',
    'disposable_chips',
    'collaborator_agent_access', 'collaborator_metrics', 'role_agent_access',
    'consultant_lead_pool',
    'invite_links',
    'carousel_creations',
    'video_edits',
    'extraction_logs',
    'service_orders', 'maintenances',
    'clients', 'orders', 'order_items', 'order_installments',
    'products', 'inventory', 'inventory_movements',
    'technicians', 'technician_inventory', 'technician_leads',
    'financial_closings', 'financial_closing_items',
    'city_analysis', 'sim_lines',
    'social_selling_campaigns', 'social_selling_actions',
    'social_selling_profiles', 'social_selling_leads',
    'social_selling_experts', 'social_selling_knowledge',
    'social_selling_templates'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_company_id LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      RAISE NOTICE 'RLS habilitado para: %', t;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Aviso ao habilitar RLS em %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- Policies para tabelas existentes que tem company_id
-- (criadas com IF NOT EXISTS via DO block)
-- ============================================================

DO $$
DECLARE
  t TEXT;
  policy_name TEXT;
  tables_needing_policy TEXT[] := ARRAY[
    'collaborators', 'roles', 'sectors', 'units',
    'agent_definitions', 'agents',
    'calls', 'campaigns', 'dial_queue', 'daily_metrics',
    'call_campaigns', 'call_logs',
    'bot_instances',
    'whatsapp_meta_credentials', 'whatsapp_meta_messages',
    'whatsapp_conversations', 'whatsapp_messages',
    'leads', 'contact_leads', 'lead_items', 'lead_batches', 'lead_distributions',
    'conversations', 'messages',
    'blast_jobs', 'blast_logs',
    'disposable_chips',
    'collaborator_metrics',
    'invite_links',
    'video_edits',
    'extraction_logs',
    'service_orders', 'maintenances',
    'clients', 'orders', 'order_items', 'order_installments',
    'products', 'inventory', 'inventory_movements',
    'technicians', 'technician_inventory',
    'financial_closings', 'financial_closing_items',
    'sim_lines',
    'social_selling_campaigns'
  ];
BEGIN
  FOREACH t IN ARRAY tables_needing_policy LOOP
    policy_name := t || '_tenant_isolation';
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (company_id = (auth.jwt() ->> ''company_id'')::UUID)',
        policy_name, t
      );
      RAISE NOTICE 'Policy criada para: %', t;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'Policy ja existe para: %', t;
    WHEN OTHERS THEN
      RAISE NOTICE 'Aviso ao criar policy em %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- Policy especial: companies (usuario so ve sua propria empresa)
-- ============================================================
DO $$
BEGIN
  CREATE POLICY companies_tenant ON companies
    USING (id = (auth.jwt() ->> 'company_id')::UUID);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Policy companies_tenant ja existe';
END $$;

-- ============================================================
-- Tabelas sem company_id (policies especiais ou skip)
-- ============================================================

-- voice_profiles: compartilhados entre empresas (read-only para todos)
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY voice_profiles_read ON voice_profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- uazapi_accounts: admin-only
ALTER TABLE uazapi_accounts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY uazapi_accounts_admin ON uazapi_accounts FOR SELECT
    USING ((auth.jwt() ->> 'is_super_admin')::BOOLEAN = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- api_key_pool: admin-only
ALTER TABLE api_key_pool ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY api_key_pool_admin ON api_key_pool FOR SELECT
    USING ((auth.jwt() ->> 'is_super_admin')::BOOLEAN = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- system_config / system_configs: admin-only
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY system_config_admin ON system_config FOR SELECT
    USING ((auth.jwt() ->> 'is_super_admin')::BOOLEAN = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY system_configs_admin ON system_configs FOR SELECT
    USING ((auth.jwt() ->> 'is_super_admin')::BOOLEAN = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- profiles: usuario ve apenas seu proprio perfil
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY profiles_own ON profiles
    USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
