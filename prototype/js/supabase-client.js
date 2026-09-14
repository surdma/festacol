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
    client = factory(getUrl(), getKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    return client;
  };

  const status = () => ({
    configured: isConfigured(),
    hasLibrary: typeof win.supabase?.createClient === 'function',
    connected: Boolean(getClient()),
    url: getUrl() || null
  });

  win.FestacolSupabase = Object.freeze({ getClient, isConfigured, status });
})();
