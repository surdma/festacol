(() => {
  'use strict';

  const { store, questions, assessment, proctor, utils } = window.Festacol || {};
  const root = document.getElementById('app');
  if (!store || !questions || !assessment || !proctor || !utils || !root) {
    throw new Error('Festacol student dependencies are unavailable.');
  }

  const ART = Object.freeze({
    question: 'https://raw.githubusercontent.com/themesberg/flowbite-illustrations/main/src/3d/light/man-question-marks.svg'
  });
  const PAGES = new Set(['home', 'exams', 'analytics', 'history', 'progress', 'profile']);
  const url = new URL(location.href);
  const token = url.searchParams.get('session');
  let page = PAGES.has(url.searchParams.get('page')) ? url.searchParams.get('page') : 'home';
  let session = null;
  let sessionError = '';
  let lastDialogFocus = null;
  let lastMenuFocus = null;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const badgeClasses = Object.freeze({
    brand: 'inline-flex min-h-7 items-center rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white',
    neutral: 'inline-flex min-h-7 items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700',
    success: 'inline-flex min-h-7 items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200',
    warning: 'inline-flex min-h-7 items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200'
  });
  const fieldClass = 'mt-2 block min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-950 shadow-sm outline-none transition focus:border-neutral-950 focus:ring-4 focus:ring-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500';
  const primaryButton = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus:outline-none focus:ring-4 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';
  const cardClass = 'rounded-2xl border border-neutral-200 bg-white shadow-sm';
  const raisedCardClass = 'rounded-2xl border border-neutral-200 bg-white shadow-lg shadow-neutral-950/5';
  const eyebrowClass = 'text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500';

  try {
    if (token) session = store.resolveSession(store.decodeSession(token));
  } catch (failure) {
    sessionError = failure.message;
  }

  const profile = () => store.getStudentProfile();
  const portalAuthed = () => {
    const current = profile();
    return Boolean(current?.studentHash && store.getStudentAuth() === current.studentHash);
  };
  const attempts = () => {
    const current = profile();
    return current?.studentHash ? store.attemptsForStudent(current.studentHash) : [];
  };
  const answerUnlocked = (attempt) => {
    const source = store.listSessions().find((item) => item.id === attempt.sessionId) || session;
    return assessment.answersMayBeRevealed(source, source?.status);
  };
  const navHref = (next) => utils.routeUrl('student', { page: next }, location.href);
  const examHref = () => utils.routeUrl('exam', { session: token || undefined }, location.href);
  const badge = (text, tone = 'neutral') => `<span class="${badgeClasses[tone] || badgeClasses.neutral}">${escapeHtml(text)}</span>`;

  const navItems = Object.freeze([
    ['home', 'Dashboard'],
    ['exams', 'My exams'],
    ['analytics', 'Analytics'],
    ['history', 'Exam history'],
    ['progress', 'Progress & promotion'],
    ['profile', 'Profile']
  ]);

  const examAccessMarkup = () => `
    <button id="exam-id-launch" type="button" class="${primaryButton} fixed bottom-4 right-4 z-40 shadow-xl sm:bottom-6 sm:right-6">Enter exam ID</button>
    <dialog id="exam-id-dialog" aria-labelledby="exam-id-title" class="w-[calc(100%_-_1.5rem)] max-w-lg rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-950 shadow-2xl backdrop:bg-neutral-950/50 backdrop:backdrop-blur-sm sm:w-[calc(100%_-_3rem)]">
      <form id="exam-id-form" class="p-5 sm:p-6">
        <div class="flex items-start gap-4">
          <div class="min-w-0 flex-1">
            <p class="${eyebrowClass}">Manual exam access</p>
            <h2 id="exam-id-title" class="mt-1 font-display text-2xl font-extrabold text-neutral-950">Enter the Exam ID.</h2>
            <p class="mt-2 text-sm leading-6 text-neutral-600">Use the ID shown below the QR code by your school if you cannot scan it.</p>
          </div>
          <button id="exam-id-close" type="button" class="grid size-11 shrink-0 place-items-center rounded-xl border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-4 focus:ring-neutral-200 motion-reduce:transition-none" aria-label="Close Exam ID dialog">Close</button>
        </div>
        <label for="exam-id-input" class="mt-6 block text-sm font-semibold text-neutral-800">Exam ID</label>
        <input id="exam-id-input" class="${fieldClass} font-mono uppercase tracking-[.12em]" maxlength="20" autocomplete="off" placeholder="e.g. A1B2C3D4" required>
        <div id="exam-id-error" class="mt-3 hidden rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert"></div>
        <button class="${primaryButton} mt-5 w-full" type="submit">Open examination</button>
      </form>
    </dialog>`;

  const gate = (message = '') => `
    <main class="min-h-dvh bg-neutral-100 p-4 sm:p-7">
      <div class="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl sm:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[.85fr_1.15fr]">
        <section class="flex flex-col justify-between bg-neutral-950 p-7 text-white sm:p-10">
          <div class="flex items-center gap-3"><span class="grid size-11 place-items-center rounded-xl bg-white text-sm font-black text-black">F</span><div><strong class="block font-display text-sm font-extrabold">Festacol</strong><span class="text-xs text-neutral-400">Student portal</span></div></div>
          <div class="py-12"><p class="text-xs font-extrabold uppercase tracking-[.18em] text-neutral-500">Private student workspace</p><h1 class="mt-4 font-display text-4xl font-extrabold leading-tight sm:text-5xl">Your exams, results and progress stay behind sign in.</h1><p class="mt-5 max-w-sm text-base leading-7 text-neutral-400">Candidates must authenticate before the academic dashboard becomes available.</p></div>
          <span class="text-xs text-neutral-500">${escapeHtml(store.ACADEMIC_SESSION)} academic session</span>
        </section>
        <section class="flex items-center p-7 sm:p-11">
          <div class="mx-auto w-full max-w-xl">
            ${badge('Student authentication', 'brand')}
            <h2 class="mt-4 font-display text-3xl font-extrabold text-neutral-950">Sign in with your candidate credentials.</h2>
            <p class="mt-3 text-base leading-7 text-neutral-600">Your first name is your username and your last name is your password.${session ? ' After sign in, Festacol will open the exact examination from your link.' : ''}</p>
            ${message ? `<div class="mt-5 rounded-x²È="25…Á•!Ñµ°¡ÕÉÉ•¹Ðü¹™¥ÉÍÑ9…µ”ñð€œœ¥ôˆ‘¥Í…‰±•øð½‘¥Øøñ‘¥Øøñ±…‰•°™½Èô‰ÁÉ½™¥±”µ±…ÍÐµ¹…µ”ˆ±…ÍÌô‰Ñ•áÐµÍ´™½¹ÐµÍ•µ¥‰½±ˆù1…ÍÐ¹…µ”ð½±…‰•°øñ¥¹ÁÕÐ¥ô‰ÁÉ½™¥±”µ±…ÍÐµ¹…µ”ˆ±…ÍÌôˆ‘í™¥•±‘±…ÍÍôˆÙ…±Õ”ôˆ‘í•Í…Á•!Ñµ°¡ÕÉÉ•¹Ðü¹±…ÍÑ9…µ”ñð€œœ¥ôˆ‘¥Í…‰±•øð½‘¥Øøñ‘¥Øøñ±…‰•°™½Èô‰ÁÉ½™¥±”µÕ…É‘¥…¸ˆ±…ÍÌô‰Ñ•áÐµÍ´™½¹ÐµÍ•µ¥‰½±ˆùÕ…É‘¥…¸ð½±…‰•°øñ¥¹ÁÕÐ¥ô‰ÁÉ½™¥±”µÕ…É‘¥…¸ˆ±…ÍÌôˆ‘í™¥•±‘±…ÍÍôˆÙ…±Õ”ôˆ‘í•Í…Á•!Ñµ°¡ÕÉÉ•¹Ðü¹Õ…É‘¥…¸ñð€œœ¥ôˆøð½‘¥Øøñ‘¥Øøñ±…‰•°™½Èô‰ÁÉ½™¥±”µÁ¡½¹”ˆ±…ÍÌô‰Ñ•áÐµÍ´™½¹ÐµÍ•µ¥‰½±ˆùA¡½¹”ð½±…‰•°øñ¥¹ÁÕÐ¥ô‰ÁÉ½™¥±”µÁ¡½¹”ˆ±…ÍÌôˆ‘í™¥•±‘±…ÍÍôˆÙ…±Õ”ôˆ‘í•Í…Á•!Ñµ°¡ÕÉÉ•¹Ðü¹Á¡½¹”ñð€œœ¥ôˆøð½‘¥Øøñ‰ÕÑÑ½¸±…ÍÌôˆ‘íÁÉ¥µ…Éå	ÕÑÑ½¹ôÍ´é½°µÍÁ…¸´ÈˆÑåÁ”ô‰ÍÕ‰µ¥ÐˆùM…Ù”ÁÉ½™¥±”ð½‰ÕÑÑ½¸øð½™½É´øð½Í•Ñ¥½¸ù€ì(€ôì((€½¹ÍÐÉ•¹‘•È€ô€ ¤€ôøì(€€€±•Ð½¹Ñ•¹Ðì(€€€¥˜€¡Í•ÍÍ¥½¹ÉÉ½È¤½¹Ñ•¹Ð€ô…Ñ”¡Í•ÍÍ¥½¹ÉÉ½È¤ì(€€€•±Í”¥˜€ …Á½ÉÑ…±ÕÑ¡• ¤¤½¹Ñ•¹Ð€ô…Ñ” ¤ì(€€€•±Í”¥˜€¡Í•ÍÍ¥½¸¤ì(€€€€€±½…Ñ¥½¸¹É•Á±…”¡•á…µ!É•˜ ¤¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô•±Í”ì(€€€€€½¹ÍÐÁ…•I•¹‘•É•È€ôì¡½µ”è‘…Í¡‰½…É°•á…µÌè•á…µÍA…”°…¹…±åÑ¥Ìè…¹…±åÑ¥ÍA…”°¡¥ÍÑ½Éäè¡¥ÍÑ½ÉåA…”°ÁÉ½É•ÍÌèÁÉ½É•ÍÍA…”°ÁÉ½™¥±”èÁÉ½™¥±•A…”õmÁ…•tì(€€€€€½¹Ñ•¹Ð€ôÍ¡•±°¡Á…•I•¹‘•É•È ¤¤ì(€€€ô(€€€É½½Ð¹¥¹¹•É!Q50€ô€‘í½¹Ñ•¹Ñô‘í•á…µ•ÍÍ5…É­ÕÀ ¥õ€ì(€€€‰¥¹‘½µµ½¸ ¤ì(€€€¥˜€¡Á½ÉÑ…±ÕÑ¡• ¤€˜˜€…Í•ÍÍ¥½¸¤‰¥¹‘A½ÉÑ…° ¤ì(€€€•±Í”‰¥¹‘…Ñ” ¤ì(€ôì((€½¹ÍÐ‰¥¹‘…Ñ”€ô€ ¤€ôøì(€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹Ðµ±½¥¸µ™½É´œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ÍÕ‰µ¥Ðœ°…Íå¹Œ€¡•Ù•¹Ð¤€ôøì(€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€½¹ÍÐ•ÉÉ½È€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹Ðµ±½¥¸µ•ÉÉ½Èœ¤ì(€€€€€ÑÉäì(€€€€€€€½¹ÍÐ™¥ÉÍÐ€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹Ðµ™¥ÉÍÐµ¹…µ”œ¤¹Ù…±Õ”ì(€€€€€€€½¹ÍÐ±…ÍÐ€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹Ðµ±…ÍÐµ¹…µ”œ¤¹Ù…±Õ”ì(€€€€€€€½¹ÍÐÉ•‘•¹Ñ¥…±Ì€ô…ÍÍ•ÍÍµ•¹Ð¹…¹‘¥‘…Ñ•É•‘•¹Ñ¥…±Ì¡™¥ÉÍÐ°±…ÍÐ¤ì(€€€€€€€½¹ÍÐÍÑÕ‘•¹Ñ!…Í €ô…Ý…¥Ð…ÍÍ•ÍÍµ•¹Ð¹ÍÑÕ‘•¹Ñ!…Í ¡™¥ÉÍÐ°±…ÍÐ¤ì(€€€€€€€ÍÑ½É”¹Í•ÑMÑÕ‘•¹ÑÕÑ ¡ÍÑÕ‘•¹Ñ!…Í ¤ì(€€€€€€€½¹ÍÐ•á¥ÍÑ¥¹œ€ôÁÉ½™¥±” ¤ì(€€€€€€€ÍÑ½É”¹Í…Ù•MÑÕ‘•¹ÑAÉ½™¥±”¡ì€¸¸¹•á¥ÍÑ¥¹œ°™¥ÉÍÑ9…µ”èÉ•‘•¹Ñ¥…±Ì¹™¥ÉÍÑ9…µ”°±…ÍÑ9…µ”èÉ•‘•¹Ñ¥…±Ì¹±…ÍÑ9…µ”°™Õ±±9…µ”èÉ•‘•¹Ñ¥…±Ì¹™Õ±±9…µ”°…¹‘¥‘…Ñ•!…Í è•á¥ÍÑ¥¹œü¹…¹‘¥‘…Ñ•!…Í ñðÍÑÕ‘•¹Ñ!…Í °ÍÑÕ‘•¹Ñ!…Í °……‘•µ¥M•ÍÍ¥½¸èÍ•ÍÍ¥½¸ü¹……‘•µ¥M•ÍÍ¥½¸ñð•á¥ÍÑ¥¹œü¹……‘•µ¥M•ÍÍ¥½¸ñðÍÑ½É”¹5%}MMM%=8ô¤ì(€€€€€€€¥˜€¡Í•ÍÍ¥½¸¤ì(€€€€€€€€€½¹ÍÐ…¹‘¥‘…Ñ•!…Í €ô…Ý…¥Ð…ÍÍ•ÍÍµ•¹Ð¹…¹‘¥‘…Ñ•!…Í ¡Í•ÍÍ¥½¸¹¥°™¥ÉÍÐ°±…ÍÐ¤ì(€€€€€€€€€ÍÑ½É”¹Í•ÑÑ¥Ù•…¹‘¥‘…Ñ”¡Í•ÍÍ¥½¸¹¥°…¹‘¥‘…Ñ•!…Í ¤ì(€€€€€€€€€ÍÑ½É”¹Í…Ù•MÑÕ‘•¹ÑAÉ½™¥±”¡ì€¸¸¹ÍÑ½É”¹•ÑMÑÕ‘•¹ÑAÉ½™¥±” ¤°…¹‘¥‘…Ñ•!…Í °ÕÉÉ•¹Ñ±…ÍÍ%èÍ•ÍÍ¥½¸¹±…ÍÍÉ½ÕÀ°……‘•µ¥M•ÍÍ¥½¸èÍ•ÍÍ¥½¸¹……‘•µ¥M•ÍÍ¥½¸ô¤ì(€€€€€€€€€±½…Ñ¥½¸¹É•Á±…”¡•á…µ!É•˜ ¤¤ì(€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€ô(€€€€€€€É•¹‘•È ¤ì(€€€€€ô…Ñ €¡™…¥±ÕÉ”¤ì(€€€€€€€•ÉÉ½È¹Ñ•áÑ½¹Ñ•¹Ð€ô™…¥±ÕÉ”¹µ•ÍÍ…”ì(€€€€€€€•ÉÉ½È¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ¡¥‘‘•¸œ¤ì(€€€€€ô(€€€ô¤ì(€ôì((€½¹ÍÐ±½Í•5•¹Ô€ô€ ¤€ôøì(€€€½¹ÍÐÍ¥‘•‰…È€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹ÐµÍ¥‘•‰…Èœ¤ì(€€€½¹ÍÐÍÉ¥´€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹ÐµÍÉ¥´œ¤ì(€€€½¹ÍÐµ•¹Ô€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹Ðµµ•¹Ôœ¤ì(€€€Í¥‘•‰…Èü¹±…ÍÍ1¥ÍÐ¹…‘ ¡¥‘‘•¸œ¤ì(€€€Í¥‘•‰…Èü¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ™±•àœ¤ì(€€€ÍÉ¥´ü¹±…ÍÍ1¥ÍÐ¹…‘ ¡¥‘‘•¸œ¤ì(€€€µ•¹Ôü¹Í•ÑÑÑÉ¥‰ÕÑ” …É¥„µ•áÁ…¹‘•œ°€™…±Í”œ¤ì(€€€¥˜€¡±…ÍÑ5•¹Õ½ÕÌ¥¹ÍÑ…¹•½˜!Q51±•µ•¹Ð¤±…ÍÑ5•¹Õ½ÕÌ¹™½ÕÌ ¤ì(€€€±…ÍÑ5•¹Õ½ÕÌ€ô¹Õ±°ì(€ôì((€½¹ÍÐ‰¥¹‘A½ÉÑ…°€ô€ ¤€ôøì(€€€½¹ÍÐµ•¹Ô€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹Ðµµ•¹Ôœ¤ì(€€€µ•¹Ôü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì(€€€€€±…ÍÑ5•¹Õ½ÕÌ€ô‘½Õµ•¹Ð¹…Ñ¥Ù•±•µ•¹Ðì(€€€€€½¹ÍÐÍ¥‘•‰…È€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹ÐµÍ¥‘•‰…Èœ¤ì(€€€€€Í¥‘•‰…Èü¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ¡¥‘‘•¸œ¤ì(€€€€€Í¥‘•‰…Èü¹±…ÍÍ1¥ÍÐ¹…‘ ™±•àœ¤ì(€€€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹ÐµÍÉ¥´œ¤ü¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ¡¥‘‘•¸œ¤ì(€€€€€µ•¹Ô¹Í•ÑÑÑÉ¥‰ÕÑ” …É¥„µ•áÁ…¹‘•œ°€ÑÉÕ”œ¤ì(€€€€€Í¥‘•‰…Èü¹ÅÕ•ÉåM•±•Ñ½È „œ¤ü¹™½ÕÌ ¤ì(€€€ô¤ì(€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹ÐµÍÉ¥´œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°±½Í•5•¹Ô¤ì(€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹Ðµµ•¹Ôµ±½Í”œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°±½Í•5•¹Ô¤ì(€€€‘½Õµ•¹Ð¹ÅÕ•ÉåM•±•Ñ½È m‘…Ñ„µÍÑÕ‘•¹Ðµ±½½ÕÑtœ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì(€€€€€ÍÑ½É”¹±•…ÉMÑÕ‘•¹ÑÕÑ  ¤ì(€€€€€É•¹‘•È ¤ì(€€€ô¤ì(€€€‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹ÐµÁÉ½™¥±”µ™½É´œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ÍÕ‰µ¥Ðœ°€¡•Ù•¹Ð¤€ôøì(€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€½¹ÍÐÕÉÉ•¹Ð€ôÁÉ½™¥±” ¤ì(€€€€€ÍÑ½É”¹Í…Ù•MÑÕ‘•¹ÑAÉ½™¥±”¡ì€¸¸¹ÕÉÉ•¹Ð°Õ…É‘¥…¸è‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÁÉ½™¥±”µÕ…É‘¥…¸œ¤¹Ù…±Õ”°Á¡½¹”è‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÁÉ½™¥±”µÁ¡½¹”œ¤¹Ù…±Õ”ô¤ì(€€€€€É•¹‘•È ¤ì(€€€ô¤ì(€ôì((€½¹ÍÐÍ¡½Ýá…µÉÉ½È€ô€¡µ•ÍÍ…”¤€ôøì(€€€½¹ÍÐ•ÉÉ½È€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% •á…´µ¥µ•ÉÉ½Èœ¤ì(€€€¥˜€ …•ÉÉ½È¤É•ÑÕÉ¸ì(€€€•ÉÉ½È¹Ñ•áÑ½¹Ñ•¹Ð€ôµ•ÍÍ…”ì(€€€•ÉÉ½È¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ¡¥‘‘•¸œ¤ì(€ôì((€½¹ÍÐ‰¥¹‘½µµ½¸€ô€ ¤€ôøì(€€€½¹ÍÐ±…Õ¹ €ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% •á…´µ¥µ±…Õ¹ œ¤ì(€€€½¹ÍÐ‘¥…±½œ€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% •á…´µ¥µ‘¥…±½œœ¤ì(€€€½¹ÍÐ±½Í”€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% •á…´µ¥µ±½Í”œ¤ì(€€€½¹ÍÐ™½É´€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% •á…´µ¥µ™½É´œ¤ì(€€€½¹ÍÐ¥¹ÁÕÐ€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% •á…´µ¥µ¥¹ÁÕÐœ¤ì(€€€½¹ÍÐ•ÉÉ½È€ô‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% •á…´µ¥µ•ÉÉ½Èœ¤ì((€€€±…Õ¹ ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôøì(€€€€€±…ÍÑ¥…±½½ÕÌ€ô‘½Õµ•¹Ð¹…Ñ¥Ù•±•µ•¹Ðì(€€€€€¥˜€¡•ÉÉ½È¤ì•ÉÉ½È¹Ñ•áÑ½¹Ñ•¹Ð€ô€œœì•ÉÉ½È¹±…ÍÍ1¥ÍÐ¹…‘ ¡¥‘‘•¸œ¤ìô(€€€€€¥˜€¡¥¹ÁÕÐ¤¥¹ÁÕÐ¹Ù…±Õ”€ô€œœì(€€€€€‘¥…±½œü¹Í¡½Ý5½‘…° ¤ì(€€€€€ÅÕ•Õ•5¥É½Ñ…Í¬  ¤€ôø¥¹ÁÕÐü¹™½ÕÌ ¤¤ì(€€€ô¤ì(€€€±½Í”ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€ ¤€ôø‘¥…±½œü¹±½Í” ¤¤ì(€€€‘¥…±½œü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ°€¡•Ù•¹Ð¤€ôøì(€€€€€¥˜€¡•Ù•¹Ð¹Ñ…É•Ð€ôôô‘¥…±½œ¤‘¥…±½œ¹±½Í” ¤ì(€€€ô¤ì(€€€‘¥…±½œü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È …¹•°œ°€¡•Ù•¹Ð¤€ôøì(€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€‘¥…±½œ¹±½Í” ¤ì(€€€ô¤ì(€€€‘¥…±½œü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±½Í”œ°€ ¤€ôøì(€€€€€¥˜€¡±…ÍÑ¥…±½½ÕÌ¥¹ÍÑ…¹•½˜!Q51±•µ•¹Ð¤±…ÍÑ¥…±½½ÕÌ¹™½ÕÌ ¤ì(€€€€€±…ÍÑ¥…±½½ÕÌ€ô¹Õ±°ì(€€€ô¤ì(€€€™½É´ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ÍÕ‰µ¥Ðœ°€¡•Ù•¹Ð¤€ôøì(€€€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€€€¥˜€¡•ÉÉ½È¤ì•ÉÉ½È¹Ñ•áÑ½¹Ñ•¹Ð€ô€œœì•ÉÉ½È¹±…ÍÍ1¥ÍÐ¹…‘ ¡¥‘‘•¸œ¤ìô(€€€€€½¹ÍÐ¥€ô¥¹ÁÕÐ¹Ù…±Õ”¹ÑÉ¥´ ¤¹Ñ½UÁÁ•É…Í” ¤ì(€€€€€½¹ÍÐÍ•±•Ñ•€ôÍÑ½É”¹™¥¹‘M•ÍÍ¥½¹	å%¡¥¤ì(€€€€€¥˜€ …Í•±•Ñ•¤ì(€€€€€€€Í¡½Ýá…µÉÉ½È 9¼•á…µ¥¹…Ñ¥½¸µ…Ñ¡•ÌÑ¡…Ð%¸¡•¬Ñ¡”¡…É…Ñ•ÉÌ…¹ÑÉä……¥¸¸œ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€ô(€€€€€¥˜€¡Í•±•Ñ•¹ÍÑ…ÑÕÌ€ôôô€‘É…™Ðœ¤ì(€€€€€€€Í¡½Ýá…µÉÉ½È Q¡¥Ì•á…µ¥¹…Ñ¥½¸¡…Ì¹½Ð‰••¸ÁÕ‰±¥Í¡•å•Ð¸œ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€ô(€€€€€½¹ÍÐ±¥¹¬€ôÁÉ½Ñ½È¹‘•½É…Ñ•MÑÕ‘•¹Ñ1¥¹¬¡ÍÑ½É”¹•ÑM•ÍÍ¥½¹1¥¹¬¡Í•±•Ñ•°±½…Ñ¥½¸¹¡É•˜¤°ÁÉ½Ñ½È¹•Ñ‘µ¥¹A½±¥ä¡Í•±•Ñ•¹¥¤¹…µ•É…I•ÅÕ¥É•¤ì(€€€€€±½…Ñ¥½¸¹…ÍÍ¥¸¡±¥¹¬¤ì(€€€ô¤ì((€€€É½½Ð¹½¹­•å‘½Ý¸€ô€¡•Ù•¹Ð¤€ôøì(€€€€€¥˜€¡•Ù•¹Ð¹­•ä€ôôô€Í…Á”œ€˜˜‘½Õµ•¹Ð¹•Ñ±•µ•¹Ñ	å% ÍÑÕ‘•¹Ðµµ•¹Ôœ¤ü¹•ÑÑÑÉ¥‰ÕÑ” …É¥„µ•áÁ…¹‘•œ¤€ôôô€ÑÉÕ”œ¤±½Í•5•¹Ô ¤ì(€€€ôì(€ôì((€É½½Ð¹¥¹¹•É!Q50€ô€œñµ…¥¸±…ÍÌô‰É¥µ¥¸µ µ‘Ù Á±…”µ¥Ñ•µÌµ•¹Ñ•È‰œµ¹•ÕÑÉ…°´ÔÀÀ´Øˆøñ‘¥Ø±…ÍÌô‰É½Õ¹‘•´Éá°‰½É‘•È‰½É‘•Èµ¹•ÕÑÉ…°´ÈÀÀ‰œµÝ¡¥Ñ”À´ÜÑ•áÐµ•¹Ñ•ÈÍ¡…‘½ÜµÍ´ˆøñÍÁ…¸±…ÍÌô‰µàµ…ÕÑ¼É¥Í¥é”´ÄÄÁ±…”µ¥Ñ•µÌµ•¹Ñ•ÈÉ½Õ¹‘•µá°‰œµ¹•ÕÑÉ…°´äÔÀÑ•áÐµÍ´™½¹Ðµ‰±…¬Ñ•áÐµÝ¡¥Ñ”ˆùð½ÍÁ…¸øñ Ä±…ÍÌô‰µÐ´Ô™½¹Ðµ‘¥ÍÁ±…äÑ•áÐ´Éá°™½¹Ðµ•áÑÉ…‰½±Ñ•áÐµ¹•ÕÑÉ…°´äÔÀˆù=Á•¹¥¹œå½ÕÈ……‘•µ¥ŒÝ½É­ÍÁ…—Š˜ð½ Äøð½‘¥Øøð½µ…¥¸øœì(€ÅÕ•ÍÑ¥½¹Ì¹±½… ¤¹Ñ¡•¸¡É•¹‘•È¤¹…Ñ  ¡™…¥±ÕÉ”¤€ôøì(€€€É½½Ð¹¥¹¹•É!Q50€ô€ñµ…¥¸±…ÍÌô‰É¥µ¥¸µ µ‘Ù Á±…”µ¥Ñ•µÌµ•¹Ñ•È‰œµ¹•ÕÑÉ…°´ÔÀÀ´Øˆøñ‘¥Ø±…ÍÌô‰µ…àµÜµ±œÉ½Õ¹‘•´Éá°‰½É‘•È‰½É‘•ÈµÉ•´ÈÀÀ‰œµÉ•´ÔÀÀ´ØÑ•áÐµÉ•´äÀÀˆøñÍÑÉ½¹œ±…ÍÌô‰‰±½¬™½¹Ðµ‘¥ÍÁ±…äÑ•áÐµ±œˆùEÕ•ÍÑ¥½¸‘…Ñ„Õ¹…Ù…¥±…‰±”ð½ÍÑÉ½¹œøñÍÁ…¸±…ÍÌô‰µÐ´È‰±½¬Ñ•áÐµÍ´ˆø‘í•Í…Á•!Ñµ°¡™…¥±ÕÉ”¹µ•ÍÍ…”¥ôð½ÍÁ…¸øð½‘¥Øøð½µ…¥¸ø‘í•á…µ•ÍÍ5…É­ÕÀ ¥õ€ì(€€€‰¥¹‘½µµ½¸ ¤ì(€ô¤ì)ô¤ ¤ì(