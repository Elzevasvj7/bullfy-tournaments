// ============================================================================
// Cálculo de comisiones por revenue split (QA Fase 3 / P4a) — redondeo exacto.
// ----------------------------------------------------------------------------
// Antes cada split se redondeaba independientemente con toFixed(2), por lo que
// la suma de las comisiones podía no cuadrar con el total por ±centavos.
//
// computeCommissions reparte `total` según los porcentajes en CENTAVOS y asigna
// el residuo de redondeo al split 'platform' (o, si no existe, al primero), de
// modo que la suma de los montos sea EXACTAMENTE round(total * sumPct/100).
//
// No "compensa" configuraciones que no sumen 100%: solo corrige el sub-centavo
// dentro de lo que los porcentajes asignan (sumPct). El enforcement de suma=100
// se hace aparte (P4b). Así es seguro aunque hoy haya splits mal configurados.
// ============================================================================

export interface RevenueSplit {
  role_label: string;
  percentage: number | string;
}

export function computeCommissions(
  total: number | string,
  splits: RevenueSplit[],
): { role_label: string; amount: number }[] {
  if (!splits || splits.length === 0) return [];
  const cents = Math.round(Number(total) * 100);
  const sumPct = splits.reduce((s, r) => s + Number(r.percentage), 0);
  const targetCents = Math.round((cents * sumPct) / 100);

  const out = splits.map((s) => ({
    role_label: s.role_label,
    cents: Math.round((cents * Number(s.percentage)) / 100),
  }));

  const allocated = out.reduce((s, r) => s + r.cents, 0);
  const diff = targetCents - allocated;
  if (diff !== 0) {
    // El residuo lo absorbe 'platform'. Pero si platform no existe o quedaría
    // NEGATIVO (config anómala: platform ~0% y los demás redondean hacia arriba),
    // se asigna al split con más centavos (siempre puede absorber el sub-centavo
    // sin quedar negativo). Garantiza suma exacta y montos no negativos.
    let idx = out.findIndex((o) => o.role_label === "platform");
    if (idx < 0 || out[idx].cents + diff < 0) {
      idx = out.reduce((mi, o, i, arr) => (o.cents > arr[mi].cents ? i : mi), 0);
    }
    out[idx].cents += diff;
  }

  return out.map((o) => ({ role_label: o.role_label, amount: +(o.cents / 100).toFixed(2) }));
}
