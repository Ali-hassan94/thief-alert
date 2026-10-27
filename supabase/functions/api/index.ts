import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7?target=deno&deno-std=0.224.0";

const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
try {
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC")!, Deno.env.get("VAPID_PRIVATE")!);
} catch (e) {
  console.error("VAPID setup fail:", e);
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const camel = (r: any) => ({
  id: r.id, photoUrl: r.photo_url, confirms: r.confirms, fakes: r.fakes, myVote: r.my_vote,
  description: r.description, status: r.status, createdAt: r.created_at,
  lat: r.lat, lng: r.lng, distanceM: r.distance_m, mine: r.mine,
});

async function geminiCheck(photo: string) {
  const key = Deno.env.get("GEMINI_KEY");
  if (!key) return null;
  try {
    const buf = new Uint8Array(await (await fetch(photo)).arrayBuffer());
    let bin = ""; for (const b of buf) bin += String.fromCharCode(b);
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: 'Ghar ke bahar ki camera photo. Kya isme koi ASLI zinda insaan hai? Poster, saya, janwar ya khali ho to false. Sirf JSON: {"real_person":true/false,"summary":"Roman Urdu max 15 lafz"}' },
            { inline_data: { mime_type: "image/jpeg", data: btoa(bin) } }] }],
          generationConfig: { response_mime_type: "application/json" } }) });
    const t = (await r.json()).candidates[0].content.parts[0].text;
    return JSON.parse(t) as { real_person: boolean; summary?: string };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "Login zaroori hai." }, 401);
  const uid = u.user.id;

  const path = new URL(req.url).pathname.replace(/^\/(functions\/v1\/)?api/, "");
  const parts = path.split("/").filter(Boolean); // ["alerts", id, action]
  if (parts[0] !== "alerts") return json({ error: "Not found" }, 404);

  try {
    // POST /alerts
    if (req.method === "POST" && parts.length === 1) {
      const b = await req.json();
      if (!(b.lat >= -90 && b.lat <= 90 && b.lng >= -180 && b.lng <= 180))
        return json({ error: "Location sahi nahi hai." }, 400);

      let desc = String(b.description ?? "").trim().slice(0, 300);
      const auto = b.source === "camera";
      let photo: string | null = b.photoUrl ?? null;
      if (photo && !photo.startsWith(`${url}/storage/v1/object/public/snapshots/`)) photo = null;

      if (auto && photo) {
        const c = await geminiCheck(photo);
        if (c && c.real_person === false) return json({ id: null, notified: 0, filtered: true });
        if (c?.summary) desc = `${desc} AI: ${c.summary}`.trim();
      }

      const { data, error } = await admin.rpc("create_alert", {
        p_user: uid, p_lat: b.lat, p_lng: b.lng, p_desc: desc, p_photo: photo, p_auto: auto,
        p_include_sender: Deno.env.get("NOTIFY_SENDER") === "true",
        p_max_hour: auto ? 20 : Number(Deno.env.get("MAX_PER_HOUR") ?? 3),
      });
      if (error) return json({ error: error.message }, 500);
      if (data.error) return json({ error: data.error }, data.code ?? 400);

      let sent = 0; const dead: string[] = [];
      await Promise.all((data.subs as any[]).map(async (s) => {
        const d = s.distance_m < 1000 ? `${s.distance_m} m` : `${(s.distance_m / 1000).toFixed(1)} km`;
        const body = `Aap ke zone me, lagbhag ${d} door chor ka alert. ${desc.slice(0, 100)}`;
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: "🚨 Chor Alert!", body, url: `/alert/${data.id}`, tag: `alert-${data.id}`, image: photo }));
          sent++;
        } catch (e: any) { if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint); }
      }));
      if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);
      await admin.from("alerts").update({ notified_count: sent }).eq("id", data.id);
      return json({ id: data.id, notified: sent });
    }

    // GET /alerts  ya /alerts/:id
    if (req.method === "GET" && parts.length <= 2) {
      const id = parts[1] ?? null;
      const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 7)));
      const { data, error } = await admin.rpc("list_alerts", { p_user: uid, p_days: id ? 90 : days, p_id: id });
      if (error) return json({ error: error.message }, 500);
      if (id) return data.length ? json(camel(data[0])) : json({ error: "Alert nahi mila." }, 404);
      return json(data.map(camel));
    }

    // POST /alerts/:id/resolve  |  /vote
    if (req.method === "POST" && parts.length === 3) {
      const id = parts[1];
      if (parts[2] === "resolve") {
        const { data } = await admin.from("alerts").update({ status: "resolved" })
          .eq("id", id).eq("user_id", uid).select("id");
        return data?.length ? json({ ok: true }) : json({ error: "Alert nahi mila." }, 404);
      }
      if (parts[2] === "vote") {
        const b = await req.json();
        if (!["confirm", "fake"].includes(b.vote)) return json({ error: "Vote galat hai." }, 400);
        const { data: vis } = await admin.rpc("list_alerts", { p_user: uid, p_days: 90, p_id: id });
        if (!vis?.length) return json({ error: "Alert nahi mila." }, 404);
        await admin.from("alert_votes").upsert({ alert_id: id, user_id: uid, vote: b.vote });
        return json({ ok: true });
      }
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});