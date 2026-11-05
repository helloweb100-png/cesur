/* ==========================================================================
   CESUR · Renta de grúas Titán y Hiab · Mérida, Yucatán
   JavaScript sin dependencias (vanilla). Una sola rAF mueve todo lo que depende
   del scroll; los efectos "siempre activos" (canvas del hero, marquesina, radar,
   ping) corren en CSS o en el mismo bucle y se pausan fuera de pantalla.
   Índice: 1 Configuración · 2 Utilidades · 3 WhatsApp · 4 Cargador · 5 Encabezado
           6 Revelado · 7 Marquesina · 8 Hero (canvas, HUD, 3D) · 9 Scroll pinned
           10 Pestañas / Renta / FAQ · 11 Formulario · 12 Enchufe · 13 Interacción
           14 Bucle principal e inicio
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- 1. CONFIGURACIÓN ---------- */
  // ÚNICA fuente del número de WhatsApp: 10 dígitos, sin +52 ni espacios.
  // Si queda vacío, el botón flotante y el envío del formulario se ocultan solos.
  const WHATSAPP_NUMBER = '9981587001';
  const WA_COUNTRY = '52';

  const root = document.documentElement;
  root.setAttribute('data-boot', '1'); // avisa al respaldo del <head> que el JS arrancó

  /* ---------- 2. UTILIDADES ---------- */
  const qs = (s, c = document) => c.querySelector(s);
  const qsa = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const seg = (a, b, x) => clamp((x - a) / (b - a));
  const pad2 = (n) => String(n).padStart(2, '0');

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasWA = /^\d{10}$/.test(WHATSAPP_NUMBER);

  const S = { y: window.scrollY, vy: 0, vh: window.innerHeight, vw: window.innerWidth, dt: 0.016, t: 0 };
  const ticks = new Set();          // tareas que corren en cada frame
  const measurers = new Set();      // tareas que recalculan medidas al cambiar el tamaño
  const safe = (fn) => { try { fn(); } catch (err) { console.error(err); } };

  // Escribe una variable CSS solo si cambió (evita recalcular estilos de más)
  const setVar = (el, name, val) => {
    const key = '__' + name;
    if (el[key] === val) return;
    el[key] = val;
    el.style.setProperty(name, val);
  };

  /* ---------- 3. WHATSAPP ---------- */
  const waUrl = (msg) => `https://wa.me/${WA_COUNTRY}${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

  function openWhatsApp(msg) {
    const a = document.createElement('a');
    a.href = waUrl(msg);
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function initWhatsApp() {
    if (!hasWA) { root.classList.add('no-wa'); return; }
    qsa('[data-wa]').forEach((a) => {
      a.href = waUrl(a.dataset.waMsg || 'Hola, me interesa rentar una grúa en Mérida.');
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  /* ---------- 4. CARGADOR ---------- */
  function initLoader() {
    const el = qs('#loader');
    if (!el) { onReady(); return; }
    const bar = qs('[data-loader-bar]', el);
    const pct = qs('[data-loader-pct]', el);
    const st = qs('[data-loader-status]', el);
    const msgs = ['Posicionando equipo', 'Extendiendo pluma', 'Listo para izar'];
    const DUR = reduce ? 500 : 1500;
    let done = false;
    const t0 = performance.now();

    const finish = () => {
      if (done) return;
      done = true;
      el.classList.add('is-done');
      root.classList.add('is-ready');
      onReady();
      setTimeout(() => { el.classList.add('is-gone'); el.setAttribute('aria-hidden', 'true'); }, 760);
    };

    const step = (now) => {
      const p = clamp((now - t0) / DUR);
      const v = easeOut(p);
      bar.style.transform = `scaleX(${v.toFixed(3)})`;
      pct.textContent = String(Math.round(v * 100)).padStart(3, '0');
      const m = Math.min(2, Math.floor(v * 3));
      if (st.textContent !== msgs[m]) st.textContent = msgs[m];
      if (p < 1) requestAnimationFrame(step); else setTimeout(finish, 80);
    };
    requestAnimationFrame(step);
    setTimeout(finish, 1900); // respaldo: nunca pasa de ~2.6 s con la animación de salida
  }

  function onReady() {
    qsa('[data-hero-split]').forEach((el) => el.classList.add('is-in'));
    const wa = qs('.wa-float');
    setTimeout(() => wa && wa.classList.add('is-visible'), 1400);
    setTimeout(() => {
      if (!wa) return;
      wa.classList.add('show-tip');
      setTimeout(() => wa.classList.remove('show-tip'), 6500);
    }, 8000);
  }

  /* ---------- 5. ENCABEZADO Y MENÚ ---------- */
  function initHeader() {
    const header = qs('[data-header]');
    const burger = qs('.burger');
    const menu = qs('#menu');
    if (!header) return;
    let open = false;
    let lastY = S.y;

    const setOpen = (v) => {
      open = v;
      if (burger) {
        burger.setAttribute('aria-expanded', String(v));
        burger.setAttribute('aria-label', v ? 'Cerrar menú' : 'Abrir menú');
      }
      if (menu) menu.classList.toggle('is-open', v);
      root.classList.toggle('menu-open', v);
      if (v) header.classList.remove('is-hidden');
    };

    if (burger) burger.addEventListener('click', () => setOpen(!open));
    if (menu) qsa('a', menu).forEach((a) => a.addEventListener('click', () => setOpen(false)));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });

    ticks.add(() => {
      header.classList.toggle('is-stuck', S.y > 24);
      if (open) return;
      const d = S.y - lastY;
      if (d > 8 && S.y > 240) { header.classList.add('is-hidden'); lastY = S.y; }
      else if (d < -8 || S.y < 120) { header.classList.remove('is-hidden'); lastY = S.y; }
    });
  }

  /* ---------- 6. REVELADO AL HACER SCROLL ---------- */
  function splitWords(el) {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((ch) => {
        if (ch.nodeType === 3) {
          const parts = ch.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.style.setProperty('--i', String(i++));
            wi.textContent = p;
            w.appendChild(wi);
            frag.appendChild(w);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1) {
          walk(ch);
        }
      });
    };
    walk(el);
  }

  function initReveal() {
    qsa('[data-split]').forEach(splitWords);
    if (!('IntersectionObserver' in window)) { root.classList.add('no-anim'); return; }
    const els = qsa('[data-reveal], [data-split]:not([data-hero-split])');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- 7. MARQUESINA (movimiento constante + empuje por velocidad de scroll) ---------- */
  function initMarquee() {
    const lanes = [];
    qsa('[data-marquee]').forEach((row) => {
      const track = qs('.marquee__track', row);
      if (!track) return;
      const lane = document.createElement('div');
      lane.className = 'marquee__lane';
      const clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.replaceWith(lane);
      lane.append(track, clone);
      lanes.push(lane);
    });
    if (reduce || !lanes.length) return;
    let rate = 1;
    ticks.add(() => {
      const target = 1 + Math.min(5, Math.abs(S.vy) * 0.18);
      rate += (target - rate) * 0.08;
      lanes.forEach((lane) => {
        const a = lane.getAnimations()[0];
        if (a) a.playbackRate = rate;
      });
    });
  }

  /* ---------- 8. HERO: cables con pulsos, HUD y escenario 3D ---------- */
  let heroVisible = true;

  function initHero() {
    const hero = qs('.hero');
    if (!hero) return;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }, { threshold: 0 }).observe(hero);
    }

    /* 8.1 Canvas: cables de izaje que se mecen y por los que viajan pulsos de energía */
    const cv = qs('[data-hero-canvas]', hero);
    if (cv && cv.getContext) {
      const ctx = cv.getContext('2d');
      const TAU = Math.PI * 2;
      const rnd = (a, b) => a + Math.random() * (b - a);
      const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
      let w = 0, h = 0, lines = [], embers = [];

      const build = () => {
        const n = w < 520 ? 8 : w < 900 ? 14 : 24;
        lines = [];
        for (let i = 0; i < n; i++) {
          lines.push({
            x: ((i + 0.5) / n) * w + rnd(-0.3, 0.3) * (w / n),
            len: h * rnd(0.3, 0.86),
            ph: rnd(0, TAU), amp: rnd(3, 11), sp: rnd(0.25, 0.6),
            hook: Math.random() < 0.35, a: rnd(0.2, 0.42),
            pulses: [{ y: Math.random(), v: rnd(0.05, 0.12), red: Math.random() < 0.5 }]
          });
        }
        embers = [];
        const m = w < 520 ? 16 : 38;
        for (let i = 0; i < m; i++) embers.push({ x: rnd(0, w), y: rnd(0, h), r: rnd(0.6, 1.8), v: rnd(0.06, 0.22), ph: rnd(0, TAU) });
      };

      const xAt = (L, y, t) => {
        const k = y / L.len;
        let push = 0;
        const dx = L.x - mouse.x, dy = y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 170) push = (1 - d / 170) * (dx >= 0 ? 1 : -1) * 20 * k;
        return L.x + Math.sin(L.ph + t * L.sp) * L.amp * k * k + push;
      };

      const draw = (t, dt) => {
        ctx.clearRect(0, 0, w, h);
        mouse.x += (mouse.tx - mouse.x) * 0.1;
        mouse.y += (mouse.ty - mouse.y) * 0.1;
        lines.forEach((L) => {
          const g = ctx.createLinearGradient(0, 0, 0, L.len);
          g.addColorStop(0, 'rgba(163,182,255,0)');
          g.addColorStop(1, `rgba(163,182,255,${L.a})`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (let y = 0; y <= L.len; y += 14) {
            const x = xAt(L, y, t);
            if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
          // gancho al final del cable
          const ex = xAt(L, L.len, t);
          ctx.fillStyle = `rgba(163,182,255,${Math.min(0.7, L.a + 0.2)})`;
          ctx.beginPath(); ctx.arc(ex, L.len + 4, 3.2, 0, TAU); ctx.fill();
          if (L.hook) {
            ctx.strokeStyle = `rgba(163,182,255,${L.a + 0.15})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(ex, L.len + 14, 8, -Math.PI * 0.6, Math.PI * 0.75); ctx.stroke();
          }
          // pulsos de energía
          ctx.globalCompositeOperation = 'lighter';
          L.pulses.forEach((p) => {
            p.y += p.v * dt;
            if (p.y > 1) { p.y = 0; p.red = Math.random() < 0.5; }
            const py = p.y * L.len, px = xAt(L, py, t);
            const rg = ctx.createRadialGradient(px, py, 0, px, py, 15);
            rg.addColorStop(0, p.red ? 'rgba(255,90,115,.95)' : 'rgba(190,210,255,.95)');
            rg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = rg;
            ctx.fillRect(px - 15, py - 15, 30, 30);
          });
          ctx.globalCompositeOperation = 'source-over';
        });
        // chispas que suben (energía)
        embers.forEach((e) => {
          e.y -= e.v * dt * 60;
          if (e.y < -4) { e.y = h + 4; e.x = rnd(0, w); }
          const tw = 0.5 + 0.5 * Math.sin(t * 1.6 + e.ph);
          ctx.fillStyle = `rgba(190,210,255,${0.15 + tw * 0.45})`;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
        });
      };

      const resize = () => {
        const r = cv.getBoundingClientRect();
        if (lines.length && Math.abs(r.width - w) < 1 && Math.abs(r.height - h) < 1) return; // sin cambios
        w = r.width; h = r.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        build();
        draw(0, 0);
      };
      measurers.add(resize);
      resize();

      if (!reduce) {
        hero.addEventListener('pointermove', (e) => {
          const r = cv.getBoundingClientRect();
          mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top;
        });
        hero.addEventListener('pointerleave', () => { mouse.tx = -9999; mouse.ty = -9999; });
        ticks.add(() => { if (heroVisible) draw(S.t, S.dt); });
      }
    }

    /* 8.2 HUD: aguja del indicador de ángulo (decorativo) */
    const needle = qs('[data-needle]', hero);
    const txt = qs('[data-angle]', hero);
    if (needle && txt && !reduce) {
      let last = '';
      ticks.add(() => {
        if (!heroVisible) return;
        const a = 40 + 28 * Math.sin(S.t * 0.7) + 6 * Math.sin(S.t * 1.9);
        needle.style.transform = `rotate(${((a - 40) * 2.3).toFixed(1)}deg)`;
        const label = Math.round(a) + '°';
        if (label !== last) { txt.textContent = label; last = label; }
      });
    }

    /* 8.3 Inclinación 3D del escenario con el puntero */
    const stage = qs('[data-stage]', hero);
    if (stage && fine && !reduce) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        stage.style.setProperty('--ry', (nx * 14).toFixed(2) + 'deg');
        stage.style.setProperty('--rx', (-ny * 10).toFixed(2) + 'deg');
      });
      hero.addEventListener('pointerleave', () => {
        stage.style.setProperty('--ry', '0deg');
        stage.style.setProperty('--rx', '0deg');
      });
    }

    /* 8.4 Parallax suave del hero al bajar */
    if (!reduce) {
      ticks.add(() => {
        if (S.y > S.vh * 1.2) return;
        setVar(hero, '--hy', Math.round(S.y) + 'px');
      });
    }
  }

  /* ---------- 9. SECCIONES ANCLADAS (pinned) GUIADAS POR EL SCROLL ---------- */
  // Calcula el progreso 0..1 de una sección alta con un "stage" sticky, con inercia (slow motion)
  function makePinned(el, stage) {
    const o = {
      el, stage, top: 0, h: 0, sh: 0, raw: 0, cur: 0, vis: false,
      measure() {
        this.top = el.getBoundingClientRect().top + window.scrollY;
        this.h = el.offsetHeight;
        this.sh = stage.offsetHeight;
      },
      update() {
        const span = Math.max(1, this.h - this.sh);
        this.raw = clamp((S.y - this.top) / span);
        if (reduce) this.cur = this.raw;
        else {
          this.cur += (this.raw - this.cur) * (1 - Math.exp(-S.dt * 7));
          if (Math.abs(this.raw - this.cur) < 0.0004) this.cur = this.raw;
        }
        this.vis = S.y + S.vh > this.top - S.vh * 0.2 && S.y < this.top + this.h + S.vh * 0.2;
        return this.cur;
      }
    };
    o.measure();
    measurers.add(() => o.measure());
    return o;
  }

  /* 9.1 La obra en grande: la foto se abre a pantalla completa */
  function initExpand() {
    const sec = qs('[data-expand]');
    if (!sec) return;
    const pin = makePinned(sec, qs('.expand__stage', sec));
    ticks.add(() => {
      const p = pin.update();
      if (!pin.vis) return;
      const e = ease(clamp(p / 0.72));
      setVar(sec, '--p', e.toFixed(4));
      setVar(sec, '--c', clamp((p - 0.62) / 0.2).toFixed(3));
      sec.classList.toggle('is-open', e > 0.95);
    });
  }

  /* 9.2 Cómo trabajamos: esquema de grúa que se anima con el scroll */
  function initRig() {
    const sec = qs('[data-process]');
    if (!sec) return;
    const svg = qs('[data-rig]', sec);
    const wrap = qs('[data-rig-wrap]', sec);
    if (!svg || !wrap) return;
    const R = (k) => qs(`[data-r="${k}"]`, svg);
    const el = {
      truck: R('truck'), boom: R('boom'), tele: R('tele'), tip: R('tip'), cable: R('cable'),
      hook: R('hook'), slings: R('slings'), load: R('load'), done: R('done'),
      cyl1: R('cyl1'), cyl2: R('cyl2'), dims: R('dims'), dimx: R('dimx'), dimy: R('dimy'),
      lblx: R('lblx'), lbly: R('lbly'), tState: R('t-state'), tAngle: R('t-angle')
    };
    const wheels = qsa('[data-r="wheel"]', svg).map((g) => ({ spin: qs('[data-spin]', g), cx: Number(g.dataset.cx) }));
    const outs = qsa('[data-r="out"]', svg).map((g) => ({ leg: qs('[data-leg]', g), pad: qs('[data-pad]', g) }));
    const stepEls = qsa('[data-step]', sec);
    const states = ['EN RUTA', 'ESTABILIZANDO', 'AJUSTANDO PLUMA', 'IZANDO CARGA', 'CARGA COLOCADA'];

    // Geometría del esquema (viewBox 960×520)
    const PIV = { x: 250, y: 340 }, BASE = 300, A_STOW = 8, A_WORK = 44, E_WORK = 30;
    const DECK = 358, LOAD_H = 30, HANG = 48;
    const rad = (d) => (d * Math.PI) / 180;
    const tipFK = (a, L) => ({ x: PIV.x + L * Math.cos(rad(a)), y: PIV.y - L * Math.sin(rad(a)) });
    const TIP1 = tipFK(A_WORK, BASE + E_WORK);
    const CL1 = DECK - LOAD_H - HANG - TIP1.y;               // cable necesario para tocar la carga
    const TARGET = { x: 740, y: 250 - LOAD_H - HANG - 70 };  // punta final: viga sobre las columnas

    const m = { svgW: 0, wrapW: 0 };
    const pin = makePinned(sec, qs('.process__stage', sec));
    const measureRig = () => { m.svgW = svg.getBoundingClientRect().width; m.wrapW = wrap.clientWidth; };
    measurers.add(measureRig);
    measureRig();

    let lastState = '', lastAngle = '', lastStep = -1;

    const apply = (p) => {
      const eA = ease(seg(0, 0.14, p)), eB = ease(seg(0.14, 0.28, p));
      const eC = ease(seg(0.28, 0.46, p)), eCx = ease(seg(0.34, 0.46, p));
      const eD = ease(seg(0.46, 0.58, p)), eE = ease(seg(0.58, 0.68, p));
      const eF = ease(seg(0.68, 0.95, p)), eG = ease(seg(0.95, 1, p));

      const tx = -720 * (1 - eA);
      let a = lerp(A_STOW, A_WORK, eC);
      let L = BASE + E_WORK * eCx;
      let tip = tipFK(a, L);
      if (eF > 0) {
        tip = { x: lerp(TIP1.x, TARGET.x, eF), y: lerp(TIP1.y, TARGET.y, eF) };
        const dx = tip.x - PIV.x, dy = PIV.y - tip.y;
        a = (Math.atan2(dy, dx) * 180) / Math.PI;
        L = Math.hypot(dx, dy);
      }
      let clLoad = lerp(lerp(12, 28, eC), CL1, eD);
      clLoad = lerp(clLoad, 70, eE);
      const clHook = lerp(clLoad, 40, eG);
      const attached = p >= 0.58;
      const lx = attached ? tip.x : TIP1.x;
      const ly = attached ? tip.y + clLoad + HANG : DECK - LOAD_H;
      const ext = L - BASE;

      el.truck.setAttribute('transform', `translate(${tx.toFixed(1)} 0)`);
      wheels.forEach((w) => w.spin.setAttribute('transform', `rotate(${(((tx + 720) * 1.685) % 360).toFixed(1)} ${w.cx} 416)`));
      outs.forEach((o) => {
        o.leg.setAttribute('height', (49 * eB).toFixed(1));
        o.pad.setAttribute('y', (394 + 49 * eB).toFixed(1));
        o.pad.setAttribute('opacity', eB > 0.01 ? '1' : '0');
      });

      el.boom.setAttribute('transform', `translate(${PIV.x} ${PIV.y}) rotate(${(-a).toFixed(2)})`);
      el.tele.setAttribute('transform', `translate(${ext.toFixed(1)} 0)`);
      el.tip.setAttribute('transform', `translate(${(BASE + ext).toFixed(1)} 0)`);

      const ca = Math.cos(rad(a)), sa = Math.sin(rad(a));
      const bx = PIV.x + 110 * ca + 15 * sa, by = PIV.y - 110 * sa + 15 * ca;
      [el.cyl1, el.cyl2].forEach((l) => {
        l.setAttribute('x1', '236'); l.setAttribute('y1', '352');
        l.setAttribute('x2', bx.toFixed(1)); l.setAttribute('y2', by.toFixed(1));
      });

      el.cable.setAttribute('x1', tip.x.toFixed(1)); el.cable.setAttribute('y1', tip.y.toFixed(1));
      el.cable.setAttribute('x2', tip.x.toFixed(1)); el.cable.setAttribute('y2', (tip.y + clHook).toFixed(1));
      el.hook.setAttribute('transform', `translate(${tip.x.toFixed(1)} ${(tip.y + clHook).toFixed(1)})`);
      el.slings.setAttribute('opacity', (seg(0.56, 0.6, p) * (1 - seg(0.95, 0.99, p))).toFixed(2));
      el.load.setAttribute('transform', `translate(${lx.toFixed(1)} ${ly.toFixed(1)})`);

      // cotas de alcance y altura
      const tipX = tip.x + tx, pivX = PIV.x + tx;
      el.dims.setAttribute('opacity', seg(0.3, 0.42, p).toFixed(2));
      el.dimx.setAttribute('x1', pivX.toFixed(1)); el.dimx.setAttribute('x2', tipX.toFixed(1));
      el.lblx.setAttribute('x', ((pivX + tipX) / 2).toFixed(1));
      el.dimy.setAttribute('x1', tipX.toFixed(1)); el.dimy.setAttribute('x2', tipX.toFixed(1));
      el.dimy.setAttribute('y1', tip.y.toFixed(1));
      el.lbly.setAttribute('x', (tipX - 8).toFixed(1)); el.lbly.setAttribute('y', ((tip.y + 450) / 2).toFixed(1));
      el.lbly.setAttribute('text-anchor', 'end');
      el.done.setAttribute('opacity', seg(0.97, 1, p).toFixed(2));

      const idx = p < 0.14 ? 0 : p < 0.28 ? 1 : p < 0.46 ? 2 : p < 0.68 ? 3 : 4;
      if (states[idx] !== lastState) { el.tState.textContent = 'ESTADO · ' + states[idx]; lastState = states[idx]; }
      const ang = 'PLUMA · ' + pad2(Math.round(a)) + '°';
      if (ang !== lastAngle) { el.tAngle.textContent = ang; lastAngle = ang; }
      if (idx !== lastStep) {
        stepEls.forEach((li, i) => li.classList.toggle('is-active', i === idx));
        lastStep = idx;
      }

      // "cámara": en pantallas angostas el esquema es más ancho que el marco y sigue la acción
      const overflow = m.svgW - m.wrapW;
      if (overflow > 1) {
        let c = lerp(340, 470, ease(seg(0.3, 0.5, p)));
        c = lerp(c, 700, ease(seg(0.66, 0.95, p)));
        const shift = clamp((c * m.svgW) / 960 - m.wrapW / 2, 0, overflow);
        svg.style.translate = `${(-shift).toFixed(1)}px 0`;
      } else if (svg.style.translate) {
        svg.style.translate = '';
      }
    };

    apply(0);
    ticks.add(() => {
      const p = pin.update();
      if (!pin.vis) return;
      setVar(sec, '--pp', p.toFixed(4));
      apply(p);
    });
  }

  /* 9.3 En campo: la galería avanza en horizontal con el scroll vertical */
  function initHScroll() {
    const sec = qs('[data-hscroll]');
    if (!sec) return;
    const track = qs('[data-hs-track]', sec);
    const viewport = qs('.hs__viewport', sec);
    const bar = qs('[data-hs-bar]', sec);
    const now = qs('[data-hs-now]', sec);
    const total = qsa('.hs__card', sec).length;
    if (!track || !viewport) return;
    const pin = makePinned(sec, qs('.hs__stage', sec));
    const m = { dist: 0 };
    const measureHs = () => { m.dist = Math.max(0, track.scrollWidth - viewport.clientWidth); };
    measurers.add(measureHs);
    measureHs();
    let lastN = 0;
    ticks.add(() => {
      const p = pin.update();
      if (!pin.vis) return;
      track.style.transform = `translate3d(${(-m.dist * p).toFixed(1)}px,0,0)`;
      if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
      const n = Math.min(total, Math.floor(p * total) + 1);
      if (now && n !== lastN) { now.textContent = pad2(n); lastN = n; }
    });
  }

  /* 9.4 Progreso global (barra superior y riel lateral) */
  function initProgress() {
    const bar = qs('[data-progress]');
    const rail = qs('[data-rail]');
    const fill = qs('[data-rail-fill]');
    const links = rail ? qsa('a', rail) : [];
    const targets = links.map((a) => ({ el: qs(a.getAttribute('href')), top: 0 }));
    let maxScroll = 1;
    const measureP = () => {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - S.vh);
      targets.forEach((t) => { if (t.el) t.top = t.el.getBoundingClientRect().top + window.scrollY; });
    };
    measurers.add(measureP);
    measureP();
    let lastIdx = -1;
    ticks.add(() => {
      const p = clamp(S.y / maxScroll);
      if (bar) bar.style.setProperty('--p', p.toFixed(4));
      if (fill) fill.style.transform = `scaleY(${p.toFixed(4)})`;
      if (!links.length) return;
      const mid = S.y + S.vh * 0.45;
      let idx = 0;
      targets.forEach((t, i) => { if (t.el && t.top <= mid) idx = i; });
      if (idx !== lastIdx) {
        links.forEach((a, i) => {
          a.classList.toggle('is-active', i === idx);
          a.classList.toggle('is-past', i < idx);
          if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
        lastIdx = idx;
      }
    });
  }

  /* 9.5 Palabra gigante del pie con parallax */
  function initFooter() {
    const footer = qs('.footer');
    const mega = qs('[data-mega]');
    if (!footer || !mega || reduce) return;
    const m = { top: 0 };
    const measureF = () => { m.top = footer.getBoundingClientRect().top + window.scrollY; };
    measurers.add(measureF);
    measureF();
    ticks.add(() => {
      if (S.y + S.vh < m.top - 40) return;
      const k = 1 - clamp((S.y + S.vh - m.top) / (S.vh * 0.9));
      setVar(footer, '--mp', Math.round(k * 80) + 'px');
    });
  }

  /* ---------- 10. PESTAÑAS · RENTA · FAQ ---------- */
  function initTabs() {
    qsa('[data-tabs]').forEach((box) => {
      const btns = qsa('.tabs__btn', box);
      const panels = qsa('.tabs__panel', box);
      const bar = qs('.tabs__bar', box);
      const select = (i, focus) => {
        btns.forEach((b, j) => {
          const on = i === j;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
          b.tabIndex = on ? 0 : -1;
          panels[j].hidden = !on;
        });
        if (bar) {
          bar.style.setProperty('--x', btns[i].offsetLeft - 5 + 'px');
          bar.style.setProperty('--w', btns[i].offsetWidth + 'px');
        }
        if (focus) btns[i].focus();
      };
      btns.forEach((b, i) => {
        b.addEventListener('click', () => select(i));
        b.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            select((i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length, true);
          }
        });
      });
      const current = () => Math.max(0, btns.findIndex((b) => b.classList.contains('is-active')));
      select(0);
      measurers.add(() => select(current()));
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => select(current()));
    });
  }

  function initRental() {
    const box = qs('[data-rental]');
    if (!box) return;
    const ticksEls = qsa('.rental__tick', box);
    const panels = qsa('.rental__panel', box);
    const label = qs('[data-rental-label]', box);
    const cta = qs('.rental__cta', box);
    const select = (i, focus) => {
      ticksEls.forEach((t, j) => {
        const on = i === j;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      box.style.setProperty('--i', String(i));
      const periodo = ticksEls[i].dataset.periodo;
      if (label) label.textContent = periodo.toLowerCase();
      if (cta) cta.dataset.prefillPeriodo = periodo;
      if (focus) ticksEls[i].focus();
    };
    ticksEls.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          select((i + (e.key === 'ArrowRight' ? 1 : ticksEls.length - 1)) % ticksEls.length, true);
        }
      });
    });
    select(0);
  }

  function initFaq() {
    qsa('.faq__item').forEach((d) => {
      const sum = qs('summary', d);
      const body = qs('.faq__a', d);
      if (!sum || !body) return;
      let anim = null;
      sum.addEventListener('click', (e) => {
        e.preventDefault();
        if (reduce || !body.animate) { d.open = !d.open; return; }
        if (anim) anim.cancel();
        if (!d.open) {
          d.open = true;
          const h = body.offsetHeight;
          anim = body.animate({ height: ['0px', h + 'px'], opacity: [0, 1] }, { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)' });
          anim.onfinish = () => { anim = null; };
        } else {
          const h = body.offsetHeight;
          anim = body.animate({ height: [h + 'px', '0px'], opacity: [1, 0] }, { duration: 320, easing: 'ease' });
          anim.onfinish = () => { d.open = false; anim = null; };
        }
      });
    });
  }

  /* ---------- 11. FORMULARIO POR PASOS → WHATSAPP ---------- */
  function initQuote() {
    const f = qs('[data-quote]');
    if (!f) return;
    const steps = qsa('.qf__step', f);
    const dots = qsa('.qf__dots li', f);
    const back = qs('[data-qf-back]', f);
    const next = qs('[data-qf-next]', f);
    const send = qs('[data-qf-send]', f);
    const err = qs('[data-qf-error]', f);
    const note = qs('[data-qf-note]', f);
    const last = steps.length - 1;
    let i = 0;

    const show = (n) => {
      i = n;
      steps.forEach((s, k) => s.classList.toggle('is-active', k === n));
      dots.forEach((d, k) => d.classList.toggle('is-on', k <= n));
      back.hidden = n === 0;
      next.hidden = n === last;
      send.hidden = n !== last || !hasWA;
    };
    next.addEventListener('click', () => show(Math.min(last, i + 1)));
    back.addEventListener('click', () => show(Math.max(0, i - 1)));
    if (!hasWA && note) note.textContent = 'Estamos habilitando el envío por WhatsApp. Por favor, inténtalo más tarde.';

    const val = (n) => ((f.elements[n] && f.elements[n].value) || '').trim();
    const fmtFecha = (s) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (!m) return s;
      return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (i < last) { show(i + 1); return; }
      if (!hasWA) return;
      const nombre = val('nombre');
      if (!nombre) {
        err.hidden = false;
        f.elements.nombre.focus();
        return;
      }
      err.hidden = true;
      const lines = [`Hola, soy ${nombre}. Quiero cotizar la renta de una grúa.`];
      if (val('grua')) lines.push(`• Tipo de grúa: ${val('grua')}`);
      if (val('trabajo')) lines.push(`• Trabajo: ${val('trabajo')}`);
      if (val('detalles')) lines.push(`• Carga y detalles: ${val('detalles')}`);
      if (val('periodo')) lines.push(`• Tiempo de renta: ${val('periodo')}`);
      if (val('fecha')) lines.push(`• Fecha aproximada: ${fmtFecha(val('fecha'))}`);
      if (val('ubicacion')) lines.push(`• Ubicación: ${val('ubicacion')}`);
      lines.push('¿Me ayudan con una cotización? Gracias.');
      openWhatsApp(lines.join('\n'));
    });

    show(0);

    // Los botones de CTA de otras secciones pre-llenan el formulario
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-prefill-trabajo],[data-prefill-grua],[data-prefill-periodo]');
      if (!a) return;
      const set = (name, v) => {
        if (!v) return;
        const r = qsa(`input[name="${name}"]`, f).find((x) => x.value === v);
        if (r) r.checked = true;
      };
      set('trabajo', a.dataset.prefillTrabajo);
      set('grua', a.dataset.prefillGrua);
      set('periodo', a.dataset.prefillPeriodo);
      show(0);
    });
  }

  /* ---------- 12. ENCHUFE QUE CONECTA ---------- */
  function initPlug() {
    const art = qs('[data-plug-art]');
    const status = qs('[data-plug-status]');
    if (!art) return;

    const sparks = () => {
      if (reduce || !art.animate) return;
      for (let k = 0; k < 14; k++) {
        const s = document.createElement('i');
        s.className = 'spark';
        art.appendChild(s);
        const ang = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 60;
        s.animate(
          [{ transform: 'translate(0,0) scale(1)', opacity: 1 },
           { transform: `translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px) scale(.2)`, opacity: 0 }],
          { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.16,1,.3,1)' }
        ).onfinish = () => s.remove();
      }
    };

    const plugIn = () => {
      art.classList.add('is-plugged');
      setTimeout(() => { if (status) status.textContent = 'Conectado · listo para cotizar'; sparks(); }, reduce ? 0 : 2000);
    };
    if (!('IntersectionObserver' in window)) { plugIn(); return; }
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) { plugIn(); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(art);
  }

  /* ---------- 13. INTERACCIÓN: tilt, spotlight, botones magnéticos ---------- */
  function initPointerFx() {
    if (!fine || reduce) return;

    qsa('[data-tilt]').forEach((el) => {
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          el.style.setProperty('--ry', ((x - 0.5) * 8).toFixed(2) + 'deg');
          el.style.setProperty('--rx', ((0.5 - y) * 6).toFixed(2) + 'deg');
          el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
          el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        });
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });

    qsa('.spot:not([data-tilt])').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
      });
    });

    qsa('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
        b.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
      });
      b.addEventListener('pointerleave', () => { b.style.translate = ''; });
    });
  }

  /* ---------- 14. BUCLE PRINCIPAL E INICIO ---------- */
  let last = performance.now();
  function loop(now) {
    S.dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    S.t = now / 1000;
    const y = window.scrollY;
    S.vy = y - S.y;
    S.y = y;
    ticks.forEach((fn) => {
      try { fn(); } catch (err) { console.error(err); ticks.delete(fn); }
    });
    requestAnimationFrame(loop);
  }

  let resizeTimer = 0;
  function measureAll() {
    S.vh = window.innerHeight;
    S.vw = window.innerWidth;
    measurers.forEach((fn) => safe(fn));
  }
  function scheduleMeasure() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measureAll, 140);
  }

  function init() {
    const yearEl = qs('[data-year]');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    [initWhatsApp, initReveal, initHeader, initMarquee, initHero, initExpand, initRig, initHScroll,
      initProgress, initFooter, initTabs, initRental, initFaq, initQuote, initPlug, initPointerFx
    ].forEach(safe);
    safe(initLoader);

    window.addEventListener('resize', scheduleMeasure, { passive: true });
    window.addEventListener('load', scheduleMeasure);
    if ('ResizeObserver' in window) new ResizeObserver(scheduleMeasure).observe(document.body);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMeasure);

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
