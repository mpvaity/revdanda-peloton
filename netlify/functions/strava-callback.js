// Step 2: Strava sends the admin back here with a code, which is swapped for tokens and stored safely
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  const code = event.queryStringParameters && event.queryStringParameters.code;
  if (!code) return { statusCode: 400, body: "Missing code" };

  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code"
    })
  });
  const t = await r.json();
  if (!r.ok) return { statusCode: 500, body: "Strava connection failed. Try the connect link again." };

  await fetch(SB + "/rest/v1/strava_auth?on_conflict=id", {
    method: "POST",
    headers: {
      apikey: KEY, Authorization: "Bearer " + KEY,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify([{ id: 1, refresh_token: t.refresh_token, access_token: t.access_token, expires_at: t.expires_at }])
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: "<h2 style='font-family:Georgia'>Strava connected</h2><p style='font-family:Georgia'>You can close this page. Club stats will start updating within the hour.</p>"
  };
};
