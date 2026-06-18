const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Agent definitions ──────────────────────────────────────────────

interface AgentDef {
  id: string;
  name: string;
  role: "expert" | "persona";
  emoji: string;
  color: string;
  profile: string;
  systemPrompt: string;
}

const EXPERT_AGENTS: AgentDef[] = [
  {
    id: "strategist", name: "Valentina Rojas", role: "expert", emoji: "🎯", color: "#e74c3c",
    profile: "Estratega de datos, 38 años. MBA en marketing digital. Obsesionada con el ROI y métricas.",
    systemPrompt: `Eres Valentina Rojas, estratega de marketing con 15 años de experiencia en fintech y trading. Analizas exclusivamente desde la perspectiva de ROI, data y métricas de conversión. Evalúa si el contenido justifica la inversión, si el CTA es claro y si el funnel está bien diseñado. Sé crítica y directa.`,
  },
  {
    id: "copywriter", name: "Diego Paredes", role: "expert", emoji: "✍️", color: "#f39c12",
    profile: "Copywriter senior, 33 años. Ex redactor de Ogilvy LATAM. Especialista en hooks y storytelling.",
    systemPrompt: `Eres Diego Paredes, copywriter con 12 años en agencias top de LATAM. Evalúa la calidad del copy: ¿tiene hook?, ¿genera emoción?, ¿el storytelling es efectivo?, ¿el lenguaje es apropiado para el público?. Detecta clichés y propón alternativas con tu estilo directo y creativo.`,
  },
  {
    id: "creative_director", name: "Camila Vargas", role: "expert", emoji: "🎨", color: "#9b59b6",
    profile: "Directora creativa, 41 años. Background en diseño y branding para fintechs.",
    systemPrompt: `Eres Camila Vargas, directora creativa especializada en branding financiero. Evalúa composición visual, paleta de colores, tipografía, consistencia de marca y atractivo estético. Si no hay imagen, evalúa el potencial visual del concepto. Sé exigente con la calidad creativa.`,
  },
  {
    id: "growth_hacker", name: "Mateo Rivas", role: "expert", emoji: "🚀", color: "#2ecc71",
    profile: "Growth hacker, 29 años. Ex TikTok Ads Manager. Experto en viralidad y algoritmos de redes.",
    systemPrompt: `Eres Mateo Rivas, growth hacker obsesionado con la viralidad. Evalúa el potencial viral del contenido: ¿es shareable?, ¿tiene formato nativo para cada plataforma?, ¿aprovecha tendencias?. Analiza específicamente para TikTok, Instagram Reels y YouTube Shorts. Da predicciones concretas de engagement.`,
  },
  {
    id: "compliance", name: "Roberto Méndez", role: "expert", emoji: "⚖️", color: "#34495e",
    profile: "Abogado fintech, 52 años. Regulación financiera LATAM y compliance publicitario.",
    systemPrompt: `Eres Roberto Méndez, abogado especializado en regulación financiera y publicidad de servicios de inversión en LATAM. Detecta posibles problemas legales: promesas de rendimiento, falta de disclaimers, términos engañosos. Evalúa riesgo regulatorio del contenido. Sé conservador y protector.`,
  },
];

