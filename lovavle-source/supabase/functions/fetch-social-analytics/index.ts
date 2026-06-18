// Triggered by pg_cron every 6 hrs. For each published publication created in
// the last 30 days, refresh metrics from IG/TikTok/YouTube.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const respond = (p: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function fetchInstagram(accessToken: string, mediaId: string) {
  const r = await fetch(
    `https://graph.instagram.com/${mediaId}/insights?metric=plays,likes,comments,shares,reach&access_token=${accessToken}`
  );
  const data = await r.json();
  if (!data?.data) return null;
  const get = (n: string) => data.data.find((d: any) => d.name === n)?.values?.[0]?.value ?? 0;
  return { views: get("plays"), likes: get("likes"), comments: get("comments"), shares: get("shares"), reach: get("reach") };
}

async function fetchYouTube(accessToken: string, videoId: string) {
  const r = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await r.json();
  const s = data?.items?.[0]?.statistics;
  if (!s) return null;
  return {
    views: Number(s.viewCount || 0),
    likes: Number(s.likeCount || 0),
    comments: Number(s.commentCount || 0),
  };
}

async function fetchTikTok(accessToken: string, postId: string) {
  if (!postId || postId === "pending") return null;
  const r = await fetch("https://open.tiktokapis.com/v2/video/query/", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: { video_ids: [postId] },
      fields: ["id", "view_count", "like_count", "comment_count", "share_count"],
    }),
  });
  const data = await r.json();
  const v = data?.data?.videos?.[0];
  if (!v) return null;
  return {
    views: v.view_count || 0,
    likes: v.like_count || 0,
    comments: v.comment_count || 0,
    shares: v.share_count || 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const pubRes = await fetch(
      `${supabaseUrl}/rest/v1/social_publications?status=eq.published&published_at=gte.${sinceIso}&post_id=not.is.null&select=*&limit=200`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const pubs: any[] = await pubRes.json();
    if (!pubs?.length) return respond({ ok: true, updated: 0 });

    let updated = 0;
    for (const pub of pubs) {
      const cRes = await fetch(
        `${supabaseUrl}/rest/v1/social_connections?id=eq.${pub.social_connection_id}&select=*`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      const conn = (await cRes.json())?.[0];
      if (!conn?.access_token_encrypted) continue;

      let metrics: any = null;
      try {
        if (conn.platform === "instagram") metrics = await fetchInstagram(conn.access_token_encrypted, pub.post_id);
        else if (conn.platform === "youtube") metrics = await fetchYouTube(conn.access_token_encrypted, pub.post_id);
        else if (conn.platform === "tiktok") metrics = await fetchTikTok(conn.access_token_encrypted, pub.post_id);
      } catch (e) {
        console.warn(`metrics fetch failed for ${pub.id}:`, e);
        continue;
      }

      if (!metrics) continue;

      await fetch(`${supabaseUrl}/rest/v1/social_publications?id=eq.${pub.id}`, {
        method: "PATCH",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ metrics: { ...metrics, fetched_at: new Date().toISOString() } }),
      });
      updated++;
    }

    return respond({ ok: true, updated, total: pubs.length });
  } catch (e) {
    console.error("fetch-social-analytics error:", e);
    return respond({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
