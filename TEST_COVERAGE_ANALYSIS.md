# Test Coverage Analysis — Luxsales

## Current State

The codebase has **virtually zero test coverage**. The test infrastructure is properly configured (Vitest 3.2.4, @testing-library/react 16.0.0, jsdom environment) but only contains a single placeholder test:

```ts
// src/test/example.test.ts
describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
```

The application consists of **131+ frontend TypeScript files**, **40+ Supabase Edge Functions**, **5 context providers**, **8 custom hooks**, and multiple backend services — none of which have any tests.

---

## Priority 1 — Pure Utility Functions (Quick Wins)

These are pure functions with no external dependencies. They can be tested immediately with minimal effort and high confidence.

### 1.1 `supabase/functions/_shared/normalize-phone.ts`

**Risk:** Phone normalization is used across the entire platform (lead imports, WhatsApp messaging, opt-in tracking). A bug here silently corrupts data everywhere.

| Test Case | Input | Expected |
|-----------|-------|----------|
| null/undefined/empty | `null` | `null` |
| Formatted Brazilian mobile | `"11 98765-4321"` | `"5511987654321"` |
| With country code | `"+55 11 9 8765-4321"` | `"5511987654321"` |
| Landline | `"11 3456-7890"` | `"551134567890"` |
| 8-digit mobile (add 9) | `"11 87654321"` | `"5511987654321"` |
| Already normalized | `"5511987654321"` | `"5511987654321"` |
| Invalid DDD | `"10 98765-4321"` | `null` |
| Too short | `"1198"` | `null` |
| Parenthesized | `"(11) 98765-4321"` | `"5511987654321"` |

Also test `isValidWhatsAppNumber()`: null → false, 13 digits → true, 12 digits → true, other lengths → false.

### 1.2 `src/lib/companyFilter.ts`

**Risk:** Incorrect company filtering means users see data from wrong companies (data leak) or see nothing at all.

- `resolveCompanyFilter("all", _)` → `null`
- `resolveCompanyFilter(WALK_HOLDING_ID, _)` → `null`
- `resolveCompanyFilter("uuid-123", _)` → `"uuid-123"`
- `resolveCompanyFilter(null, "collab-company")` → `"collab-company"`
- `resolveCompanyRequired(...)` → never returns null, falls back to `OBJETIVO_COMPANY_ID`

### 1.3 `supabase/functions/_shared/retry.ts`

**Risk:** Retry logic wraps all external API calls (Meta, Claude). Broken retries = silent failures or infinite loops.

- `retryWithBackoff`: success on 1st try, success on retry, exhausts all retries, exponential delay verification
- `fetchWithTimeout`: completes before timeout, exceeds timeout (AbortController fires), custom timeout respected

### 1.4 `supabase/functions/_shared/cors.ts`

- `json(data, status)`: correct Content-Type, CORS headers present, status codes respected
- `corsResponse()`: returns 200 with CORS headers

### 1.5 `src/lib/utils.ts`

- `cn()`: merges classes, resolves Tailwind conflicts, handles falsy values

**Estimated effort:** 1–2 days. **Impact:** Covers the foundation every other module depends on.

---

## Priority 2 — Business-Critical Edge Functions

These contain the core business logic. Bugs here directly impact revenue, compliance, and customer experience.

### 2.1 `whatsapp-meta-webhook/index.ts` — Inbound Message Processing

**Why:** Every inbound WhatsApp message flows through this function. Bugs mean lost messages.

Key logic to test:
- **Idempotency**: duplicate webhook delivery must not create duplicate records
- **Status progression**: sent → delivered → read → failed (out-of-order handling)
- **Quality signal detection**: error codes 131026, 131047, 131048, 131049, 131051 must be flagged
- **Timestamp conversion**: `parseInt(timestamp) * 1000` — test overflow and malformed values
- **Billing window calculation**: conversation expiration timestamp parsing

Extractable pure functions:
- `mapStatusUpdate(status)` — status field mapping
- `parseMetaTimestamp(timestamp)` — safe timestamp conversion
- `isQualityErrorCode(code)` — error code classification
- `calculateBillingWindow(expirationTimestamp)` — window calculation

### 2.2 `whatsapp-meta-send/index.ts` — Outbound Message Sending

**Why:** Sending failures or double-sends cost money and damage Meta quality rating.

