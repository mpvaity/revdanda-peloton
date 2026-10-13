// Step 1 (admin, once): visit /.netlify/functions/strava-start to connect the club account
exports.handler = async () => {
  const redirect = process.env.SITE_URL + "/.netlify/functions/strava-callback";
  const url =
    "https://www.strava.com/oauth/authorize?client_id=" + process.env.STRAVA_CLIENT_ID +
    "&response_type=code&redirect_uri=" + encodeURIComponent(redirect) +
    "&approval_prompt=auto&scope=read,activity:read";
  return { statusCode: 302, headers: { Location: url } };
};
