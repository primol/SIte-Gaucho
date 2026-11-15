/* =========================================================
   Gaúcho Figueiras Grill · interações e animações
   ========================================================= */
(() => {
  'use strict';

  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const rand = (a, b) => a + Math.random() * (b - a);

  /* =======================================================
     FX: brasas e fumaça em <canvas>
     ======================================================= */
  const FX = {
    list: [],
    io: null,
    add(fx) {
      this.list.push(fx);
      if (!this.io) {
        this.io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            const f = this.list.find((x) => x.c === e.target);
            if (f) f.visible = e.isIntersecting;
          });
        }, { rootMargin: '120px' });
      }
      this.io.observe(fx.c);
    },
    remove(fx) {
      this.list = this.list.filter((x) => x !== fx);
      if (this.io) this.io.unobserve(fx.c);
    },
    start() {
      let last = performance.now();
      const tick = (t) => {
        const dt = Math.min(3, (t - last) / 16.667);
        last = t;
        if (!document.hidden) this.list.forEach((f) => { if (f.visible) f.frame(dt); });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  };

  function makeSprite(size, stops) {
    const s = document.createElement('canvas');
    s.width = s.height = size;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, c]) => grd.addColorStop(o, c));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return s;
  }

  class CanvasFX {
    constructor(canvas, opts = {}) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = opts;
      this.p = [];
      this.visible = false;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.resize();
      if ('ResizeObserver' in window) new ResizeObserver(() => this.resize()).observe(canvas);
      FX.add(this);
    }
    resize() {
      const r = this.c.getBoundingClientRect();
      this.w = Math.max(1, r.width);
      this.h = Math.max(1, r.height);
      this.c.width = Math.round(this.w * this.dpr);
      this.c.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  const EMBER_SPRITE = makeSprite(64, [
    [0, 'rgba(255,246,214,1)'], [0.18, 'rgba(255,196,92,.95)'],
    [0.42, 'rgba(255,104,26,.42)'], [1, 'rgba(255,60,10,0)']
  ]);
  const SMOKE_SPRITE = makeSprite(256, [
    [0, 'rgba(255,250,244,.30)'], [0.4, 'rgba(240,232,224,.14)'], [1, 'rgba(230,220,210,0)']
  ]);

  class Embers extends CanvasFX {
    target() { return Math.min(this.opts.max || 120, Math.round((this.w * this.h) / (this.opts.density || 9000))); }
    spawn(x, y, burst) {
      const life = burst ? rand(40, 110) : rand(140, 340);
      const a = burst ? rand(0, Math.PI * 2) : 0;
      const sp = burst ? rand(2, 7.5) : 0;
      this.p.push({
        x: x !== undefined ? x : rand(0, this.w),
        y: y !== undefined ? y : this.h + rand(0, 40),
        vx: burst ? Math.cos(a) * sp : rand(-0.25, 0.25),
        vy: burst ? Math.sin(a) * sp - 2.2 : -rand(0.45, 1.5) * (this.opts.speed || 1),
        s: rand(1.6, burst ? 5.5 : 4.6),
        t: 0, life, ph: rand(0, 6.28), burst
      });
    }
    burst(x, y, n = 60) { for (let i = 0; i < n; i++) this.spawn(x, y, true); }
    frame(dt) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      const want = this.target();
      if (this.p.filter((q) => !q.burst).length < want && Math.random() < 0.6 * dt) this.spawn();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = this.p.length - 1; i >= 0; i--) {
        const q = this.p[i];
        q.t += dt;
        if (q.burst) { q.vx *= 0.96; q.vy = q.vy * 0.96 - 0.03; }
        q.x += (q.vx + Math.sin(q.t * 0.045 + q.ph) * 0.35) * dt;
        q.y += q.vy * dt;
        const k = q.t / q.life;
        if (k >= 1 || q.y < -30) { this.p.splice(i, 1); continue; }
        const fade = Math.min(1, q.t / 20) * (1 - k);
        const flick = 0.65 + 0.35 * Math.sin(q.t * 0.35 + q.ph);
        ctx.globalAlpha = Math.max(0, fade * flick);
        const size = q.s * 6 * (1 - k * 0.4);
        ctx.drawImage(EMBER_SPRITE, q.x - size / 2, q.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  class Smoke extends CanvasFX {
    target() { return Math.min(this.opts.max || 34, Math.round(this.w / 48)); }
    spawn(initial) {
      const life = rand(380, 720);
      this.p.push({
        x: rand(-0.1, 1.1) * this.w,
        y: initial ? rand(0.2, 1.1) * this.h : this.h * rand(0.75, 1.15),
        vx: rand(-0.12, 0.28), vy: -rand(0.22, 0.6),
        r: rand(0, 6.28), vr: rand(-0.004, 0.004),
        s: rand(0.55, 1.1) * Math.max(220, this.h * 0.55),
        t: initial ? rand(0, life * 0.6) : 0, life
      });
    }
    frame(dt) {
      const ctx = this.ctx;
      if (!this.p.length) for (let i = 0; i < this.target(); i++) this.spawn(true);
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.p.length < this.target() && Math.random() < 0.08 * dt) this.spawn(false);
      const op = this.opts.opacity || 1;
      for (let i = this.p.length - 1; i >= 0; i--) {
        const q = this.p[i];
        q.t += dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.r += q.vr * dt;
        const k = q.t / q.life;
        if (k >= 1) { this.p.splice(i, 1); continue; }
        const a = Math.sin(Math.PI * k) * op;
        const size = q.s * (0.7 + k * 1.3);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(q.x, q.y);
        ctx.rotate(q.r);
        ctx.drawImage(SMOKE_SPRITE, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }
  }

  const fx = {};
  if (!reduceMotion) {
    $$('[data-embers]').forEach((c) => {
      const name = c.dataset.embers;
      const opts = name === 'intro' ? { density: 5200, max: 160, speed: 1.2 }
        : name === 'hero' ? { density: 7000, max: 130 }
        : { density: 14000, max: 60 };
      fx['embers-' + name] = new Embers(c, opts);
    });
    $$('[data-smoke]').forEach((c) => {
      const name = c.dataset.smoke;
      fx['smoke-' + name] = new Smoke(c, { opacity: name === 'hero' ? 0.9 : 0.7 });
    });
    FX.start();
  }

  /* =======================================================
     INTRO: a cena 3D fica em assets/js/intro3d.js (módulo).
     Aqui ficam a coordenação com o site e a versão simples
     (sem WebGL, com "reduzir movimento" ou se o 3D não carregar).
     ======================================================= */
  const intro = $('#intro');
  let introExited = false;
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));

  function markReady() {
    body.classList.remove('is-intro');
    body.classList.add('is-ready');
  }

  function finishIntro() {
    if (!intro) return;
    intro.classList.add('is-done');
    if (fx['embers-intro']) FX.remove(fx['embers-intro']);
  }

  function exitIntro(fast) {
    if (introExited || !intro) return;
    introExited = true;
    GFIntro.state = 'done';
    timers.forEach(clearTimeout);
    const dur = fast ? 550 : 950;
    if (!intro.animate) { finishIntro(); markReady(); return; }
    const anim = intro.animate(
      fast ? [{ opacity: 1 }, { opacity: 0 }] : [{ clipPath: 'inset(0 0 0% 0)' }, { clipPath: 'inset(0 0 100% 0)' }],
      { duration: dur, easing: 'cubic-bezier(.77,0,.18,1)', fill: 'forwards' }
    );
    setTimeout(markReady, fast ? 120 : 260);
    anim.onfinish = finishIntro;
    setTimeout(finishIntro, dur + 200);
  }

  const GFIntro = window.GFIntro = {
    state: 'waiting', // waiting → claimed (3D) | fallback → done
    skip: null,
    claim() {
      if (this.state !== 'waiting') return false;
      this.state = 'claimed';
      clearTimeout(fallbackTimer);
      return true;
    },
    fail() {
      if (this.state === 'claimed') this.state = 'waiting';
      runFallback();
    },
    reveal() {
      if (intro) intro.classList.add('is-burning');
      markReady();
    },
    done() {
      this.state = 'done';
      introExited = true;
      finishIntro();
      markReady();
    }
  };

  function runFallback() {
    if (!intro || GFIntro.state !== 'waiting') return;
    GFIntro.state = 'fallback';
    intro.classList.add('is-fallback');
    const logo = $('.intro__logo', intro);
    const glow = $('.intro__glow', intro);
    if (logo && logo.animate && !reduceMotion) {
      glow.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.4)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1.05)' },
        { opacity: .8, transform: 'translate(-50%,-50%) scale(1)' }
      ], { duration: 1400, easing: 'ease-out', fill: 'forwards' });
      logo.animate([
        { opacity: 0, transform: 'scale(.7)', filter: 'drop-shadow(0 0 0 rgba(255,120,40,0)) brightness(1.6)' },
        { opacity: 1, transform: 'scale(1.04)', filter: 'drop-shadow(0 0 30px rgba(255,120,40,.7)) brightness(1.15)', offset: .6 },
        { opacity: 1, transform: 'scale(1)', filter: 'drop-shadow(0 0 22px rgba(255,120,40,.55)) brightness(1)' }
      ], { duration: 1300, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      const e = fx['embers-intro'];
      at(350, () => { if (e) e.burst(e.w / 2, e.h / 2, 60); });
    }
    at(reduceMotion ? 900 : 2700, () => exitIntro(false));
  }

  const fallbackTimer = setTimeout(runFallback, 6500);
  if (intro) {
    const skipIntro = () => {
      if (GFIntro.state === 'claimed' && GFIntro.skip) GFIntro.skip();
      else exitIntro(true);
    };
    $('.intro__skip', intro).addEventListener('click', skipIntro);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && GFIntro.state !== 'done') skipIntro(); });
    if (reduceMotion || !('noModule' in HTMLScriptElement.prototype)) runFallback();
  } else {
    markReady();
  }

  /* =======================================================
     HEADER / NAVEGAÇÃO
     ======================================================= */
  const header = $('.header');
  const nav = $('#nav');
  const burger = $('.burger');
  let lastY = window.scrollY;

  function onScrollHeader() {
    const y = window.scrollY;
    header.classList.toggle('is-solid', y > 40);
    const navOpen = nav.classList.contains('is-open');
    header.classList.toggle('is-hidden', !navOpen && y > 700 && y > lastY + 4);
    if (y < lastY - 4) header.classList.remove('is-hidden');
    lastY = y;
  }

  function toggleNav(open) {
    const isOpen = open !== undefined ? open : !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', isOpen);
    burger.setAttribute('aria-expanded', String(isOpen));
    burger.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    document.documentElement.style.overflow = isOpen ? 'hidden' : '';
  }
  burger.addEventListener('click', () => toggleNav());
  $$('a', nav).forEach((a) => a.addEventListener('click', () => toggleNav(false)));

  // destaca a seção atual no menu
  const navLinks = $$('.nav a[href^="#"]');
  const inView = new Set();
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) inView.add(e.target.id); else inView.delete(e.target.id); });
    const id = Array.from(inView).pop();
    navLinks.forEach((a) => a.classList.toggle('is-current', !!id && a.getAttribute('href') === '#' + id));
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach((a) => { const s = $(a.getAttribute('href')); if (s) sectionIO.observe(s); });

  /* =======================================================
     REVELAÇÃO AO ROLAR + CONTADORES
     ======================================================= */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-visible');
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal]').forEach((el) => revealIO.observe(el));

  const fmt = (v, d) => v.toFixed(d).replace('.', ',');
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countIO.unobserve(e.target);
      const el = e.target;
      const end = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.decimals || '0', 10);
      const pre = el.dataset.prefix || '';
      if (reduceMotion) { el.textContent = pre + fmt(end, dec); return; }
      const t0 = performance.now();
      const dur = 1600;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 4);
        el.textContent = pre + fmt(end * eased, dec);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach((el) => countIO.observe(el));

  /* =======================================================
     PARALLAX
     ======================================================= */
  const parallaxEls = reduceMotion ? [] : $$('[data-parallax]');
  const parallaxBgs = reduceMotion ? [] : $$('[data-parallax-bg]');
  let ticking = false;
  function onScrollParallax() {
    const vh = window.innerHeight;
    parallaxEls.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const off = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
      el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
    });
    parallaxBgs.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const off = (r.top + r.height / 2 - vh / 2) * -0.12;
      el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
    });
  }
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScrollHeader(); onScrollParallax(); ticking = false; });
  }, { passive: true });
  onScrollHeader();
  onScrollParallax();

  /* =======================================================
     PONTO DA CARNE
     ======================================================= */
  const PONTOS = [
    { n: 'Mal passado', t: '≈ 50 °C', d: 'Centro vermelho intenso e úmido. Máxima suculência para quem gosta da carne no seu estado mais puro.', core: '#a30f22', mid: '#b9283a', edge: '#c65356', band: .025, j: 1 },
    { n: 'Ao ponto para mal', t: '≈ 55 °C', d: 'Centro rosado-avermelhado e muito suculento. O ponto preferido de quem ama cortes nobres como picanha e ancho.', core: '#c42f3c', mid: '#d4555c', edge: '#c97a6f', band: .06, j: .85 },
    { n: 'Ao ponto', t: '≈ 60 °C', d: 'Centro rosado e quente, com equilíbrio perfeito entre suculência e textura.', core: '#dc7f80', mid: '#d38b80', edge: '#b88472', band: .11, j: .6 },
    { n: 'Ao ponto para bem', t: '≈ 65 °C', d: 'Apenas um leve rosado no centro. Carne mais firme, ainda macia.', core: '#c9a090', mid: '#b48b77', edge: '#9c7562', band: .19, j: .35 },
    { n: 'Bem passado', t: '≈ 70 °C+', d: 'Totalmente cozida, sem rosado. Textura firme, com o sabor da brasa por inteiro.', core: '#937262', mid: '#8b6857', edge: '#835f4d', band: .3, j: .15 }
  ];
  const range = $('#pontoRange');
  if (range) {
    const stops = {};
    $$('#gDone stop[data-k]').forEach((s) => { stops[s.dataset.k] = s; });
    const juice = $('.ponto__juice');
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const toState = (p) => ({ core: hex(p.core), mid: hex(p.mid), edge: hex(p.edge), band: p.band });
    const rgb = (c) => 'rgb(' + c.map((v) => Math.round(v)).join(',') + ')';
    const apply = (s) => {
      const b1 = 0.07, e1 = b1 + s.band, m1 = e1 + (0.5 - e1) * 0.5;
      const set = (k, off, col) => { stops[k].setAttribute('offset', off.toFixed(4)); stops[k].setAttribute('stop-color', col); };
      set('band1', b1, '#8a6250'); set('band2', 1 - b1, '#8a6250');
      set('edge1', e1, rgb(s.edge)); set('edge2', 1 - e1, rgb(s.edge));
      set('mid1', m1, rgb(s.mid)); set('mid2', 1 - m1, rgb(s.mid));
      set('core', 0.5, rgb(s.core));
    };
    let cur = toState(PONTOS[+range.value]);
    let raf = 0;
    const lerp = (a, b, k) => a + (b - a) * k;
    const tweenTo = (target) => {
      cancelAnimationFrame(raf);
      const from = { core: cur.core.slice(), mid: cur.mid.slice(), edge: cur.edge.slice(), band: cur.band };
      const t0 = performance.now();
      const dur = reduceMotion ? 1 : 450;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        cur = {
          core: from.core.map((v, i) => lerp(v, target.core[i], e)),
          mid: from.mid.map((v, i) => lerp(v, target.mid[i], e)),
          edge: from.edge.map((v, i) => lerp(v, target.edge[i], e)),
          band: lerp(from.band, target.band, e)
        };
        apply(cur);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const setPonto = () => {
      const p = PONTOS[+range.value];
      tweenTo(toState(p));
      juice.style.opacity = p.j;
      $('#pontoName').textContent = p.n;
      $('#pontoDesc').textContent = p.d;
      $('#pontoTemp').textContent = p.t;
      range.setAttribute('aria-valuetext', p.n);
    };
    range.addEventListener('input', setPonto);
    apply(cur);
  }

  /* =======================================================
     CARDÁPIO: abas
     ======================================================= */
  const tabs = $$('.tabs [role="tab"]');
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      panel.hidden = !on;
      panel.classList.toggle('is-active', on);
    });
    if (focus) tab.focus();
    tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = tabs.length - 1;
      if (j !== null) { e.preventDefault(); selectTab(tabs[j], true); }
    });
  });

  /* =======================================================
     AVALIAÇÕES (lista em assets/js/reviews.js)
     ======================================================= */
  const reviews = Array.isArray(window.GF_REVIEWS) ? window.GF_REVIEWS.filter((r) => r && r.texto) : [];
  const reviewsBox = $('#reviews');
  if (reviews.length && reviewsBox) {
    const track = $('#reviewsTrack');
    const dots = $('#reviewsDots');
    const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    track.innerHTML = reviews.map((r) => {
      const nota = Math.max(0, Math.min(5, Number(r.nota) || 5));
      const meta = [r.fonte, r.data].filter(Boolean).map(esc).join(' · ');
      return `<article class="review">
        <span class="stars" style="--rate:${nota}" aria-label="${String(nota).replace('.', ',')} de 5 estrelas"></span>
        <p class="review__quote">${esc(r.texto)}</p>
        <div class="review__meta"><span class="review__avatar" aria-hidden="true">${esc((r.nome || '?').trim().charAt(0).toUpperCase())}</span>
        <div><strong>${esc(r.nome || 'Cliente')}</strong><span>${meta}</span></div></div>
      </article>`;
    }).join('');
    reviewsBox.hidden = false;
    const cards = $$('.review', track);
    dots.innerHTML = cards.map((_, i) => `<button type="button" aria-label="Ir para avaliação ${i + 1}"></button>`).join('');
    const dotBtns = $$('button', dots);
    const go = (i) => {
      const card = cards[(i + cards.length) % cards.length];
      track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    const current = () => {
      let best = 0, dist = Infinity;
      cards.forEach((c, i) => { const d = Math.abs(c.offsetLeft - track.offsetLeft - track.scrollLeft); if (d < dist) { dist = d; best = i; } });
      return best;
    };
    const syncDots = () => { const c = current(); dotBtns.forEach((b, i) => b.setAttribute('aria-current', String(i === c))); };
    track.addEventListener('scroll', () => requestAnimationFrame(syncDots), { passive: true });
    dotBtns.forEach((b, i) => b.addEventListener('click', () => go(i)));
    $$('.reviews__btn', reviewsBox).forEach((b) => b.addEventListener('click', () => go(current() + Number(b.dataset.dir))));
    syncDots();
    let paused = false;
    reviewsBox.addEventListener('mouseenter', () => { paused = true; });
    reviewsBox.addEventListener('mouseleave', () => { paused = false; });
    if (!reduceMotion) setInterval(() => { if (!paused && !document.hidden) go(current() + 1); }, 6500);
  }

  /* =======================================================
     GALERIA: lightbox
     ======================================================= */
  const items = $$('.gallery__item');
  const lb = $('#lightbox');
  if (items.length && lb) {
    const img = $('img', lb);
    let idx = 0;
    const show = (i) => {
      idx = (i + items.length) % items.length;
      const a = items[idx];
      img.src = a.getAttribute('href');
      img.alt = $('img', a).alt;
    };
    const open = (i) => { show(i); lb.hidden = false; document.documentElement.style.overflow = 'hidden'; $('.lightbox__close', lb).focus(); };
    const close = () => { lb.hidden = true; document.documentElement.style.overflow = ''; items[idx].focus(); };
    items.forEach((a, i) => a.addEventListener('click', (e) => { e.preventDefault(); open(i); }));
    $('.lightbox__close', lb).addEventListener('click', close);
    $('.lightbox__arrow--prev', lb).addEventListener('click', () => show(idx - 1));
    $('.lightbox__arrow--next', lb).addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  /* ---------- ano no rodapé ---------- */
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

})();