Key logic to test:
- **Opt-in validation**: messages blocked for non-opted-in leads
- **DNC checking**: Do Not Call list enforcement
- **Credential resolution precedence**: company-specific → system → fallback
- **Rate limiting**: `throttled_until` timestamp comparison
- **Template validation**: only APPROVED templates can be sent
- **Payload construction**: correct structure for text, template, media, interactive types

Extractable pure functions:
- `determineMessageType(templateName)`
- `buildMetaPayload(body)`
- `isRateLimited(rateLimit)`
- `resolveCredentials(companyId, systemConfig)`

### 2.3 `lead-distributor/index.ts` — Lead Assignment

**Why:** Incorrect distribution means leads go to wrong salespeople or are lost entirely.

Key logic to test:
- **Permission validation**: only CEO can distribute
- **Batch import**: chunking logic (100 per batch), phone normalization, duplicate detection via upsert
- **Redistribution**: status tracking, opt-in verification before redistribution
- **Queue filtering**: segment and temperature filters applied correctly
- **Stats calculation**: lead counts by status, pagination correctness

Extractable pure functions:
- `calculateStats(leads)` — status aggregation
- `applyLeadFilters(leads, filters)` — filter application

### 2.4 `smart-dispatcher/index.ts` — Template Message Dispatch

**Why:** Controls daily sending limits and Meta quality compliance. Bugs can get WhatsApp numbers banned.

Key logic to test:
- **Daily limit enforcement**: counter reset at midnight, concurrent increment safety
- **Quality rating check**: 50% tier threshold, pause at RED quality
- **Template variable resolution**: slot-to-value mapping, missing variable handling
- **Permission verification**: role + limit + template authorization chain
- **Batch processing**: per-lead fallback on individual failures

Extractable pure functions:
- `calculateQualityStatus(data)` — quality assessment
- `resolveTemplateVariables(template, mapping)` — variable substitution

### 2.5 `conversation-engine/index.ts` — AI Conversations

**Why:** AI responses represent the company to customers. Wrong behavior damages brand.

Key logic to test:
- **Intent detection**: opt-out keywords, handoff requests, call requests (pattern matching)
- **Conversation mode switching**: auto/manual/hybrid behavior differences
- **Stale lead detection**: 24h window calculation
- **Context assembly**: lifecycle + call history + company config injection
- **Claude API error handling**: timeout, malformed response, rate limiting

Extractable pure functions:
- `detectUserIntent(message, keywords)` — keyword matching
- `formatConversationHistory(messages)` — history formatting
- `buildSystemPrompt(company, persona, products)` — prompt assembly

### 2.6 `opt-in-manager/index.ts` — LGPD Compliance

**Why:** LGPD violations carry legal penalties. This function manages consent records.

Key logic to test:
- **Source validation**: only allowed sources (ai_call, inbound, landing_page, manual, qr_code, click_to_wa)
- **Opt-out cascade**: cancels pending dispatches + closes lifecycle
- **Concurrent opt-in/opt-out**: race condition between lines 86-98 and 185-197
- **Call proof association**: linking call recordings to opt-in records

### 2.7 `quality-monitor/index.ts` — WhatsApp Quality Tracking

Key logic to test:
- **Tier mapping**: Meta tier strings → internal limits (STANDARD, TIER_1K, TIER_10K, etc.)
- **Usage percentage calculation**: division by zero when tierLimit = 0
- **Alert generation**: RED quality, high usage, paused numbers
- **Tier change detection**: history comparison

Extractable pure functions:
- `mapMetaTier(tierRaw)` — tier string to limit mapping
- `calculateUsagePercentage(conversations24h, tierLimit)`
- `generateQualityAlerts(quality, usagePct, pausedCount)`

### 2.8 `template-intelligence/index.ts` — AI Template Generation

Key logic to test:
- **Forbidden words detection**: case-insensitive, word boundary handling
- **Variable sequence validation**: {{1}}, {{2}}... must be sequential
- **CAPS LOCK detection**: excessive uppercase ratio
- **Emoji counting**: max emoji threshold
- **LLM response parsing**: handle markdown-wrapped JSON from Claude

Extractable pure functions:
- `validateTemplateRules(template, forbiddenWords)`
- `validateVariableSequence(body)`
- `hasForbiddenWords(text, wordList)`
- `hasCapsLockExcess(text)`
- `countEmojis(text)`