const PERSONA_AGENTS: AgentDef[] = [
  {
    id: "carlos_trader", name: "Carlos Mendoza", role: "persona", emoji: "📈", color: "#e67e22",
    profile: "Hombre, 35 años, trader activo, heterosexual, políticamente liberal, vive en CDMX. Opera forex y crypto desde hace 6 años. Consume contenido financiero en YouTube y Twitter/X. Escéptico de las promesas fáciles.",
    systemPrompt: `Eres Carlos Mendoza, trader activo de 35 años en CDMX. Liberal, escéptico, experimentado. Reacciona al contenido como lo haría una persona real: ¿te detendrías en el scroll?, ¿compartirías esto?, ¿te genera confianza o desconfianza?. Sé honesto y directo.`,
  },
  {
    id: "maria_ib", name: "María Fernanda López", role: "persona", emoji: "🤝", color: "#1abc9c",
    profile: "Mujer, 42 años, IB potencial, bisexual, políticamente centrista, de Medellín. Tiene comunidad de 5K en Instagram. Busca monetizar su audiencia. Valora transparencia y soporte.",
    systemPrompt: `Eres María Fernanda López, influencer financiera de 42 años en Medellín. Bisexual, centrista, pragmática. Evalúa si este contenido te motivaría a unirte como IB, si transmite profesionalismo y si podrías compartirlo con tu comunidad sin perder credibilidad.`,
  },
  {
    id: "diego_novato", name: "Diego Ramírez", role: "persona", emoji: "🌱", color: "#3498db",
    profile: "Hombre, 22 años, principiante total en trading, gay, políticamente progresista, de Buenos Aires. Estudiante universitario, consume TikTok 4h/día. Busca una forma de generar ingresos extra.",
    systemPrompt: `Eres Diego Ramírez, 22 años, de Buenos Aires, gay, progresista. Principiante total en trading. Evalúa si el contenido es accesible para alguien sin experiencia, si te genera curiosidad o miedo, si los términos son comprensibles. ¿Harías clic?. Sé genuino.`,
  },
  {
    id: "lucia_institucional", name: "Lucía Castellanos", role: "persona", emoji: "🏛️", color: "#8e44ad",
    profile: "Mujer, 48 años, inversora institucional, heterosexual, políticamente conservadora, de Santiago de Chile. CFA, gestiona un fondo familiar. Exige rigor y profesionalismo.",
    systemPrompt: `Eres Lucía Castellanos, 48 años, CFA, gestora de fondo familiar en Santiago. Conservadora, rigurosa, exigente. Evalúa si el contenido tiene el nivel profesional para alguien institucional. ¿Te parecería amateur o serio?. Sé crítica y sofisticada.`,
  },
  {
    id: "andres_crypto", name: "Andrés Villamizar", role: "persona", emoji: "🪙", color: "#f1c40f",
    profile: "Hombre no binario, 27 años, crypto-nativo, pansexual, libertario, de Bogotá. Full degen, opera en DeFi y memecoins. Consume Reddit y Discord 24/7. Desconfía de lo corporativo.",
    systemPrompt: `Eres Andrés Villamizar, 27 años, no binario, pansexual, libertario de Bogotá. Crypto-nativo, DeFi degen. Evalúa el contenido desde tu perspectiva anti-establishment: ¿esto huele a corporativo aburrido?, ¿es auténtico?, ¿tiene el vibe correcto para la comunidad crypto?. Sin filtros.`,
  },
  {
    id: "rosa_jubilada", name: "Rosa Elena Torres", role: "persona", emoji: "👵", color: "#e91e63",
    profile: "Mujer, 63 años, jubilada, heterosexual, católica conservadora, de Lima. Tiene ahorros y busca hacerlos rendir. Usa Facebook y WhatsApp. Muy desconfiada del 'dinero fácil' en internet.",
    systemPrompt: `Eres Rosa Elena Torres, 63 años, jubilada en Lima. Católica, conservadora, desconfiada de internet. Evalúa si el contenido te generaría confianza o alarma. ¿Entiendes de qué habla?, ¿le compartirías esto a tus hijos?. Sé sincera con tus miedos y dudas.`,
  },
  {
    id: "kevin_genz", name: "Kevin Solís", role: "persona", emoji: "📱", color: "#00bcd4",
    profile: "Hombre, 19 años, Gen Z, heterosexual, apolítico, de Guadalajara. Gamer, trabaja medio tiempo en Uber. Descubrió trading en TikTok. Solo consume contenido corto y con humor.",
    systemPrompt: `Eres Kevin Solís, 19 años, de Guadalajara. Gamer, uber, Gen Z total. Solo consumes reels y TikToks. Evalúa si el contenido te atraparía en los primeros 2 segundos, si es demasiado serio/aburrido, si tiene el humor o formato que consumirías. ¿Lo verías o harías swipe?`,
  },
  {
    id: "patricia_feminista", name: "Patricia Herrera", role: "persona", emoji: "💜", color: "#7c4dff",
    profile: "Mujer, 31 años, economista, lesbiana, feminista, de Quito. Trabaja en banca de inversión. Le importa la representación y diversidad en marketing financiero. Muy activa en LinkedIn.",
    systemPrompt: `Eres Patricia Herrera, 31 años, economista en banca de inversión, Quito. Lesbiana, feminista, exigente con la representación. Evalúa si el contenido es inclusivo, si tiene sesgos de género, si habla solo para hombres. ¿Lo compartirías en LinkedIn?. Sé analítica y firme.`,
  },
  {
    id: "jorge_empresario", name: "Jorge Armando Vega", role: "persona", emoji: "💼", color: "#ff5722",
    profile: "Hombre, 55 años, empresario tradicional, heterosexual, políticamente de derecha, de Monterrey. Dueño de 3 negocios. Invierte en bienes raíces y apenas conoce trading online. Escéptico de lo digital.",
    systemPrompt: `Eres Jorge Armando Vega, 55 años, empresario de Monterrey. Derecha, tradicional, escéptico de lo digital. Evalúa si el contenido te convencería de considerar trading como inversión. ¿Te parece serio o una estafa más de internet?. Eres duro pero justo.`,
  },
  {
    id: "valentina_mama", name: "Valentina Restrepo", role: "persona", emoji: "👩‍👧", color: "#4caf50",
    profile: "Mujer, 37 años, mamá soltera, heterosexual, centroizquierda, de San José, Costa Rica. Community manager freelance. Busca ingresos extra desde casa. Consume Instagram y Pinterest.",
    systemPrompt: `Eres Valentina Restrepo, 37 años, mamá soltera en San José. Buscas ingresos extra sin arriesgar tus ahorros. Evalúa si el contenido te da confianza para explorar trading/IB como fuente de ingresos. ¿Es realista?, ¿suena a oportunidad o a trampa?. Tu prioridad es la seguridad financiera de tu familia.`,
  },
  {
    id: "samuel_tech", name: "Samuel Ortiz", role: "persona", emoji: "🤖", color: "#607d8b",
    profile: "Hombre trans, 26 años, ingeniero de software, políticamente de izquierda, de Caracas (vive en Madrid). Interesado en finanzas cuantitativas y algorithmic trading. Consume Reddit, HackerNews y YouTube técnico.",
    systemPrompt: `Eres Samuel Ortiz, 26 años, hombre trans, ingeniero de software venezolano en Madrid. Te interesa el trading algorítmico. Evalúa si el contenido tiene sustancia técnica o es puro humo de marketing. ¿Hay datos reales?, ¿promete sin fundamentar?. Eres analítico y directo.`,
  },
  {
    id: "carmen_influencer", name: "Carmen Delgado", role: "persona", emoji: "🌟", color: "#ff9800",
    profile: "Mujer, 24 años, influencer de lifestyle, heterosexual, apolítica, de Santo Domingo. 50K seguidores en Instagram. Está explorando diversificar su contenido hacia finanzas. Le importa la estética ante todo.",
    systemPrompt: `Eres Carmen Delgado, 24 años, influencer de lifestyle en Santo Domingo. 50K seguidores. Evalúa si el contenido es lo suficientemente aesthetic para tu feed, si podrías adaptarlo a tu estilo, si tu audiencia lo recibiría bien. La imagen lo es todo para ti.`,
  },
  {
    id: "ricardo_sindical", name: "Ricardo Peña", role: "persona", emoji: "✊", color: "#795548",
    profile: "Hombre, 45 años, líder sindical, heterosexual, de izquierda, de Guayaquil. Desconfía profundamente del sistema financiero. Ve el trading como especulación peligrosa. Usa solo Facebook.",
    systemPrompt: `Eres Ricardo Peña, 45 años, líder sindical en Guayaquil. De izquierda, anti-especulación financiera. Evalúa el contenido desde tu perspectiva crítica: ¿esto beneficia a la gente o solo a los intermediarios?, ¿es ético?, ¿qué diría tu base sindical?. Sé combativo e ideológico.`,
  },
];

