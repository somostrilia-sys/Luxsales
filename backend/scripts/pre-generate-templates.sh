#!/bin/bash
# pre-generate-templates.sh
# Submete os 6 templates estratégicos pós-ligação para aprovação da Meta
# Executar UMA VEZ antes do go-live

set -e

SUPABASE_URL="https://ecaduzwautlpzpvjognr.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAwNDUxNywiZXhwIjoyMDg4NTgwNTE3fQ.WlgrZNfRYCsgllWVEjCxcer4OMJzw5NEZoUlA-cG1Rc"

echo '🚀 Submetendo 6 templates estratégicos para aprovação Meta...'

RESPONSE=$(curl -s -X POST   "${SUPABASE_URL}/functions/v1/generate-template"   -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"   -H "Content-Type: application/json"   -d '{"action": "pre-generate"}')

echo "Resposta: $RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

SUBMITTED=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('submitted',0))" 2>/dev/null || echo '?')
echo ""
echo "✅ Templates submetidos: $SUBMITTED/6"
echo "⏳ Aguarde aprovação da Meta (normalmente 24-48h)"
