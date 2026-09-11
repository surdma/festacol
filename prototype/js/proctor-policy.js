(() => {
  'use strict';

  const ADMIN_POLICY_PREFIX = 'festacol.exam.proctor.v1:';
  const SESSION_POLICY_PREFIX = 'festacol.student.proctor.v1:';

  const bool = (value) => value === true || value === 1 || value === '1' || value === 'true';
  const adminKey = (sessionId) => `${ADMIN_POLICY_PREFIX}${sessionId}`;
  const sessionKey = (sessionId) => `${SESSION_POLICY_PREFIX}${sessionId}`;
  const utf8ToBase64Url = (value) => {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
  };
  const base64UrlToUtf8 = (value) => {
    const normalized = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  };
  const readPayload = (token) => {
    try { return JSON.parse(base64UrlToUtf8(token)); } catch { return null; }
  };
  const writePayload = (payload) => utf8ToBase64Url(JSON.stringify(payload));

  const readJson = (storage, key, fallback) => {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const getAdminPolicy = (sessionId) => {
    if (!sessionId) return { cameraRequired: false };
    const value = readJson(localStorage, adminKey(sessionId), {});
    return { cameraRequired: bool(value?.cameraRequired) };
  };

  const setAdminPolicy = (sessionId, policy = {}) => {
    if (!sessionId) throw new Error('Session id is required for proctoring policy.');
    const normalized = { cameraRequired: bool(policy.cameraRequired), updatedAt: Date.now() };
    localStorage.setItem(adminKey(sessionId), JSON.stringify(normalized));
    return normalized;
  };

  const policyFromUrl = (href = location.href) => {
    const url = new URL(href, location.href);
    const payload = readPayload(url.searchParams.get('session'));
    if (payload && Object.hasOwn(payload, 'p')) return { cameraRequired: payload.p === 1 || payload.p === true };
    const legacyValue = url.searchParams.get('camera');
    if (legacyValue !== null) return { cameraRequired: legacyValue === '1' || legacyValue === 'true' };
    return null;
  };

  const rememberFromUrl = (sessionId, href = location.href) => {
    if (!sessionId) return { cameraRequired: false };
    const fromUrl = policyFromUrl(href);
    if (fromUrl) {
      if (fromUrl.cameraRequired) sessionStorage.setItem(sessionKey(sessionId), '1');
      else sessionStorage.removeItem(sessionKey(sessionId));
      return fromUrl;
    }
    return { cameraRequired: sessionStorage.getItem(sessionKey(sessionId)) === '1' || getAdminPolicy(sessionId).cameraRequired };
  };

  const isCameraRequired = (sessionId, href = location.href) => rememberFromUrl(sessionId, href).cameraRequired;

  const decorateStudentLink = (href, cameraRequired) => {
    const url = new URL(href, location.href);
    const token = url.searchParams.get('session');
    const payload = readPayload(token);
    if (payload) {
      if (cameraRequired) payload.p = 1;
      else delete payload.p;
      url.searchParams.set('session', writePayload(payload));
    }
    url.searchParams.delete('camera');
    return url.href;
  };

  const sessionIdFromLink = (href) => {
    try {
      const token = new URL(href, location.href).searchParams.get('session');
      if (!token || !window.FestacolSessionStore) return '';
      return window.FestacolSessionStore.decodeSession(token).id || '';
    } catch {
      return '';
    }
  };

  window.FestacolProctorPolicy = Object.freeze({
    getAdminPolicy,
    setAdminPolicy,
    policyFromUrl,
    rememberFromUrl,
    isCameraRequired,
    decorateStudentLink,
    sessionIdFromLink
  });
})();
