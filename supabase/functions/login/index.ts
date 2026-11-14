// Pikki's Info: sign in with a username + password.
// Looks up the account's email server-side (never returned to the browser), then does a
// normal password sign-in and returns the session tokens. Deployed with verify_jwt = false
// because the site calls it with the publishable key, before the user has a session.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
const BAD = { error: 'Wrong username or password.' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let username = '', password = '';
  try {
    const b = await req.json();
    username = String(b?.username ?? '').trim().toLowerCase();
    password = String(b?.password ?? '');
  } catch { return json({ error: 'Bad request' }, 400); }
  if (!USERNAME_RE.test(username) || !password || password.length > 200) return json(BAD, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: email, error } = await admin.rpc('login_email_for_username', { p_username: username });
  if (error) { console.error('lookup failed', error.message); return json({ error: 'Sign-in is unavailable right now.' }, 500); }
  if (!email) {
    await new Promise(r => setTimeout(r, 300 + Math.random() * 300)); // don't reveal which usernames exist
    return json(BAD, 400);
  }

  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
  const { data, error: signErr } = await anon.auth.signInWithPassword({ email: email as string, password });
  if (signErr || !data.session) {
    if (signErr && /rate limit/i.test(signErr.message)) return json({ error: 'Too many attempts. Please wait a few minutes.' }, 429);
    return json(BAD, 400);
  }
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