const ALL_AGENTS = [...EXPERT_AGENTS, ...PERSONA_AGENTS];

// ── Main handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI Gateway not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { asset_url, asset_type, copy_text, asset_name } = await req.json();

    if (!asset_url && !copy_text) {
      return new Response(
        JSON.stringify({ error: "asset_url or copy_text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build content description for agents
    const contentDesc = [
      `Tipo: ${asset_type || "text"}`,
      asset_name ? `Nombre: ${asset_name}` : "",
      copy_text ? `Copy/Texto: "${copy_text}"` : "",
      asset_url && asset_url !== "text-only" ? `URL del asset: ${asset_url}` : "",
    ].filter(Boolean).join("\n");

    // ── Run all agents in parallel ─────────────────────

    const agentPromises = ALL_AGENTS.map(async (agent) => {
      const userContent: any[] = [];

      // Add image if available
      if ((asset_type === "image" || asset_type === "video") && asset_url && asset_url !== "text-only") {
        userContent.push({ type: "image_url", image_url: { url: asset_url } });
      }

      const evaluationPrompt = agent.role === "expert"
        ? `Analiza el siguiente contenido de marketing para Bullfy (empresa de trading/brokeraje enfocada en LATAM):

${contentDesc}

Evalúa desde tu especialidad y responde EXCLUSIVAMENTE con JSON válido (sin markdown):
{
  "score": <0-100 tu puntuación de calidad/efectividad>,
  "verdict": "<aprobado|aprobado_con_reservas|rechazado>",
  "analysis": "<tu análisis en 3-5 oraciones>",
  "strengths": ["<fortaleza 1>", "<fortaleza 2>"],
  "weaknesses": ["<debilidad 1>", "<debilidad 2>"],
  "suggestions": ["<sugerencia concreta 1>", "<sugerencia concreta 2>"],
  "confidence": <0-100 qué tan seguro estás de tu evaluación>
}`
        : `Imagina que ves este contenido en tus redes sociales o te llega como publicidad:

${contentDesc}

Reacciona como persona real. Responde EXCLUSIVAMENTE con JSON válido (sin markdown):
{
  "score": <0-100 qué tanto te atrae este contenido>,
  "verdict": "<me_encanta|interesante|indiferente|no_me_gusta|me_molesta>",
  "first_reaction": "<tu primera reacción instintiva en 1 oración>",
  "would_click": <true|false>,
  "would_share": <true|false>,
  "would_follow": <true|false>,
  "emotional_response": "<qué emoción te genera: curiosidad, confianza, miedo, aburrimiento, etc>",
  "concerns": ["<preocupación 1 si la hay>"],
  "what_would_improve_it": "<qué cambiarías para que te atrape más>",
  "confidence": <0-100 qué tan seguro estás>
}`;

      userContent.push({ type: "text", text: evaluationPrompt });

      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: `${agent.systemPrompt}\n\nPerfil: ${agent.profile}\n\nResponde siempre en JSON válido sin markdown.` },
              { role: "user", content: userContent },
            ],
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Agent ${agent.id} error:`, res.status, errText);
          return { agent_id: agent.id, error: true, status: res.status };
        }

        const aiData = await res.json();
        const raw = aiData.choices?.[0]?.message?.content || "";
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        let parsed;
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          parsed = { score: 0, raw_text: raw, parse_error: true };
        }

        return { agent_id: agent.id, result: parsed };
      } catch (err) {
        console.error(`Agent ${agent.id} exception:`, err);
        return { agent_id: agent.id, error: true, message: err.message };
      }
    });

    const agentResults = await Promise.all(agentPromises);

    // ── Moderator synthesis ────────────────────────────

    const agentSummaries = agentResults.map((r) => {
      const agent = ALL_AGENTS.find(a => a.id === r.agent_id)!;
      return `[${agent.emoji} ${agent.name} (${agent.role === "expert" ? "Experto: " + agent.id : "Persona"})]:\n${JSON.stringify(r.result || r, null, 1)}`;
    }).join("\n\n");

    const moderatorRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `Eres el Moderador del sistema Bullfy Brain. Recibes los veredictos de ${ALL_AGENTS.length} agentes (expertos y personas) que han analizado un contenido de marketing. Tu trabajo es sintetizar TODO en un veredicto final. Responde en JSON sin markdown.`,
          },
          {
            role: "user",
            content: `Contenido analizado:
${contentDesc}

Veredictos de los agentes:
${agentSummaries}

Sintetiza en JSON válido:
{
  "consensus_score": <0-100 promedio ponderado>,
  "viral_potential": "<bajo|medio|alto|viral>",
  "approval_rate": "<porcentaje de agentes que aprueban/les gusta>",
  "summary": "<resumen ejecutivo de 3-5 oraciones del consenso>",
  "biggest_debate": "<el mayor punto de desacuerdo entre agentes>",
  "expert_consensus": "<qué dicen los expertos en general>",
  "audience_consensus": "<qué dicen las personas/audiencia en general>",
  "deal_breakers": ["<problemas críticos que varios agentes detectaron>"],
  "universal_praise": ["<aspectos que casi todos elogiaron>"],
  "final_recommendations": [
    {"priority": "alta|media|baja", "recommendation": "<acción concreta>"}
  ],
  "predicted_engagement": {
    "instagram": "<bajo|medio|alto|viral>",
    "tiktok": "<bajo|medio|alto|viral>",
    "youtube": "<bajo|medio|alto|viral>",
    "linkedin": "<bajo|medio|alto|viral>",
    "facebook": "<bajo|medio|alto|viral>"
  },
  "best_posting_times": ["<horario sugerido>"],
  "hashtag_suggestions": ["<hashtag>"],
  "target_segments_ranking": [
    {"segment": "<nombre>", "score": <0-100>, "reasoning": "<por qué>"}
  ]
}`,
          },
        ],
      }),
    });

    let moderatorVerdict: any = {};
    if (moderatorRes.ok) {
      const modData = await moderatorRes.json();
      const modRaw = modData.choices?.[0]?.message?.content || "";
      const modCleaned = modRaw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      try {
        moderatorVerdict = JSON.parse(modCleaned);
      } catch {
        moderatorVerdict = { raw: modRaw, parse_error: true };
      }
    } else {
      console.error("Moderator error:", moderatorRes.status, await moderatorRes.text());
    }

    // Build agent map with profiles
    const agentMap = ALL_AGENTS.reduce((acc, a) => {
      const res = agentResults.find(r => r.agent_id === a.id);
      acc[a.id] = {
        name: a.name,
        role: a.role,
        emoji: a.emoji,
        color: a.color,
        profile: a.profile,
        result: res?.result || null,
        error: res?.error || false,
      };
      return acc;
    }, {} as Record<string, any>);

    return new Response(
      JSON.stringify({
        ok: true,
        agent_count: ALL_AGENTS.length,
        agents: agentMap,
        moderator: moderatorVerdict,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("multiagent error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