**Estimated effort:** 2–3 weeks. **Impact:** Covers all revenue-critical and compliance-critical paths.

---

## Priority 3 — React Contexts and Hooks

These are the foundation of all frontend state management. Bugs here cascade to every page.

### 3.1 `contexts/AuthContext.tsx`

- Sign in / sign up / sign out flows (mock `supabase.auth`)
- `TOKEN_REFRESHED` event optimization (should not re-render if user unchanged)
- Auth listener cleanup on unmount
- Error propagation from Supabase auth methods

### 3.2 `contexts/CompanyContext.tsx`

**Most complex context** — multi-step fetch with fallback chains.

- Edge function `/dispatch-permissions` → DB fallback → null
- Auto-create CEO permissions when missing
- Role mapping: permission role vs. collaborator level (0→ceo, 1→director, 2→manager, 3→collaborator)
- `needsSetup` flag: only true for CEO without company segment
- Edge function `/company-config` → fallback → derived data

### 3.3 `contexts/CollaboratorContext.tsx`

- Multi-relation join query (company, role, sector, unit)
- Role level computation: `collaborator?.role?.level ?? 99`
- Derived flags: `isCEO`, `isDiretor`, `isGestor`, `isColaborador`
- Optimization: `userIdRef` prevents re-fetch on token refresh

### 3.4 `hooks/usePermission.ts`

- CEO (roleLevel === 0) → immediate full access bypass
- Non-CEO → queries `user_permissions` table per module
- Missing permissions → all false

### 3.5 `hooks/useRealtimeMessages.ts`

- Supabase channel subscription filtering (company_id, INSERT events)
- Skip outbound messages (phone_from === waba_phone)
- Browser notification vs. sound based on `document.hidden`
- Duplicate prevention via `lastNotifiedRef`

### 3.6 `hooks/useRealtimeSession.ts`

**Most complex hook** — WebRTC connection management. Requires mocking RTCPeerConnection, getUserMedia, data channels.

- 7-step connection flow
- ICE failure → auto-disconnect
- Event parsing: transcript extraction from multiple event types
- Resource cleanup on disconnect (tracks, channels, peer connection)

**Estimated effort:** 1–2 weeks. **Impact:** Prevents auth failures, permission leaks, and real-time data bugs.

---

## Priority 4 — Complex Page Components

Pages with the most business logic embedded in the UI layer.

### 4.1 `pages/ImportLeads.tsx` (686 lines) — CRITICAL

- **Phone normalization**: 10-digit → 11-digit conversion, validation, accept/correct/discard classification
- **File parsing**: CSV/XLSX with encoding handling
- **Column auto-mapping**: regex-based detection of phone/name/email columns
- **Data transformation**: column mapping → system fields, tag parsing, extra field extraction
- **Batch processing**: 500 leads per batch with progress tracking

### 4.2 `pages/Conversas.tsx` (1267 lines) — CRITICAL

- **Role-based query filtering**: CEO vs. Gestor vs. Consultant data access
- **Window expiration calculation**: multiple sources, 24h manual fallback, countdown formatting
- **Message deduplication**: ref-based seen ID tracking under concurrent updates
- **Real-time polling**: 5-second debounced refresh, unread count tracking

### 4.3 `pages/LeadsMaster.tsx` (957 lines) — HIGH

- **Lead scoring algorithm**: call attempts (20-10pts), interest (40/-20pts), recency (20/10pts), phone (10pts)
- **Temperature classification**: Hot/Warm/Cold thresholds
- **Multi-dimensional filtering**: status × segment × temperature × score ranges
- **Stats calculation**: 12 status categories, aggregates

### 4.4 `pages/Templates.tsx` (1250 lines) — HIGH

- **Template validation rules**: forbidden words, policy compliance, category-based prediction
- **Quality score thresholds**: 85+ → submit, 70+ → review, <70 → rewrite
- **Performance analytics**: response/read/block rates

### 4.5 `pages/GestaoUsuarios.tsx` (795 lines) — MEDIUM

- **Permission system**: role-based defaults (3 levels × 7-9 modules × view/edit/delete)
- **Invite link management**: validity periods, max uses

### 4.6 `pages/DashboardGeral.tsx` (1348 lines) — MEDIUM

- **Multi-source data aggregation**: calls, WhatsApp, Meta quality, team data
- **Alert threshold logic**: severity assignment based on usage% and quality
- **KPI calculations**: answer rate, opt-in rate, delivery/read/reply rates

