/**
 * LuxSales Orchestrator v1.0
 * Orquestrador de discagem com suporte a simulação
 * PM2: luxsales-orchestrator | Porta: 3002
 */

const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3002;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || "5");
const MAX_RETRIES = 3;
const RETRY_INTERVAL_MIN = 60; // minutos entre tentativas
const ESL_CONTROLLER_URL = "http://localhost:3000/call";
const TIMEZONE = "America/Sao_Paulo";

const SUPABASE_URL = "https://ecaduzwautlpzpvjognr.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAwNDUxNywiZXhwIjoyMDg4NTgwNTE3fQ.WlgrZNfRYCsgllWVEjCxcer4OMJzw5NEZoUlA-cG1Rc";

function log(msg) {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

// ─── Estado interno ───────────────────────────────────────────────────────────
const state = {
  queue: [],           // { lead_id, phone, company_id, priority, attempts, last_attempt_at }
  activeCalls: new Map(), // call_id → { lead_id, phone, company_id, started_at }
  running: false,
  simulationMode: false,
  dispatchInterval: null,
};

// ─── Verificar horário comercial ──────────────────────────────────────────────
function isBusinessHours() {
  const now = new Date();
  const brt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(now);
  const hour = parseInt(brt, 10);
  return hour >= 8 && hour < 20;
}

// ─── Supabase helper ──────────────────────────────────────────────────────────
function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
    };
    if (data) options.headers["Content-Length"] = Buffer.byteLength(data);

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (d) => raw += d);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null });
        } catch {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function insertCall(lead_id, phone, company_id, status) {
  const payload = {
    lead_id: lead_id || null,
    destination_number: phone,
    company_id,
    status,
    created_at: new Date().toISOString(),
  };
  try {
    const res = await supabaseRequest("POST", "/rest/v1/calls", payload);
    if (res.status >= 200 && res.status < 300) {
      const row = Array.isArray(res.data) ? res.data[0] : res.data;
      return row?.id || null;
    }
    log(`[SUPABASE] insertCall status=${res.status}: ${JSON.stringify(res.data)}`);
  } catch (e) {
    log(`[SUPABASE] insertCall erro: ${e.message}`);
  }
  return null;
}

async function updateCall(call_id, updates) {
  try {
    await supabaseRequest("PATCH", `/rest/v1/calls?id=eq.${call_id}`, updates);
  } catch (e) {
    log(`[SUPABASE] updateCall erro: ${e.message}`);
  }
}

// ─── Disparar chamada ─────────────────────────────────────────────────────────
async function dispatchCall(item) {
  const { lead_id, phone, company_id } = item;
  log(`[DISPATCH] ${state.simulationMode ? "[SIM] " : ""}phone=${phone} company=${company_id}`);

  if (state.simulationMode) {
    // Modo simulação: só registrar no Supabase
    const call_id = await insertCall(lead_id, phone, company_id, "simulated");
    if (call_id) {
      log(`[SIM] Registrado call_id=${call_id}`);
    }
    return { success: true, simulated: true, call_id };
  }

  // Registrar como "calling" no Supabase
  const call_id = await insertCall(lead_id, phone, company_id, "calling");

  // Disparar via ESL Controller
  return new Promise((resolve) => {
    const body = JSON.stringify({ to: phone, company_id });
    const options = {
      hostname: "localhost",
      port: 3000,
      path: "/call",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", (d) => raw += d);
      res.on("end", async () => {
        try {
          const result = JSON.parse(raw);
          if (result.success) {
            state.activeCalls.set(result.uuid || call_id, {
              lead_id, phone, company_id, call_id, started_at: Date.now()
            });
            log(`[DISPATCH] OK uuid=${result.uuid}`);
            resolve({ success: true, uuid: result.uuid, call_id });
          } else {
            if (call_id) await updateCall(call_id, { status: "failed" });
            log(`[DISPATCH] Falhou: ${JSON.stringify(result)}`);
            resolve({ success: false, error: result.error });
          }
        } catch (e) {
          if (call_id) await updateCall(call_id, { status: "failed" });
          resolve({ success: false, error: e.message });
        }
      });
    });

    req.on("error", async (e) => {
      if (call_id) await updateCall(call_id, { status: "failed" });
      log(`[DISPATCH] Erro HTTP: ${e.message}`);
      resolve({ success: false, error: e.message });
    });

    req.write(body);
    req.end();
  });
}

