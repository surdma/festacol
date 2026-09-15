(() => {
  'use strict';
  // Legacy compatibility alias — question bank helpers delegate to shared runtime.
  // Teacher-authored questions and seed overrides now live in Supabase.
  const getQuestions = () => {
    const q = window.Festacol?.questions;
    if (!q) throw new Error('Festacol shared questions are unavailable.');
    return q;
  };
  window.FestacolQuestionData = new Proxy({}, { get: (_t, prop) => getQuestions()[prop], has: (_t, prop) => prop in getQuestions() });
})();
