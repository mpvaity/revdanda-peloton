// Runs every hour (and can be run by hand). Pulls the club feed and saves new rides to Supabase.
const crypto = require("crypto");
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

async function getAuth() {
  const r = await fetch(SB + "/rest/v1/strava_auth?id=eq.1&select=*", { headers: H });
  const rows = await r.json();
  return rows[0];
}

async function saveAuth(a) {
  await fetch(SB + "/rest/v1/strava_auth?on_conflict=id", {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([{ id: 1, ...a }])
  });
}

async function accessToken() {
  const a = await getAuth();
  if (!a) throw new Error("Strava is not connected yet. Visit the connect link first.");
  const now = Math.floor(Date.now() / 1000);
  if (a.access_token && a.expires_at && a.expires_at - now > 300) return a.access_token;

  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: a.refresh_token
    })
  });
  const t = await r.json();
  if (!r.ok) throw new Error("Token refresh failed. Reconnect Strava.");
  // Strava rotates refresh tokens, so the new one must be saved
  await saveAuth({ refresh_token: t.refresh_token, access_token: t.access_token, expires_at: t.expires_at });
  return t.access_token;
}

exports.handler = async () => {
  try {
    const token = await accessToken();
    const r = await fetch("https://www.strava.com/api/v3/clubs/" + process.env.CLUB_ID + "/activities?per_page=200", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!r.ok) throw new Error("Strava club feed returned " + r.status);
    const acts = await r.json();

    // Club feed has no activity ID or date, so a fingerprint is used to avoid duplicates
    const rows = acts.map((a) => {
      const first = (a.athlete && a.athlete.firstname) || "Rider";
      const lastInitial = a.athlete && a.athlete.lastname ? a.athlete.lastname[0] + "." : "";
      const rider = (first + " " + lastInitial).trim();
      const key = [rider, a.distance, a.moving_time, a.name].join("|");
      return {
        id: crypto.createHash("sha1").update(key).digest("hex"),
        rider,
        distance_m: Math.round(a.distance || 0),
        moving_s: a.moving_time || 0,
        title: a.name || "Ride",
        sport: a.sport_type || a.type || ""
      };
    });

    if (rows.length) {
      await fetch(SB + "/rest/v1/strava_rides", {
        method: "POST",
        headers: { ...H, Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify(rows)
      });
    }
    return { statusCode: 200, body: JSON.stringify({ feed_items: acts.length, checked: rows.length }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

exports.config = { schedule: "@hourly" };