**Estimated effort:** 2–3 weeks. **Impact:** Prevents data corruption on import, lost conversations, wrong lead assignments.

---

## Recommended Testing Strategy

### Phase 1: Foundation (Week 1)
Extract and test all pure functions. This gives immediate confidence in the building blocks without any mocking complexity.

**Files to create:**
- `src/lib/__tests__/companyFilter.test.ts`
- `src/lib/__tests__/utils.test.ts`
- `supabase/functions/_shared/__tests__/normalize-phone.test.ts`
- `supabase/functions/_shared/__tests__/retry.test.ts`
- `supabase/functions/_shared/__tests__/cors.test.ts`

### Phase 2: Extract & Test Edge Function Logic (Weeks 2–3)
Refactor edge functions to extract pure business logic into separate modules, then test those modules. This avoids the complexity of mocking Supabase/Deno in edge function tests.

**Pattern:**
```
supabase/functions/smart-dispatcher/
├── index.ts          # HTTP handler (thin, delegates to logic)
├── logic.ts          # Pure business logic (testable)
└── logic.test.ts     # Tests for pure logic
```

**Priority functions to refactor:**
1. `whatsapp-meta-webhook` — status mapping, timestamp parsing, error classification
2. `whatsapp-meta-send` — payload construction, rate limit checks, credential resolution
3. `smart-dispatcher` — quality calculation, variable resolution, permission checks
4. `conversation-engine` — intent detection, prompt building, history formatting
5. `template-intelligence` — all validation rules (forbidden words, variable sequence, caps, emojis)
6. `quality-monitor` — tier mapping, usage calculation, alert generation
7. `opt-in-manager` — source validation, cascade logic
8. `lead-distributor` — stats calculation, filter application

### Phase 3: Context & Hook Tests (Week 4)
Set up Supabase mocks and test React contexts/hooks using `@testing-library/react` `renderHook`.

**Create shared test utilities:**
```ts
// src/test/mocks/supabase.ts — mock Supabase client
// src/test/mocks/auth.ts — mock auth state
// src/test/wrappers.tsx — context wrapper for hook tests
```

**Priority:**
1. `CollaboratorContext` — role derivation logic
2. `CompanyContext` — fallback chains, role mapping
3. `AuthContext` — session management
4. `usePermission` — CEO bypass, module permissions

### Phase 4: Component Integration Tests (Weeks 5–6)
Test complex pages focusing on business logic, not UI details.

**Priority:**
1. `ImportLeads` — phone normalization, file parsing, batch processing
2. `Conversas` — role filtering, deduplication, window expiration
3. `LeadsMaster` — scoring algorithm, temperature classification, filtering

---

## Cross-Cutting Concerns Discovered

These issues surfaced during analysis and should be addressed alongside testing:

### Race Conditions
- **Lead distribution**: check-then-insert without transactions (concurrent CEOs distributing same lead)
- **Daily limit reset**: concurrent requests at midnight could increment after reset
- **Opt-in/opt-out**: concurrent processing can leave inconsistent state

### Missing Error Handling
- **Claude API calls** in `conversation-engine` and `template-intelligence` have no timeout
- **Batch imports** in `lead-distributor`: if chunk 2 fails after chunk 1 succeeds, partial data persists
- **Meta API version mismatch**: some functions hardcode v22.0, others use configurable `api_version || "v21.0"`

### Data Consistency
- **Orphaned records**: lifecycle creation failure after lead distribution leaves dangling references
- **Async cascades**: opt-out dispatch cancellation doesn't verify success
- **Dual writes**: `smart-dispatcher` updates `smart_dispatches` and `whatsapp_meta_messages` separately without transactions

### Security
- No rate limiting on edge functions themselves (only downstream Meta API)
- Role checking is inconsistent across edge functions (some check, some don't)

---

## Metrics Target

| Metric | Current | Phase 1 Target | Phase 4 Target |
|--------|---------|----------------|----------------|
| Test files | 1 | 10+ | 30+ |
| Unit tests | 0 | 80+ | 200+ |
| Pure function coverage | 0% | 90%+ | 95%+ |
| Context/hook coverage | 0% | 0% | 70%+ |
| Edge function logic coverage | 0% | 40%+ | 75%+ |
| Page component coverage | 0% | 0% | 50%+ |
