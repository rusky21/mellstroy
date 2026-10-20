(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const motion = root.classList.contains('js');
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

  // Заглавные строки (по <br>) оборачиваются в маски, чтобы выезжать снизу
  function splitLines(el) {
    el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i)
      .map((line, n) => `<span class="ln" style="--l:${n}"><span>${line.trim()}</span></span>`).join('');
  }
  if (motion) $$('[data-split], .hero-titles .hero-title').forEach(splitLines);

  function watch(els, threshold, onIn, margin) {
    const io = new IntersectionObserver((entries) => {
      let k = 0;
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        onIn(e.target, k++);
      });
    }, { threshold, rootMargin: margin || '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
  }
  function reveal(selector, threshold) {
    watch($$(selector), threshold, (el, k) => {
      el.style.setProperty('--k', k);
      el.classList.add('is-in');
    });
  }

  // Закреплённое меню
  const bar = document.getElementById('bar');
  const menuBtn = $('.menu-btn');
  const nav = document.getElementById('site-nav');

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    bar.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a, button')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
  });

  // Этапы: активная ступень и линия прогресса
  const stagesEl = document.getElementById('stages');
  const stageItems = stagesEl ? $$('.stage', stagesEl) : [];
  const stageImgs = $$('.process-frame img');
  let stageIdx = 0;

  function syncStages() {
    const r = stagesEl.getBoundingClientRect();
    const mid = window.innerHeight * 0.5;
    stagesEl.style.setProperty('--prog', Math.min(1, Math.max(0, (mid - r.top) / r.height)).toFixed(3));
    let best = 0;
    let bestDist = Infinity;
    stageItems.forEach((s, i) => {
      const sr = s.getBoundingClientRect();
      const d = Math.abs(sr.top + sr.height / 2 - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best === stageIdx && stageItems[best].classList.contains('is-active')) return;
    stageIdx = best;
    stageItems.forEach((s, i) => s.classList.toggle('is-active', i === best));
    stageImgs.forEach((img, i) => img.classList.toggle('is-active', i === best));
  }

  // Тема, активный пункт меню и параллакс по секции под панелью
  const sections = $$('section[data-bar]');
  const links = $$('a[href^="#"]', nav);
  const parallaxed = $$('.hero-bg');
  let ticking = false;

  function syncBar() {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
    if (motion) {
      parallaxed.forEach((bg) => {
        const r = bg.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const lim = r.height * 0.15;
        const y = Math.max(-lim, Math.min(lim, -r.top * 0.15));
        bg.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
      });
    }
    const probe = bar.offsetHeight / 2;
    const current = sections.find((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= probe && r.bottom > probe;
    }) || sections[0];
    bar.dataset.theme = current.dataset.bar;
    bar.classList.toggle('is-top', window.scrollY < 8);
    const key = '#' + (current.dataset.nav || current.id);
    links.forEach((a) => {
      if (a.getAttribute('href') === key) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (stagesEl) syncStages();
  }
  function queueSync() {
    if (!ticking) { ticking = true; requestAnimationFrame(syncBar); }
  }
  window.addEventListener('scroll', queueSync, { passive: true });
  window.addEventListener('resize', queueSync);
  syncBar();

  // Слайды hero
  const hero = document.getElementById('top');
  const bgs = $$('.hero-bg img', hero);
  const titles = $$('.hero-title', hero);
  const notes = $$('.hero-note', hero);
  const cur = document.getElementById('hero-cur');
  const next = document.getElementById('hero-next');
  const total = titles.length;
  let index = 0;
  let timer = null;

  function show(i) {
    const prev = index;
    index = (i + total) % total;
    if (motion && prev !== index) {
      const out = titles[prev];
      out.classList.add('is-leaving');
      setTimeout(() => out.classList.remove('is-leaving'), 1500);
    }
    [bgs, titles, notes].forEach((list) => list.forEach((el, n) => {
      const active = n === index;
      el.classList.toggle('is-active', active);
      if (list === titles) el.setAttribute('aria-hidden', String(!active));
    }));
    cur.textContent = String(index + 1).padStart(2, '0');
  }

  function start() {
    if (reduceMotion) return;
    stop();
    timer = setInterval(() => show(index + 1), 7000);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  next.addEventListener('click', () => { show(index + 1); start(); });
  hero.addEventListener('mouseenter', stop);
  hero.addEventListener('mouseleave', start);
  hero.addEventListener('focusin', stop);
  hero.addEventListener('focusout', start);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();

  // Счётчик карточек каталога при горизонтальной прокрутке
  const cards = document.getElementById('cards');
  const cardsCur = document.getElementById('cards-cur');
  cards.addEventListener('scroll', () => {
    const first = $('.card', cards);
    const step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(cards).columnGap || 0);
    const n = Math.min(cards.children.length, Math.round(cards.scrollLeft / step) + 1);
    cardsCur.textContent = String(n).padStart(2, '0');
  }, { passive: true });

  // Появление по прокрутке: заголовки, изображения, ступени, карточки, цифры
  if (motion) {
    watch($$('[data-split]'), 0.4, (el) => el.classList.add('is-in'));
    ['.col', '.step', '.card', '.work', '.site', '.person'].forEach((s) => reveal(s, 0.15));

    const fmt = (n) => n.toLocaleString('ru-RU');
    const stats = $$('[data-count]');
    stats.forEach((el) => { el.textContent = '0' + (el.dataset.suffix || ''); });
    watch(stats, 1, (el) => {
      const to = Number(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const t0 = performance.now();
      (function tick(now) {
        const p = Math.min(1, (now - t0) / 1600);
        el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 4)))) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }, '0px');

    // Загрузка: ждём шрифт, чтобы заголовок не прыгал при выезде
    const go = () => requestAnimationFrame(() => root.classList.add('is-ready'));
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(go);
  }

  // Калькулятор стоимости
  const calcForm = document.getElementById('calc-form');
  let estimateText = '';
  if (calcForm) {
    const area = document.getElementById('calc-area');
    const areaOut = document.getElementById('calc-area-out');
    const priceEl = document.getElementById('calc-price');
    const termEl = document.getElementById('calc-term');
    const payEl = document.getElementById('calc-pay');
    const money = (n) => n.toLocaleString('ru-RU');
    const label = (name) => {
      const input = calcForm.querySelector(`input[name="${name}"]:checked`);
      return $('.tier-name, span', input.closest('label')).textContent;
    };

    function calc() {
      const a = Number(area.value);
      const base = Number(calcForm.elements.tier.value);
      const floors = Number(calcForm.elements.floors.value);
      const mat = Number(calcForm.elements.mat.value);
      const sizeK = Math.min(1.1, Math.max(0.92, 1 + (100 - a) / 1000));
      const price = a * base * sizeK * mat * (floors === 2 ? 0.96 : 1);
      const lo = Math.round((price * 0.95) / 10000) * 10000;
      const hi = Math.round((price * 1.05) / 10000) * 10000;
      const months = Math.round(3.5 + a / 50 + (mat > 1.1 ? 0.5 : 0));
      const r = 0.06 / 12;
      const pay = Math.round(((price * 0.8 * r) / (1 - Math.pow(1 + r, -240))) / 100) * 100;

      areaOut.textContent = `${a} м²`;
      area.style.setProperty('--fill', `${((a - area.min) / (area.max - area.min)) * 100}%`);
      priceEl.textContent = `${money(lo)} – ${money(hi)} ₽`;
      termEl.textContent = `${months} мес.`;
      payEl.textContent = `от ${money(pay)} ₽/мес`;
      estimateText = `Ваш расчёт: «${label('tier')}», ${a} м², ${floors} эт., ${label('mat').toLowerCase()}. Стоимость ${money(lo)} – ${money(hi)} ₽.`;
    }
    calcForm.addEventListener('input', calc);
    calcForm.addEventListener('submit', (e) => e.preventDefault());
    calc();
  }

  // Отзывы
  const rvTabs = $$('.rv-tabs button');
  const rvItems = $$('.rv-item');
  const rvPhotos = $$('.rv-photos img');
  function showReview(i) {
    rvTabs.forEach((b, n) => b.setAttribute('aria-selected', String(n === i)));
    rvItems.forEach((el, n) => el.classList.toggle('is-active', n === i));
    rvPhotos.forEach((el, n) => el.classList.toggle('is-active', n === i));
  }
  rvTabs.forEach((b, i) => b.addEventListener('click', () => showReview(i)));

  // Вопросы: при открытии меняется фон
  const faqItems = $$('.faq-item');
  const faqBgs = $$('.faq-bg img');
  const faqCaption = document.getElementById('faq-caption');
  faqItems.forEach((item, i) => {
    const btn = $('.faq-q', item);
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      faqItems.forEach((it) => {
        it.classList.remove('is-open');
        $('.faq-q', it).setAttribute('aria-expanded', 'false');
      });
      if (open) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        faqBgs.forEach((img, n) => img.classList.toggle('is-active', n === i));
        faqCaption.textContent = btn.dataset.caption;
      }
    });
  });

  // Мессенджеры
  const fab = document.getElementById('fab');
  const fabBtn = $('.fab-btn', fab);
  function setFab(open) {
    fab.classList.toggle('is-open', open);
    fabBtn.setAttribute('aria-expanded', String(open));
  }
  fabBtn.addEventListener('click', () => setFab(!fab.classList.contains('is-open')));
  document.addEventListener('click', (e) => { if (!fab.contains(e.target)) setFab(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setFab(false); });

  // Формы заявок
  function phoneDigits(value) {
    let d = value.replace(/\D/g, '');
    if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
    return d;
  }

  function setupForm(form, getMessage, onDone) {
    const nameInput = $('[name="name"]', form);
    const phoneInput = $('[name="phone"]', form);
    const phoneErr = $('.field-error', phoneInput.closest('.field'));
    const consent = $('[name="consent"]', form);
    const consentErr = $('.consent + .field-error', form);
    const status = $('.callback-status', form);

    phoneInput.addEventListener('input', () => {
      if (phoneDigits(phoneInput.value).length === 10) {
        phoneInput.removeAttribute('aria-invalid');
        phoneErr.hidden = true;
      }
    });
    phoneInput.addEventListener('blur', () => {
      const d = phoneDigits(phoneInput.value);
      if (d.length === 10) phoneInput.value = `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
    });
    consent.addEventListener('change', () => { if (consent.checked) consentErr.hidden = true; });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const phoneOk = phoneDigits(phoneInput.value).length === 10;
      phoneErr.hidden = phoneOk;
      if (phoneOk) phoneInput.removeAttribute('aria-invalid');
      else phoneInput.setAttribute('aria-invalid', 'true');
      consentErr.hidden = consent.checked;
      if (!phoneOk) { phoneInput.focus(); return; }
      if (!consent.checked) { consent.focus(); return; }

      const name = nameInput.value.trim();
      status.textContent = `${name ? name + ', спасибо' : 'Спасибо'}! ${getMessage()}`;
      status.hidden = false;
      form.reset();
      if (onDone) onDone();
    });
    return status;
  }

  setupForm(document.getElementById('callback'), () => 'Заявка принята. Менеджер свяжется с вами в течение 15 минут.');

  // Окно заявки
  const modal = document.getElementById('modal');
  const modalForm = $('.modal-form', modal);
  const modalTitle = document.getElementById('modal-title');
  const modalNote = document.getElementById('modal-note');
  const modalEstimate = document.getElementById('modal-estimate');
  const modalSubmit = document.getElementById('modal-submit');
  const arrowSvg = modalSubmit.querySelector('svg').outerHTML;
  const modalStatus = document.getElementById('md-status');
  let modalKind = 'call';
  let closeTimer = null;

  const kinds = {
    call: ['Заказать звонок', 'Менеджер перезвонит в течение 15 минут.', 'Заказать звонок', 'Заявка принята. Менеджер перезвонит в течение 15 минут.'],
    catalog: ['Каталог проектов', 'Пришлём каталог из 96 проектов с ценами в PDF.', 'Получить каталог', 'Каталог уже летит к вам.'],
    project: ['Индивидуальный проект', 'Расскажите о задаче: архитектор свяжется и обсудит планировку, бюджет и сроки.', 'Обсудить проект', 'Архитектор свяжется с вами в течение рабочего дня.'],
    visit: ['Экскурсия на объект', 'Покажем действующую стройку и готовый дом. Выберем удобный день.', 'Записаться', 'Записали. Менеджер согласует день и время.'],
    estimate: ['Точная смета', 'Инженер подготовит смету за 1 день по вашим параметрам.', 'Получить смету', 'Заявка принята. Смета будет готова в течение суток.'],
  };

  setupForm(modalForm, () => kinds[modalKind][3], () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => modal.close(), 3200);
  });

  function openModal(kind) {
    modalKind = kinds[kind] ? kind : 'call';
    const k = kinds[modalKind];
    modalTitle.textContent = k[0];
    modalNote.textContent = k[1];
    modalSubmit.innerHTML = `${k[2]} ${arrowSvg}`;
    modalEstimate.hidden = modalKind !== 'estimate';
    modalEstimate.textContent = modalKind === 'estimate' ? estimateText : '';
    modalStatus.hidden = true;
    clearTimeout(closeTimer);
    modal.showModal();
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-modal]');
    if (trigger) { openModal(trigger.dataset.modal); return; }
    if (e.target.closest('[data-close]') || e.target === modal) modal.close();
  });
  modal.addEventListener('close', () => clearTimeout(closeTimer));

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
