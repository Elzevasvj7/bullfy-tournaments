import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Card {
  id: string;
  alias: string;
  last4: string;
  card_type: "debit" | "credit";
  brand: string;
}

interface Props {
  /** User whose cards to show. If null, shows none. */
  userId: string | null;
  value: string;            // card id or "__none__"
  onChange: (v: string) => void;
  label?: string;
  /** Optional fallback id to keep selected even if not in list (e.g. card belongs to another user). */
  fallbackCardLabel?: string | null;
}

const TYPE_LABEL: Record<string, string> = { debit: "Débito", credit: "Crédito" };

export default function CardSelect({ userId, value, onChange, label = "Tarjeta usada", fallbackCardLabel }: Props) {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    if (!userId) { setCards([]); return; }
    supabase.from("accounting_cards")
      .select("id,alias,last4,card_type,brand")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("alias")
      .then(({ data }) => setCards((data ?? []) as Card[]));
  }, [userId]);

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={!userId}>
        <SelectTrigger><SelectValue placeholder={userId ? "—" : "Selecciona un usuario primero"} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Sin tarjeta —</SelectItem>
          {value !== "__none__" && !cards.some(c => c.id === value) && fallbackCardLabel && (
            <SelectItem value={value}>{fallbackCardLabel} (actual)</SelectItem>
          )}
          {cards.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.alias} · ****{c.last4} ({c.brand} {TYPE_LABEL[c.card_type]})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {userId && cards.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Este usuario no tiene tarjetas asignadas. Configúralas en Contabilidad → Tarjetas.
        </p>
      )}
    </div>
  );
}
