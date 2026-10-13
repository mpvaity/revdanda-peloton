// Public stats for the Home page. Returns totals and first names only, never tokens or raw data.
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

// India Standard Time is UTC+5:30. Weeks start on Monday, months on the 1st.
const IST_OFFSET = 5.5 * 3600 * 1000;
function monthStart(now) {
  const i = new Date(now.getTime() + IST_OFFSET);
  return new Date(Date.UTC(i.getUTCFullYear(), i.getUTCMonth(), 1) - IST_OFFSET);
}
function weekStart(now) {
  const i = new Date(now.getTime() + IST_OFFSET);
  const daysSinceMonday = (i.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(i.getUTCFullYear(), i.getUTCMonth(), i.getUTCDate() - daysSinceMonday) - IST_OFFSET);
}

exports.handler = async () => {
  const now = new Date();
  const from = monthStart(now).toISOString();
  const url = SB + "/rest/v1/strava_rides?select=rider,distance_m,title,seen_at&seen_at=gte." +
    encodeURIComponent(from) + "&order=seen_at.desc&limit=1000";
  const r = await fetch(url, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
  if (!r.ok) return { statusCode: 500, body: JSON.stringify({ error: "stats unavailable" }) };
  const rows = await r.json();

  const weekFrom = weekStart(now);
  const monthKm = rows.reduce((sum, x) => sum + x.distance_m / 1000, 0);
  const byRider = {};
  rows.filter((x) => new Date(x.seen_at) >= weekFrom).forEach((x) => {
    byRider[x.rider] = (byRider[x.rider] || 0) + x.distance_m / 1000;
  });
  const top = Object.entries(byRider)
    .map(([rider, km]) => ({ rider, km }))
    .sort((a, b) => b.km - a.km)
    .slice(0, 5);
  const latest = rows.slice(0, 5).map((x) => ({ rider: x.rider, km: x.distance_m / 1000, title: x.title || "Ride" }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
    body: JSON.stringify({ month: { km: monthKm, rides: rows.length }, week: { top }, latest })
  };
};
