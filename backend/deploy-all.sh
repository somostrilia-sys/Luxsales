#!/bin/bash
# ============================================================================
# LUXSALES — Deploy todas as Edge Functions
# Executar: bash deploy-all.sh
# ============================================================================

PROJECT_REF="ecaduzwautlpzpvjognr"

FUNCTIONS=(
  "call-complete"
  "company-config"
  "conversation-engine"
  "dashboard-calls"
  "dashboard-geral"
  "dispatch-permissions"
  "generate-template"
  "generate-voice"
  "lead-distributor"
  "make-call"
  "opt-in-manager"
  "quality-monitor"
  "queue-processor"
  "send-meta-message"
  "smart-dispatcher"
  "template-intelligence"
  "vapi-tts-webhook"
  "whatsapp-meta-onboarding"
  "whatsapp-meta-send"
  "whatsapp-meta-templates"
  "whatsapp-meta-webhook"
)

echo "=== Deploying ${#FUNCTIONS[@]} functions to $PROJECT_REF ==="
echo ""

FAILED=0
SUCCESS=0

for fn in "${FUNCTIONS[@]}"; do
  echo "▶ Deploying $fn..."
  npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt 2>&1
  if [ $? -eq 0 ]; then
    echo "  ✓ $fn deployed"
    ((SUCCESS++))
  else
    echo "  ✗ $fn FAILED"
    ((FAILED++))
  fi
  echo ""
done

echo "=== Done: $SUCCESS deployed, $FAILED failed ==="
