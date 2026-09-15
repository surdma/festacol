(() => {
  'use strict';
  // Legacy compatibility alias — delegates to the Supabase-backed shared runtime.
  // No localStorage / sessionStorage usage. All policy IO is async.
  const getProctor = () => {
    const p = window.Festacol?.proctor;
    if (!p) throw new Error('Festacol shared proctor is unavailable.');
    return p;
  };
  window.FestacolProctorPolicy = new Proxy({}, { get: (_t, prop) => getProctor()[prop], has: (_t, prop) => prop in getProctor() });
})();
