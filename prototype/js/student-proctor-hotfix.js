(() => {
  'use strict';

  const Store = window.FestacolSessionStore;
  const Policy = window.FestacolProctorPolicy;
  if (!Store || !Policy) throw new Error('Festacol student proctoring dependencies are unavailable.');

  const url = new URL(location.href);
  const token = url.searchParams.get('session');
  let sessionId = '';
  try { if (token) sessionId = Store.decodeSession(token).id; } catch { sessionId = ''; }
  const cameraRequired = sessionId ? Policy.rememberFromUrl(sessionId, location.href).cameraRequired : false;

  let scheduled = false;
  const enhance = () => {
    document.querySelectorAll('[data-enter-exam]').forEach((anchor) => {
      anchor.href = Policy.decorateStudentLink(anchor.href, cameraRequired);
    });

    document.querySelectorAll('p').forEach((node) => {
      if (node.dataset.timerPolicyUpdated) return;
      if (/Leaving before submission pauses your remaining time/i.test(node.textContent || '')) {
        node.dataset.timerPolicyUpdated = 'true';
        node.textContent = 'Attempt 1 of 1 · Closing or leaving the exam saves your remaining time. Switching tabs, minimizing, or backgrounding does not pause the timer and is recorded as an integrity event.';
      }
    });

    const feature = document.querySelector('.session-feature');
    if (feature && cameraRequired && !feature.querySelector('[data-camera-required-note]')) {
      const note = document.createElement('div');
      note.dataset.cameraRequiredNote = 'true';
      note.className = 'alert alert-info mt-5';
      note.innerHTML = '<strong>Camera required for this exam</strong><span>You will be asked for camera permission before the assessment begins. This prototype shows a local preview only and does not record or automatically analyse video.</span>';
      feature.querySelector('.max-w-3xl')?.append(note);
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; enhance(); });
  };

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
})();
