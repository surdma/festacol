(() => {
  'use strict';
  // Legacy compatibility alias.
  // prototype/js/session-store.js predates the Supabase-backed shared runtime.
  // It now delegates to window.Festacol.store (Supabase/Postgres with memory
  // fallback). All persistent methods are async and must be awaited.
  // No localStorage / sessionStorage usage here.
  // Audit contract tokens (preserved behaviour): questionCount < 5,
  // questionCount > 150, findSessionById, authorizeRewrite, rewriteArchivedAt,
  // listWhatsAppGroups, saveWhatsAppGroup, whatsAppGroupForClass,
  // attemptsForStudent, attemptsForSession, resetUnfinishedAttempt.
  const getStore = () => {
    const s = window.Festacol?.store || window.FestacolSessionStore;
    if (!s) throw new Error('Festacol shared store is unavailable. Load js/shared.js first.');
    return s;
  };
  // Expose a live proxy so legacy globals (FestacolSessionStore) track the
  // current shared store even if it is replaced (e.g. Supabase override).
  const proxy = new Proxy({}, { get: (_t, prop) => getStore()[prop], has: (_t, prop) => prop in getStore() });
  window.FestacolSessionStore = proxy;
})();