// ─── Worker: processa fila ────────────────────────────────────────────────────
async function processQueue() {
  if (!state.running) return;
  if (!isBusinessHours()) {
    log("[QUEUE] Fora do horário comercial (08h-20h BRT) — aguardando");
    return;
  }
  if (state.activeCalls.size >= MAX_CONCURRENT) {
    log(`[QUEUE] Limite de chamadas simultâneas atingido (${MAX_CONCURRENT})`);
    return;
  }

  const now = Date.now();
  const retryMs = RETRY_INTERVAL_MIN * 60 * 1000;

  // Filtrar leads prontos: tentativas < MAX e intervalo respeitado
  const ready = state.queue.filter((item) => {
    if (item.attempts >= MAX_RETRIES) return false;
    if (item.last_attempt_at && now - item.last_attempt_at < retryMs) return false;
    return true;
  });

  if (ready.length === 0) {
    log("[QUEUE] Nenhum lead pronto para discagem");
    return;
  }

  // Ordenar por prioridade (maior primeiro)
  ready.sort((a, b) => (b.priority || 1) - (a.priority || 1));
  const item = ready[0];

  item.attempts = (item.attempts || 0) + 1;
  item.last_attempt_at = now;

  log(`[QUEUE] Despachando lead_id=${item.lead_id} tentativa=${item.attempts}/${MAX_RETRIES}`);
  await dispatchCall(item);

  // Se atingiu máximo de tentativas, remover da fila
  if (item.attempts >= MAX_RETRIES) {
    state.queue = state.queue.filter((q) => q !== item);
    log(`[QUEUE] lead_id=${item.lead_id} removido após ${MAX_RETRIES} tentativas`);
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (d) => body += d);
    req.on("end", () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = req.url.split("?")[0];

  // GET /health
  if (req.method === "GET" && url === "/health") {
    return json(res, {
      ok: true,
      version: "luxsales-orchestrator-1.0",
      running: state.running,
      simulation_mode: state.simulationMode,
      active_calls: state.activeCalls.size,
      queue_size: state.queue.length,
      business_hours: isBusinessHours(),
      max_concurrent: MAX_CONCURRENT,
    });
  }

  // GET /queue/status
  if (req.method === "GET" && url === "/queue/status") {
    const now = Date.now();
    const retryMs = RETRY_INTERVAL_MIN * 60 * 1000;
    const pending = state.queue.filter((item) => {
      if (item.attempts >= MAX_RETRIES) return false;
      if (item.last_attempt_at && now - item.last_attempt_at < retryMs) return false;
      return true;
    });
    return json(res, {
      running: state.running,
      simulation_mode: state.simulationMode,
      active_calls: state.activeCalls.size,
      active_calls_detail: [...state.activeCalls.entries()].map(([uuid, c]) => ({
        uuid, ...c, duration_s: Math.floor((Date.now() - c.started_at) / 1000),
      })),
      queue_total: state.queue.length,
      queue_pending: pending.length,
      queue_items: state.queue,
      business_hours: isBusinessHours(),
    });
  }

  // POST /queue/add
  if (req.method === "POST" && url === "/queue/add") {
    const body = await readBody(req);
    const { lead_id, phone, company_id, priority } = body;
    if (!phone || !company_id) {
      return json(res, { error: "phone e company_id são obrigatórios" }, 400);
    }

    // Evitar duplicatas na fila
    const exists = state.queue.find((q) => q.phone === phone && q.company_id === company_id);
    if (exists) {
      return json(res, { message: "Lead já está na fila", item: exists });
    }

    const item = {
      lead_id: lead_id || null,
      phone,
      company_id,
      priority: priority || 1,
      attempts: 0,
      last_attempt_at: null,
      added_at: Date.now(),
    };
    state.queue.push(item);
    log(`[QUEUE] Adicionado: phone=${phone} company=${company_id} priority=${priority || 1}`);
    return json(res, { success: true, item, queue_size: state.queue.length });
  }

  // POST /queue/start
  if (req.method === "POST" && url === "/queue/start") {
    if (state.running) {
      return json(res, { message: "Orquestrador já está rodando" });
    }
    state.running = true;
    // Disparar worker a cada 30s
    state.dispatchInterval = setInterval(processQueue, 30000);
    // Processar imediatamente
    processQueue().catch((e) => log(`[QUEUE] erro: ${e.message}`));
    log("[QUEUE] Iniciado");
    return json(res, { success: true, message: "Discagem iniciada" });
  }

  // POST /queue/pause
  if (req.method === "POST" && url === "/queue/pause") {
    state.running = false;
    if (state.dispatchInterval) {
      clearInterval(state.dispatchInterval);
      state.dispatchInterval = null;
    }
    log("[QUEUE] Pausado");
    return json(res, { success: true, message: "Discagem pausada" });
  }

  // POST /queue/simulate
  if (req.method === "POST" && url === "/queue/simulate") {
    const body = await readBody(req);
    state.simulationMode = body.enabled !== false; // default true
    log(`[QUEUE] Modo simulação: ${state.simulationMode ? "ATIVADO" : "DESATIVADO"}`);
    return json(res, { success: true, simulation_mode: state.simulationMode });
  }

  // POST /dispatch
  if (req.method === "POST" && url === "/dispatch") {
    const body = await readBody(req);

    // Se body tem phone/company_id direto, despachar diretamente
    if (body.phone && body.company_id) {
      const result = await dispatchCall({
        lead_id: body.lead_id || null,
        phone: body.phone,
        company_id: body.company_id,
        priority: 1,
        attempts: 0,
      });
      return json(res, result);
    }

    // Caso contrário, pegar próximo da fila
    if (!state.running) {
      return json(res, { error: "Orquestrador não está rodando. Use /queue/start primeiro." }, 400);
    }
    await processQueue();
    return json(res, { success: true, message: "Próximo lead despachado (se disponível)" });
  }



  // GET /js/* — arquivos estáticos JS
  if (req.method === "GET" && url.startsWith("/js/")) {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.join("/opt/walk-voip/web-test", url);
    try {
      const file = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(file);
    } catch(e) {
      res.writeHead(404); res.end("Not found");
    }
    return;
  }

  // GET /webrtc-test — servir página de teste WebRTC
  if (req.method === "GET" && url === "/webrtc-test") {
    const fs = require("fs");
    try {
      const html = fs.readFileSync("/opt/walk-voip/web-test/index.html", "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch(e) {
      res.writeHead(500);
      res.end("WebRTC page not found");
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  log(`
╔══════════════════════════════════════════════════╗
║  LuxSales Orchestrator v1.0                      ║
║  Porta: ${PORT}                                     ║
║  Max simultâneas: ${MAX_CONCURRENT}                           ║
║  Horário: 08h-20h BRT                            ║
║  Max tentativas: ${MAX_RETRIES} (intervalo: ${RETRY_INTERVAL_MIN}min)       ║
╚══════════════════════════════════════════════════╝`);
});
