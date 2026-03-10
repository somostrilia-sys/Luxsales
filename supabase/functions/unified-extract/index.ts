import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractRequest {
  cep: string;
  sources: string[];
  company_target: string | null;
  radius_km: number;
}

interface Lead {
  name: string;
  phone: string;
  email?: string;
  tipo_pessoa: string;
  city?: string;
  region?: string;
  category?: string;
  source: string;
  score: number;
  cep_origem?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const { cep, sources, company_target, radius_km }: ExtractRequest = await req.json();
    const leads: Lead[] = [];
    const seenPhones = new Set<string>();

    // 1. Resolve CEP via ViaCEP
    const viacepRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const viacepData = await viacepRes.json();
    const city = viacepData.localidade || "";
    const region = viacepData.uf || "";
    const cepPrefix = cep.slice(0, 5);

    // 2. PJ Base: search cnpj_leads by CEP prefix
    if (sources.includes("pj_base")) {
      const { data: pjData } = await supabase
        .from("cnpj_leads")
        .select("*")
        .ilike("cep", `${cepPrefix}%`)
        .limit(200);

      for (const pj of pjData || []) {
        const phone = pj.telefone || pj.phone;
        if (!phone || seenPhones.has(phone)) continue;
        seenPhones.add(phone);
        leads.push({
          name: pj.razao_social || pj.name || "Empresa",
          phone,
          email: pj.email || undefined,
          tipo_pessoa: "PJ",
          city: pj.municipio || city,
          region: pj.uf || region,
          category: pj.cnae_descricao || pj.category || "",
          source: "pj_base",
          score: 75,
          cep_origem: cep,
        });
      }
    }

    // 3. Google Maps via Overpass (OSM)
    if (sources.includes("google_maps")) {
      try {
        // Geocode via Nominatim
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${cep}&country=BR&format=json&limit=1`,
          { headers: { "User-Agent": "WalkApp/1.0" } }
        );
        const geoData = await geoRes.json();
        if (geoData.length > 0) {
          const lat = parseFloat(geoData[0].lat);
          const lon = parseFloat(geoData[0].lon);
          const radiusM = radius_km * 1000;

          const overpassQuery = `[out:json][timeout:15];node(around:${radiusM},${lat},${lon})["phone"];out body 50;`;
          const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: `data=${encodeURIComponent(overpassQuery)}`,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          });
          const overpassData = await overpassRes.json();

          for (const el of overpassData.elements || []) {
            const phone = el.tags?.phone?.replace(/\D/g, "");
            if (!phone || seenPhones.has(phone)) continue;
            seenPhones.add(phone);
            leads.push({
              name: el.tags?.name || "Estabelecimento",
              phone,
              tipo_pessoa: "PJ",
              city,
              region,
              category: el.tags?.amenity || el.tags?.shop || "",
              source: "google_maps",
              score: 70,
              cep_origem: cep,
            });
          }
        }
      } catch {}
    }

    // 4. Instagram leads
    if (sources.includes("instagram")) {
      const { data: igData } = await supabase
        .from("instagram_leads")
        .select("*")
        .not("phone", "is", null)
        .limit(100);

      for (const ig of igData || []) {
        if (!ig.phone || seenPhones.has(ig.phone)) continue;
        seenPhones.add(ig.phone);
        leads.push({
          name: ig.full_name || ig.username || "Instagram Lead",
          phone: ig.phone,
          email: ig.email || undefined,
          tipo_pessoa: "PF",
          city,
          region,
          source: "instagram",
          score: 80,
          cep_origem: cep,
        });
      }
    }

    // 5. OLX (best effort)
    if (sources.includes("olx")) {
      try {
        const olxRes = await fetch(
          `https://www.olx.com.br/api/v1/search?region=${region.toLowerCase()}&municipality=${encodeURIComponent(city.toLowerCase())}&limit=20`
        );
        if (olxRes.ok) {
          const olxData = await olxRes.json();
          for (const ad of olxData.data || []) {
            const phone = ad.phone?.replace(/\D/g, "");
            if (!phone || seenPhones.has(phone)) continue;
            seenPhones.add(phone);
            leads.push({
              name: ad.subject || "Anunciante OLX",
              phone,
              tipo_pessoa: "PF",
              city,
              region,
              category: ad.category || "",
              source: "olx",
              score: 60,
              cep_origem: cep,
            });
          }
        }
      } catch {}
    }

    // Sort by score desc
    leads.sort((a, b) => b.score - a.score);

    // Upsert into contact_leads
    if (leads.length > 0) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      for (const lead of leads) {
        await serviceClient.from("contact_leads").upsert(
          {
            name: lead.name,
            phone: lead.phone,
            email: lead.email || null,
            tipo_pessoa: lead.tipo_pessoa,
            city: lead.city || null,
            region: lead.region || null,
            category: lead.category || null,
            source: lead.source,
            score: lead.score,
            cep_origem: lead.cep_origem || null,
            company_target: company_target,
            status: "pending",
          },
          { onConflict: "phone" }
        );
      }

      // Log extraction
      await serviceClient.from("extraction_logs").insert({
        user_id: userId,
        type: "cep",
        parameters: { cep, sources, company_target, radius_km },
        results_count: leads.length,
      });
    }

    return new Response(JSON.stringify({ leads, total: leads.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
