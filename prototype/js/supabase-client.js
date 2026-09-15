(() => {
  'use strict';
  // Lightweight Supabase client bootstrap for the static prototype.
  // Requires: supabase-js UMD (window.supabase.createClient) + js/supabase-config.js
  // Exposes: window.FestacolSupabase = { client, isConfigured(), status() }
  // No localStorage/sessionStorage usage. Configuration lives only in memory.
  const global = globalThis;
  const win = global.window || global;

  const getUrl = () => String(win.FESTACOL_SUPABASE_URL || '').trim();
  const getKey = () => String(win.FESTACOL_SUPABASE_ANON_KEY || '').trim();

  const isConfigured = () => {
    const url = getUrl();
    const key = getKey();
    if (!url || !key) return false;
    if (key === 'PASTE_SUPABASE_ANON_KEY_HERE') return false;
    return /^https:\/\/.+\.supabase\.co\/?$/u.test(url.replace(/\/+$/u, '')) || /^https?:\/\//u.test(url);
  };

  let client = null;
  const getClient = () => {
    if (client) return client;
    if (!isConfigured()) return null;
    const factory = win.supabase?.createClient;
    if (typeof factory !== 'function') return null;
    // Session MUST persist: the prototype spans multiple page loads
    // (student.html -> exam.html -> index.html), and a memory-only session
    // is wiped on every navigation/reload, causing login loops.
    // Persistence is handled internally by supabase-js; app pointers
    // (currentAuthHash, active candidates) stay memory-only per contract.
    client = factory(getUrl(), getKey(), {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return client;
  };

  const status = () => ({
    configured: isConfigured(),
    hasLibrary: typeof win.supabase?.createClient === 'function',
    connected: Boolean(getClient()),
    url: getUrl() || null
  });

  // Authenticated access (required: RLS denies anon). Students use the same
  // derived credentials as the Next.js app: synthetic email + fst:hash.
  const studentEmailFor = (first, last) => {
    const clean = (v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/gu, '.').replace(/^\.+|\.+$/gu, '').slice(0, 40) || 'student';
    return `${clean(first)}.${clean(last)}.student@festacol.local`;
  };
  const signInStudent = async (first, last, studentHash) => {
    const client = getClient();
    if (!client) throw new Error('Supabase is not configured.');
    const { error } = await client.auth.signInWithPassword({
      email: studentEmailFor(first, last), password: `fst:${studentHash}`,
    });
    if (error) throw new Error('No provisioned login for these names yet — sign in through the main app once to activate this device.');
  };
  const signInAdmin = async (email, password) => {
    const client = getClient();
    if (!client) throw new Error('Supabase is not configured.');
    const { error } = await client.auth.signInWithPassword({ email: String(email || '').trim(), password: String(password || '') });
    if (error) throw error;
    const role = await currentRole();
    if (role !== 'administrator' && role !== 'teacher') {
      await client.auth.signOut();
      throw new Error('This account has no staff access.');
    }
    return role;
  };
  const currentRole = async () => {
    const client = getClient();
    if (!client) return '';
    const { data } = await client.auth.getUser();
    return data.user?.app_metadata?.role || data.user?.user_metadata?.role || '';
  };
  const signOut = async () => { await getClient()?.auth.signOut(); };

  win.FestacolSupabase = Object.freeze({ getClient, isConfigured, status, signInStudent, signInAdmin, currentRole, signOut });
})();
