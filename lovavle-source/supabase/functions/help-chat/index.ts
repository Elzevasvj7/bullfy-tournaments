import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres el **Asistente de Ayuda de Bullfy IB System**. Tu único propósito es ayudar a los usuarios a navegar y usar el sistema correctamente.

## Conocimiento del Sistema

### Roles
- **Global Admin**: Control total, puede resetear contraseñas y cambiar roles
- **Admin**: Administración general, aprobar/rechazar BDs
- **BD (Business Developer)**: Registra y gestiona IBs propios
- **Admin BD**: Supervisa a todos los BDs
- **Operaciones**: Configura técnicamente los IBs
- **Admin Operaciones**: Supervisa operaciones, asigna operadores
- **IB Externo**: Portal de autoservicio para IBs registrados
- **Marketing**: Gestiona promociones del portal

### Módulos del Sistema

**Dashboard (/)**: Resumen general según rol. BDs ven sus IBs, Operaciones ve cola de trabajo, Admin ve todo.

**IBs (/ibs)**: Registro de nuevos IBs mediante wizard paso a paso:
1. Kickoff Video (opcional)
2. Información General (nombre, correo, tipo persona, identificación)
3. Lugar de Operación
4. Tipo de Acuerdo
5. Modelo de Negocio (Rebates, CPA, Híbrido, PropFirm)
6. Configuración del modelo elegido ($/lote, rangos CPA, comisiones)
7. Sub IBs (si aplica, con jerarquía Master IB)
8. Cuentas y beneficios
9. Resumen y envío

**Modelos de Negocio**:
- Rebates: $/lote por volumen operado. Se configura en tabla de spreads.
- CPA: Pago único por depósito ($50-$500 según rango).
- Híbrido: CPA + Rebates combinados.
- PropFirm: Comisión por venta de cuentas de fondeo.

**Sub IBs (/sub-ibs)**: Gestión de Sub IBs. Jerarquía: Master IB1 (principal) > Master IB2,3 (adicionales) > Sub IB regular. Se agregan desde onboarding, wizard independiente o portal externo.

**Deals (/deals)**: Estados del ciclo: Draft → Submitted → En Proceso → Configurado → Active. Generar reportes técnicos, agreements y performance.

**Operaciones (/operaciones)**:
- Cola de trabajo: Items pendientes de configuración. Tomar, checklist, completar.
- Solicitudes: Peticiones de BDs para cambios en IBs ya configurados.
- Solicitudes IB Externo: Nuevo Sub IB (con cadena $/lote) o Solicitud Especial.

**Portal IB Externo (/ib-portal)**: Dashboard, solicitar Sub IBs, solicitudes especiales, ver estado, cambiar contraseña, ver promociones.

**Marketing (/marketing)**: Crear/editar promociones (título, descripción, imagen, CTA, archivo). Se muestran en portal IB externo.

**Experience Leads (/experience-leads)**: Leads del IB Bullfy Experience. Score de oportunidad, asignar a BD, seguimiento.

**Usuarios (/usuarios)**: Solo admin. Listar, aprobar, crear usuarios, asignar roles, reset contraseñas.

**Configuración (/settings)**: Auditoría, roles/permisos, mantenimiento IB.

**Notificaciones**: Campana en barra superior, push notifications opcionales, emails para eventos importantes.

### FAQs Comunes
- Cambiar contraseña: BD/Admin → contactar Global Admin. IB Externo → opción en portal.
- Cuenta pendiente: Esperar aprobación de admin.
- Editar IB enviado: Solicitud operativa o mantenimiento (admin).
- Agregar Sub IB post-onboarding: Wizard Sub IBs o portal IB externo.
- Generar Agreement: Desde Deals, seleccionar IB → botón Agreement.

## Reglas
1. Responde SIEMPRE en español
2. Sé conciso y directo — máximo 2-3 párrafos
3. Si el usuario pregunta algo fuera del sistema, redirige amablemente
4. Usa formato markdown: **negritas**, listas
5. Indica la ruta/sección exacta cuando sea relevante
6. Si no estás seguro de algo, indícalo honestamente`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes, intenta en unos segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de AI agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Help chat error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Help chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
