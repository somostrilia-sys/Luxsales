/**
 * orchestrator-proxy v3
 * Bridge Lovable (HTTPS) → orquestrador local (via reverse tunnel VPS)
 * URL: /functions/v1/orchestrator-proxy?path=/queue/status
 * ou:  /functions/v1/orchestrator-proxy/queue/status (path via header)
 */

const ORCHESTRATOR_URL = Deno.env.get("ORCHESTRATOR_URL") || "http://134.122.17.106:3099";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization, x-proxy-path",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // Aceitar path via query param ?path=/queue/status
    // ou via header x-proxy-path
    // ou via pathname após a função
    let proxyPath = url.searchParams.get("path") 
      || req.headers.get("x-proxy-path") 
      || "/";

    // Se vier body JSON com campo "path", usar ele
    let bodyText: string | undefined;
    if (req.method === "POST") {
      bodyText = await req.text();
      try {
        const parsed = JSON.parse(bodyText);
        if (parsed._path) {
          proxyPath = parsed._path;
          // Remover _path do body antes de repassar
          delete parsed._path;
          bodyText = JSON.stringify(parsed);
        }
      } catch {}
    }

    const targetUrl = `${ORCHESTRATOR_URL}${proxyPath}${url.search}`;
    console.log(`[PROXY v3] ${req.method} ${proxyPath} → ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: bodyText,
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });

  } catch (err: any) {
    console.error("[PROXY] Erro:", err.message);
    return new Response(
      JSON.stringify({ error: "Orchestrator unavailable", detail: err.message }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
