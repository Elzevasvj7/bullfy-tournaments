import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface Props {
  participantId: string;
  positive: boolean;
}

export default function EquitySparkline({ participantId, positive }: Props) {
  const [data, setData] = useState<{ v: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("tournament_equity_snapshots")
        .select("equity, captured_at")
        .eq("participant_id", participantId)
        .order("captured_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const arr = (rows || []).reverse().map((r: any) => ({ v: Number(r.equity) || 0 }));
      setData(arr);
    })();
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  if (data.length < 2) {
    return <div className="h-8 w-20 opacity-30 text-[10px] flex items-center justify-center">—</div>;
  }

  const color = positive ? "#4ade80" : "#f87171";
  const gradId = `spark-${participantId.slice(0, 8)}`;

  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.6} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
