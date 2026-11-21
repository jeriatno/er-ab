/* ER-AB — aplikasi statis tanpa framework. Data disimpan di localStorage. */
(() => {
  'use strict';

  const STORE_KEY = 'rab-mudah:v1';

  // ---------- Helper ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const fmt = (n) => Math.round(n || 0).toLocaleString('id-ID');
  const rp = (n) => 'Rp ' + fmt(n);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const HAS_OP = /[+\-*/×÷xX:()]/;
  function evalExpr(raw, isPrice = false) {
    let s = String(raw ?? '').trim();
    if (!s) return null;
    if (isPrice) {
      let prev;
      do { prev = s; s = s.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2'); } while (s !== prev);
    }
    s = s.replace(/,/g, '.').replace(/[×xX]/g, '*').replace(/[÷:]/g, '/').replace(/\s+/g, '');
    if (!/^[\d.+\-*/()]+$/.test(s)) return null;
    let i = 0;
    const parseExpr = () => {
      let val = parseTerm();
      while (s[i] === '+' || s[i] === '-') {
        const op = s[i++];
        const r = parseTerm();
        val = op === '+' ? val + r : val - r;
      }
      return val;
    };
    const parseTerm = () => {
      let val = parseFactor();
      while (s[i] === '*' || s[i] === '/') {
        const op = s[i++];
        const r = parseFactor();
        val = op === '*' ? val * r : (r === 0 ? NaN : val / r);
      }
      return val;
    };
    const parseFactor = () => {
      if (s[i] === '+') { i++; return parseFactor(); }
      if (s[i] === '-') { i++; return -parseFactor(); }
      if (s[i] === '(') {
        i++;
        const v = parseExpr();
        if (s[i] !== ')') return NaN;
        i++;
        return v;
      }
      const start = i;
      while (i < s.length && (s[i] === '.' || (s[i] >= '0' && s[i] <= '9'))) i++;
      if (i === start) return NaN;
      return parseFloat(s.slice(start, i));
    };
    const res = parseExpr();
    return (i === s.length && isFinite(res)) ? Math.max(0, res) : null;
  }

  const cleanNum = (n) => String(Math.round(n * 1000) / 1000);
  const num = (v, isPrice = false) => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const res = evalExpr(v, isPrice);
    if (res !== null) return res;
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  };
  const fmtVol = (v) => num(v).toLocaleString('id-ID', { maximumFractionDigits: 3 });
  const letter = (i) => {
    let s = '';
    i += 1;
    while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  };
  const fmtDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const slug = (s) => (String(s || 'proyek').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyek');

  function terbilang(n) {
    n = Math.floor(Math.abs(n));
    const a = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
    const f = (x) => {
      if (x < 12) return a[x];
      if (x < 20) return f(x - 10) + ' belas';
      if (x < 100) return f(Math.floor(x / 10)) + ' puluh ' + f(x % 10);
      if (x < 200) return 'seratus ' + f(x - 100);
      if (x < 1000) return f(Math.floor(x / 100)) + ' ratus ' + f(x % 100);
      if (x < 2000) return 'seribu ' + f(x - 1000);
      if (x < 1e6) return f(Math.floor(x / 1000)) + ' ribu ' + f(x % 1000);
      if (x < 1e9) return f(Math.floor(x / 1e6)) + ' juta ' + f(x % 1e6);
      if (x < 1e12) return f(Math.floor(x / 1e9)) + ' miliar ' + f(x % 1e9);
      return f(Math.floor(x / 1e12)) + ' triliun ' + f(x % 1e12);
    };
    const s = (n === 0 ? 'nol' : f(n)).replace(/\s+/g, ' ').trim() + ' rupiah';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- Proyek kosong ----------
  function makeProject(name) {
    return {
      id: uid(),
      name: name || '',
      owner: '',
      location: '',
      date: '',
      area: '',
      contingency: 0,
      profit: 0,
      tax: 0,
      sections: [],
      updatedAt: Date.now(),
    };
  }

  function sanitizeProject(p) {
    const str = (v) => (v == null ? '' : String(v));
    return {
      id: uid(),
      name: str(p.name) || 'RAB',
      owner: str(p.owner),
      location: str(p.location),
      date: str(p.date),
      area: str(p.area),
      contingency: num(p.contingency),
      profit: num(p.profit),
      tax: num(p.tax),
      sections: (Array.isArray(p.sections) ? p.sections : []).map((s) => ({
        id: uid(),
        name: str(s.name),
        collapsed: !!s.collapsed,
        items: (Array.isArray(s.items) ? s.items : []).map((it) => ({
          id: uid(), desc: str(it.desc), vol: str(it.vol), unit: str(it.unit), price: num(it.price),
        })),
      })),
      updatedAt: Date.now(),
    };
  }

  // ---------- State & penyimpanan ----------
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY));
      if (d && Array.isArray(d.projects)) return d;
    } catch (_) { /* abaikan */ }
    return { currentId: null, projects: [] };
  }

  let db = load();
  let hideAmount = false;
  try { hideAmount = localStorage.getItem(STORE_KEY + ':hide') === '1'; } catch (_) { /* abaikan */ }
  const cur = () => db.projects.find((p) => p.id === db.currentId);

  const els = {
    projDd: $('#projDd'),
    projTrigger: $('#projTrigger'),
    projCurrent: $('#projCurrent'),
    projMenu: $('#projMenu'),
    projSearch: $('#projSearch'),
    projList: $('#projList'),
    sections: $('#sections'),
    grand: $('#grandTotal'),
    rounded: $('#rounded'),
    perM2: $('#perM2'),
    recap: $('#recap'),
    mobileTotal: $('#mobileTotal'),
    saved: $('#savedState'),
    toast: $('#toast'),
    dialog: $('#newDialog'),
    form: $('#newForm'),
    genDialog: $('#genDialog'),
    genForm: $('#genForm'),
    genTotal: $('#genTotal'),
    genMeta: $('#genMeta'),
    print: $('#printArea'),
    file: $('#fileInput'),
  };

  let saveTimer = null;
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
      els.saved.textContent = '✓ Tersimpan otomatis di perangkat ini';
    } catch (_) {
      els.saved.textContent = '⚠ Gagal menyimpan — simpan cadangan secara manual';
    }
  }
  function save() {
    const p = cur();
    if (p) p.updatedAt = Date.now();
    els.saved.textContent = 'Menyimpan…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 300);
  }
  window.addEventListener('pagehide', () => { if (saveTimer) flush(); });

  // ---------- Perhitungan ----------
  function calc(p) {
    const secs = p.sections.map((s) => s.items.reduce((a, it) => a + num(it.vol) * num(it.price), 0));
    const subtotal = secs.reduce((a, b) => a + b, 0);
    const cont = subtotal * num(p.contingency) / 100;
    const profit = subtotal * num(p.profit) / 100;
    const base = subtotal + cont + profit;
    const tax = base * num(p.tax) / 100;
    const total = base + tax;
    return { secs, subtotal, cont, profit, tax, total, rounded: Math.ceil(total / 1000) * 1000 };
  }

  // ---------- Render ----------
  const ICON = {
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    grip: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  };

  function itemHTML(it) {
    return `<div class="item" data-iid="${it.id}">
      <button type="button" class="icon-btn drag-handle" data-drag="item" title="Geser untuk atur urutan" aria-label="Geser untuk atur urutan">${ICON.grip}</button>
      <label class="cell c-desc"><span class="cell-label">Uraian pekerjaan</span><input data-ifield="desc" value="${esc(it.desc)}" placeholder="mis. Pasang keramik lantai" aria-label="Uraian pekerjaan" autocomplete="off"></label>
      <label class="cell c-vol"><span class="cell-label">Volume</span><input data-ifield="vol" inputmode="decimal" value="${esc(it.vol)}" placeholder="0" aria-label="Volume" autocomplete="off"></label>
      <label class="cell c-unit"><span class="cell-label">Satuan</span><input data-ifield="unit" list="unitList" value="${esc(it.unit)}" placeholder="m²" aria-label="Satuan" autocomplete="off"></label>
      <label class="cell c-price"><span class="cell-label">Harga satuan (Rp)</span><input data-ifield="price" inputmode="numeric" value="${it.price ? fmt(it.price) : ''}" placeholder="0" aria-label="Harga satuan dalam rupiah" autocomplete="off"></label>
      <div class="cell c-total"><span class="cell-label">Jumlah</span><output data-itotal>Rp 0</output></div>
      <button type="button" class="icon-btn danger c-del" data-act="del-item" title="Hapus item" aria-label="Hapus item">${ICON.x}</button>
    </div>`;
  }

  function sectionHTML(s, i) {
    return `<article class="card sec${s.collapsed ? ' collapsed' : ''}" data-sid="${s.id}">
      <div class="sec-top">
        <span class="sec-letter" aria-hidden="true">${letter(i)}</span>
        <input class="sec-name" data-sfield="name" value="${esc(s.name)}" placeholder="Nama kelompok, mis. Pekerjaan Atap" aria-label="Nama kelompok pekerjaan" autocomplete="off">
        <span class="sec-count">${s.items.length} item</span>
        <span class="sec-total" data-sectotal>Rp 0</span>
        <button type="button" class="icon-btn" data-act="toggle" aria-expanded="${!s.collapsed}" title="Buka / tutup" aria-label="Buka atau tutup kelompok">${ICON.chevron}</button>
        <button type="button" class="icon-btn danger" data-act="del-section" title="Hapus kelompok" aria-label="Hapus kelompok">${ICON.trash}</button>
      </div>
      <div class="sec-body">
        <div class="item-head" aria-hidden="true"><span></span><span>Uraian pekerjaan</span><span>Volume</span><span>Satuan</span><span>Harga satuan (Rp)</span><span class="r">Jumlah</span><span></span></div>
        <div class="items">${s.items.map(itemHTML).join('')}</div>
        <button type="button" class="btn btn-ghost add-item" data-act="add-item">+ Tambah item</button>
      </div>
    </article>`;
  }

  function renderProjectList(query = '') {
    const q = query.trim().toLowerCase();
    const list = q
      ? db.projects.filter((p) => `${p.name} ${p.owner} ${p.location}`.toLowerCase().includes(q))
      : db.projects;

    if (!list.length) {
      els.projList.innerHTML = '<div class="proj-empty">Tidak ada proyek yang cocok</div>';
      return;
    }

    els.projList.innerHTML = list.map((p) => {
      const active = p.id === db.currentId;
      const tot = calc(p).total;
      const meta = [p.location || p.owner, tot > 0 ? rp(tot) : `${p.sections.length} kelompok`].filter(Boolean).join(' · ');
      return `<button type="button" class="proj-opt${active ? ' active' : ''}" role="option" aria-selected="${active}" data-pid="${p.id}">
        <span class="proj-opt-main">
          <span class="proj-opt-name">${esc(p.name || 'Tanpa nama')}</span>
          <span class="proj-opt-meta">${esc(meta)}</span>
        </span>
        ${active ? '<span class="proj-opt-check" aria-hidden="true">✓</span>' : ''}
      </button>`;
    }).join('');
  }

  function renderProjectSelect() {
    const p = cur();
    const label = p?.name?.trim() || 'Tanpa nama';
    els.projCurrent.textContent = label;
    els.projCurrent.classList.toggle('is-empty', !p?.name?.trim());
    if (!els.projMenu.hidden) renderProjectList(els.projSearch.value);
  }

  function renderInfo() {
    const p = cur();
    document.querySelectorAll('[data-field]').forEach((el) => {
      const f = el.dataset.field;
      const v = p[f];
      el.value = (['contingency', 'profit', 'tax'].includes(f) && !num(v)) ? '' : (v ?? '');
    });
  }

  function renderSections() {
    const p = cur();
    els.sections.innerHTML = p.sections.length
      ? p.sections.map(sectionHTML).join('')
      : '<div class="empty">Belum ada pekerjaan. Klik <b>✨ Generate Otomatis</b> di atas atau tombol di bawah untuk menambah manual.</div>';
  }

  function renderTotals() {
    const p = cur();
    const c = calc(p);

    p.sections.forEach((s, i) => {
      const secEl = els.sections.querySelector(`[data-sid="${s.id}"]`);
      if (!secEl) return;
      secEl.querySelector('[data-sectotal]').textContent = rp(c.secs[i]);
      secEl.querySelector('.sec-letter').textContent = letter(i);
      secEl.querySelector('.sec-count').textContent = s.items.length + ' item';
      s.items.forEach((it) => {
        const out = secEl.querySelector(`[data-iid="${it.id}"] [data-itotal]`);
        if (out) out.textContent = rp(num(it.vol) * num(it.price));
      });
    });

    const MASK = 'Rp •••••••';
    const showVal = (v) => (hideAmount ? MASK : rp(v));

    els.grand.textContent = showVal(c.total);
    els.mobileTotal.textContent = showVal(c.total);
    const fsTotal = $('#fsTotal');
    if (fsTotal) fsTotal.textContent = 'Total: ' + showVal(c.total);
    els.rounded.textContent = hideAmount
      ? 'Nominal disembunyikan'
      : (c.total > 0 ? terbilang(c.rounded) : 'Mulai isi volume dan harga satuan');

    const area = num(p.area);
    if (area > 0 && c.total > 0) {
      els.perM2.hidden = false;
      els.perM2.textContent = `≈ ${rp(c.total / area)} per m² bangunan`;
    } else {
      els.perM2.hidden = true;
    }

    const row = (label, val, cls = '', maskable = false) => `<div class="recap-row ${cls}"><span title="${esc(label)}">${esc(label)}</span><span>${maskable ? showVal(val) : rp(val)}</span></div>`;
    let html = p.sections.map((s, i) => row(`${letter(i)}. ${s.name || 'Tanpa nama'}`, c.secs[i])).join('');
    html += row('Total pekerjaan', c.subtotal, 'strong', true);
    if (num(p.contingency)) html += row(`Tak terduga (${num(p.contingency)}%)`, c.cont);
    if (num(p.profit)) html += row(`Jasa kontraktor (${num(p.profit)}%)`, c.profit);
    if (num(p.tax)) html += row(`PPN / Pajak (${num(p.tax)}%)`, c.tax);
    if (c.total !== c.subtotal) html += row('Total anggaran', c.total, 'strong', true);
    els.recap.innerHTML = html;
  }

  function renderAll() {
    renderProjectSelect();
    renderInfo();
    renderSections();
    renderTotals();
  }

  // ---------- Input uang & kalkulator inline ----------
  function moneyInput(el) {
    if (HAS_OP.test(el.value)) {
      el.value = el.value.replace(/[^\d.,+\-*/×÷xX:()\s]/g, '');
      const v = evalExpr(el.value, true);
      return v !== null ? Math.round(v) : 0;
    }
    const pos = el.selectionStart ?? el.value.length;
    const digitsBefore = el.value.slice(0, pos).replace(/\D/g, '').length;
    const digits = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
    const n = digits ? Number(digits) : 0;
    el.value = digits ? fmt(n) : '';
    let i = 0;
    let seen = 0;
    while (i < el.value.length && seen < digitsBefore) { if (/\d/.test(el.value[i])) seen++; i++; }
    try { el.setSelectionRange(i, i); } catch (_) { /* abaikan */ }
    return n;
  }

  function commitCalc(t) {
    if (!(t instanceof HTMLInputElement)) return false;
    const isPrice = t.dataset.ifield === 'price' || t.hasAttribute('data-fprice');
    const isVol = t.dataset.ifield === 'vol';
    const isCalc = isPrice || isVol || t.hasAttribute('data-calc');
    if (!isCalc || !HAS_OP.test(t.value)) return false;

    const res = evalExpr(t.value, isPrice);
    if (res === null) return false;

    const p = cur();
    if (t.hasAttribute('data-fprice')) {
      const n = Math.round(res);
      t.value = n ? fmt(n) : '';
      t.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (t.hasAttribute('data-fvol') || t.dataset.coeff) {
      t.value = cleanNum(res);
      t.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (isPrice) {
      const n = Math.round(res);
      t.value = n ? fmt(n) : '';
      const s = p && p.sections.find((x) => x.id === t.closest('[data-sid]')?.dataset.sid);
      const it = s && s.items.find((x) => x.id === t.closest('[data-iid]')?.dataset.iid);
      if (it) { it.price = n; renderTotals(); save(); }
    } else if (isVol) {
      const str = cleanNum(res);
      t.value = str;
      const s = p && p.sections.find((x) => x.id === t.closest('[data-sid]')?.dataset.sid);
      const it = s && s.items.find((x) => x.id === t.closest('[data-iid]')?.dataset.iid);
      if (it) { it.vol = str; renderTotals(); save(); }
    } else if (t.dataset.field) {
      const f = t.dataset.field;
      const str = cleanNum(res);
      t.value = str;
      if (p) {
        p[f] = ['contingency', 'profit', 'tax'].includes(f) ? res : str;
        renderTotals();
        save();
      }
    } else {
      t.value = cleanNum(res);
      if (t.form === els.genForm) updateGenUI();
    }
    return true;
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function hideToast() { els.toast.classList.remove('show'); }
  function toast(msg, undo) {
    els.toast.innerHTML = `<span>${esc(msg)}</span>` + (undo ? '<button type="button">Batalkan</button>' : '');
    if (undo) els.toast.querySelector('button').onclick = () => { undo(); hideToast(); };
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 5000);
  }

  // ---------- Event: input ----------
  document.addEventListener('input', (e) => {
    const t = e.target;
    const p = cur();
    if (!p || !(t instanceof HTMLInputElement)) return;

    if (t.dataset.field) {
      const f = t.dataset.field;
      if (t.hasAttribute('data-calc')) t.value = t.value.replace(/[^\d.,+\-*/×÷xX:()\s]/g, '');
      p[f] = ['contingency', 'profit', 'tax'].includes(f) ? num(t.value) : t.value;
      if (f === 'name') renderProjectSelect();
      renderTotals();
      save();
      return;
    }

    if (t.hasAttribute('data-calc') && !t.dataset.ifield) {
      t.value = t.value.replace(/[^\d.,+\-*/×÷xX:()\s]/g, '');
      return;
    }

    const secEl = t.closest('[data-sid]');
    if (!secEl) return;
    const s = p.sections.find((x) => x.id === secEl.dataset.sid);
    if (!s) return;

    if (t.dataset.sfield) {
      s.name = t.value;
    } else if (t.dataset.ifield) {
      const it = s.items.find((x) => x.id === t.closest('[data-iid]').dataset.iid);
      const f = t.dataset.ifield;
      if (f === 'price') it.price = moneyInput(t);
      else if (f === 'vol') { t.value = t.value.replace(/[^\d.,+\-*/×÷xX:()\s]/g, ''); it.vol = t.value; }
      else it[f] = t.value;
    }
    renderTotals();
    save();
  });

  // Hitung ekspresi matematika saat meninggalkan kolom
  document.addEventListener('focusout', (e) => { commitCalc(e.target); });

  // Enter di kolom kalkulasi / item
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key !== 'Enter' || !(t instanceof HTMLInputElement)) return;
    if (commitCalc(t)) { e.preventDefault(); return; }
    if (!t.dataset.ifield) return;
    e.preventDefault();
    const row = t.closest('.item');
    const inputs = [...row.querySelectorAll('input')];
    const idx = inputs.indexOf(t);
    if (idx < inputs.length - 1) { inputs[idx + 1].focus(); return; }
    const next = row.nextElementSibling;
    if (next) next.querySelector('input').focus();
    else row.closest('.sec').querySelector('[data-act="add-item"]').click();
  });

  // ---------- Drag & drop urutan item (mouse, sentuh & keyboard) ----------
  let drag = null;

  function endDrag() {
    if (!drag) return;
    const { row, container, sec, handle, pointerId } = drag;
    drag = null;
    row.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    try { handle.releasePointerCapture(pointerId); } catch (_) { /* abaikan */ }

    const byId = new Map(sec.items.map((it) => [it.id, it]));
    const next = [...container.querySelectorAll('.item')].map((el) => byId.get(el.dataset.iid)).filter(Boolean);
    const changed = next.length === sec.items.length && next.some((it, i) => it.id !== sec.items[i].id);
    if (changed) {
      sec.items = next;
      save();
    }
  }

  document.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag="item"]');
    if (!handle || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const row = handle.closest('.item');
    const secEl = row && row.closest('[data-sid]');
    const p = cur();
    const sec = p && secEl && p.sections.find((x) => x.id === secEl.dataset.sid);
    if (!sec || sec.items.length < 2) return;

    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch (_) { /* abaikan */ }
    row.classList.add('dragging');
    document.body.classList.add('is-dragging');
    drag = { row, container: row.parentElement, sec, handle, pointerId: e.pointerId };
  });

  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    const { row, container } = drag;
    const siblings = [...container.querySelectorAll('.item:not(.dragging)')];
    const target = siblings.find((el) => {
      const r = el.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (target) {
      if (row.nextElementSibling !== target) container.insertBefore(row, target);
    } else if (row.nextElementSibling) {
      container.appendChild(row);
    }

    const margin = 72;
    if (e.clientY < margin) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - margin) window.scrollBy(0, 12);
  });

  document.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.pointerId) endDrag(); });
  document.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.pointerId) endDrag(); });

  document.addEventListener('keydown', (e) => {
    const handle = e.target.closest && e.target.closest('[data-drag="item"]');
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const row = handle.closest('.item');
    const secEl = row && row.closest('[data-sid]');
    const sec = cur()?.sections.find((x) => x.id === secEl?.dataset.sid);
    if (!sec) return;
    const idx = sec.items.findIndex((x) => x.id === row.dataset.iid);
    const nextIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
    if (idx < 0 || nextIdx < 0 || nextIdx >= sec.items.length) return;
    e.preventDefault();
    const [moved] = sec.items.splice(idx, 1);
    sec.items.splice(nextIdx, 0, moved);
    const container = row.parentElement;
    if (e.key === 'ArrowUp') container.insertBefore(row, row.previousElementSibling);
    else container.insertBefore(row.nextElementSibling, row);
    handle.focus();
    save();
  });

  // ---------- Event: klik ----------
  document.addEventListener('click', (e) => {
    const cardBtn = e.target.closest('[data-card-toggle]');
    if (cardBtn) {
      const card = cardBtn.closest('.card');
      const collapsed = card.classList.toggle('collapsed');
      cardBtn.setAttribute('aria-expanded', String(!collapsed));
      return;
    }

    const b = e.target.closest('[data-act]');
    if (!b) return;
    const p = cur();
    const secEl = b.closest('[data-sid]');
    const s = secEl && p.sections.find((x) => x.id === secEl.dataset.sid);
    if (!s) return;

    switch (b.dataset.act) {
      case 'toggle':
        s.collapsed = !s.collapsed;
        secEl.classList.toggle('collapsed', s.collapsed);
        b.setAttribute('aria-expanded', String(!s.collapsed));
        save();
        break;

      case 'add-item': {
        const it = { id: uid(), desc: '', vol: '', unit: '', price: 0 };
        s.items.push(it);
        secEl.querySelector('.items').insertAdjacentHTML('beforeend', itemHTML(it));
        secEl.querySelector(`[data-iid="${it.id}"] input`).focus();
        renderTotals();
        save();
        break;
      }

      case 'del-item': {
        const row = b.closest('[data-iid]');
        const idx = s.items.findIndex((x) => x.id === row.dataset.iid);
        const [removed] = s.items.splice(idx, 1);
        row.remove();
        renderTotals();
        save();
        toast('Item dihapus', () => { s.items.splice(idx, 0, removed); renderSections(); renderTotals(); save(); });
        break;
      }

      case 'del-section': {
        const idx = p.sections.indexOf(s);
        p.sections.splice(idx, 1);
        renderSections();
        renderTotals();
        save();
        toast(`Kelompok "${s.name || 'tanpa nama'}" dihapus`, () => { p.sections.splice(idx, 0, s); renderSections(); renderTotals(); save(); });
        break;
      }
    }
  });

  $('#btnAddSection').addEventListener('click', () => {
    const p = cur();
    const s = { id: uid(), name: '', collapsed: false, items: [{ id: uid(), desc: '', vol: '', unit: '', price: 0 }] };
    p.sections.push(s);
    renderSections();
    renderTotals();
    save();
    const input = els.sections.querySelector(`[data-sid="${s.id}"] .sec-name`);
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
  });

  // ---------- Generator RAB otomatis (berbasis rumus standar + custom) ----------
  const r1 = (n) => Math.round(n * 10) / 10;

  // Daftar jenis proyek dinamis — cukup tambah entri di sini jika ada tipe baru
  const PROJECT_TYPES = [
    { id: 'bangun', icon: '🏠', name: 'Bangun Rumah Baru', desc: 'Lengkap dari persiapan sampai finishing', keywords: 'rumah bangun baru struktur pondasi' },
    { id: 'renovasi', icon: '🛠️', name: 'Renovasi Rumah', desc: 'Pilih bagian rumah yang ingin direnovasi', keywords: 'renovasi perbaikan bongkar cat lantai' },
    { id: 'tambah', icon: '➕', name: 'Tambah Ruangan', desc: 'Nambah kamar, dapur, atau ruang baru', keywords: 'tambah ruangan kamar dapur kamar mandi dak' },
    { id: 'pagar', icon: '🧱', name: 'Bangun Pagar Rumah', desc: 'Pondasi, dinding/besi, gerbang & cat', keywords: 'pagar tembok besi hollow gerbang' },
    { id: 'kanopi', icon: '⛱️', name: 'Pasang Kanopi', desc: 'Rangka, penutup atap, talang & finishing', keywords: 'kanopi carport alderon spandek baja ringan' },
  ];

  const DEFAULT_COEFFS = {
    priceFactor: 100,
    wallRatio: 2.75,
    roofRatio: 1.38,
    perimRatio: 1.35,
    roomHeight: 3.2,
    roomWallRatio: 0.78,
    roomRoofRatio: 1.35,
    gateWidth: 3.5,
    fenceColDist: 3,
    canopyPostDist: 3,
    canopyPipeLen: 4,
    renovWallRatio: 1.4,
    renovPaintRatio: 2.8,
    renovRoofRatio: 1.32,
  };

  const COEFF_META = {
    bangun: [
      ['priceFactor', 'Faktor harga wilayah (%)', '100 = standar rata-rata, 110 = +10% harga lokal'],
      ['wallRatio', 'Rasio dinding per m² lantai', '2.75 ≈ total luas dinding 1 sisi terhadap luas bangunan'],
      ['roofRatio', 'Rasio luas atap', '1.38 ≈ kemiringan atap + overstek sekitar 38%'],
      ['perimRatio', 'Rasio keliling pondasi', '1.35 ≈ keliling luar + jalur pondasi dinding dalam'],
    ],
    renovasi: [
      ['priceFactor', 'Faktor harga wilayah (%)', '100 = standar rata-rata, 110 = +10% harga lokal'],
      ['renovWallRatio', 'Rasio dinding renovasi', '1.4 ≈ perkiraan luas dinding yang diperbaiki'],
      ['renovPaintRatio', 'Rasio luas cat dinding', '2.8 ≈ luas bidang cat dinding dalam & luar'],
      ['renovRoofRatio', 'Rasio luas atap', '1.32 ≈ kemiringan atap + overstek sekitar 32%'],
    ],
    tambah: [
      ['priceFactor', 'Faktor harga wilayah (%)', '100 = standar rata-rata, 110 = +10% harga lokal'],
      ['roomHeight', 'Tinggi dinding (m)', 'Standar rumah tinggal biasanya 3,0 – 3,5 m'],
      ['roomWallRatio', 'Rasio dinding baru', '0.78 ≈ 3 sisi baru (1 sisi menempel rumah lama); 1 = 4 sisi baru'],
      ['roomRoofRatio', 'Rasio luas atap', '1.35 ≈ kemiringan atap + overstek ~35% (dak datar ≈ 1.1)'],
    ],
    pagar: [
      ['priceFactor', 'Faktor harga wilayah (%)', '100 = standar rata-rata, 110 = +10% harga lokal'],
      ['gateWidth', 'Lebar pintu gerbang (m)', 'Standar carport 1 mobil sekitar 3 – 3,5 m'],
      ['fenceColDist', 'Jarak antar kolom pagar (m)', 'Umumnya kolom praktis dipasang tiap 3 m'],
    ],
    kanopi: [
      ['priceFactor', 'Faktor harga wilayah (%)', '100 = standar rata-rata, 110 = +10% harga lokal'],
      ['canopyPostDist', 'Jarak antar tiang (m)', 'Umumnya tiang penyangga dipasang tiap 3 m'],
      ['canopyPipeLen', 'Panjang pipa buangan (m)', 'Pipa turun air hujan dari talang ke saluran'],
    ],
  };

  let genCoeffs = { ...DEFAULT_COEFFS };
  let lastFormulaType = '';

  function applyFormulaCustom(secs) {
    const pf = Math.max(0.1, num(genCoeffs.priceFactor) / 100 || 1);
    if (pf !== 1) {
      secs.forEach((s) => {
        s.items.forEach((it) => { it.price = Math.round(it.price * pf); });
      });
    }
    return secs;
  }

  function buildGeneratedSections(opts) {
    const cf = genCoeffs;
    const area = num(opts.area);
    const floors = opts.floors === 2 ? 2 : 1;
    const beds = Math.max(0, Math.round(num(opts.bedrooms)));
    const baths = Math.max(0, Math.round(num(opts.bathrooms)));
    const tier = opts.tier || 'standar';

    const T = {
      ekonomis: {
        wallLabel: 'Pasangan bata ringan / batako', wallPrice: 135000,
        floorLabel: 'Pasang keramik lantai 40×40', floorPrice: 175000,
        bathWallPrice: 195000,
        roofLabel: 'Penutup atap genteng metal', roofPrice: 110000,
        framePrice: 175000,
        ceilingLabel: 'Plafon hollow + gypsum standar', ceilingPrice: 140000,
        doorPrice: 1100000, winPrice: 600000, kusenPrice: 950000,
        closetLabel: 'Kloset jongkok / duduk ekonomis + aksesori', closetPrice: 1400000,
        paintPrice: 28000, elecPrice: 295000, concMul: 0.92,
      },
      standar: {
        wallLabel: 'Pasangan bata merah / hebel', wallPrice: 155000,
        floorLabel: 'Pasang granit lantai 60×60', floorPrice: 265000,
        bathWallPrice: 245000,
        roofLabel: 'Penutup atap genteng metal berpasir / beton', roofPrice: 145000,
        framePrice: 205000,
        ceilingLabel: 'Plafon hollow galvanis + gypsum 9mm', ceilingPrice: 165000,
        doorPrice: 1500000, winPrice: 800000, kusenPrice: 1250000,
        closetLabel: 'Kloset duduk standar + shower & aksesori', closetPrice: 2400000,
        paintPrice: 36000, elecPrice: 340000, concMul: 1,
      },
      premium: {
        wallLabel: 'Pasangan bata merah / hebel pilihan', wallPrice: 185000,
        floorLabel: 'Pasang granit premium 60×60 / 80×80', floorPrice: 385000,
        bathWallPrice: 330000,
        roofLabel: 'Penutup atap genteng keramik / bitumen', roofPrice: 220000,
        framePrice: 245000,
        ceilingLabel: 'Plafon gypsum + drop ceiling & list', ceilingPrice: 235000,
        doorPrice: 2350000, winPrice: 1250000, kusenPrice: 1750000,
        closetLabel: 'Kloset duduk bermerek + shower set & wastafel', closetPrice: 4500000,
        paintPrice: 52000, elecPrice: 425000, concMul: 1.15,
      },
    }[tier];

    const toSec = (name, rows) => ({
      id: uid(),
      name,
      collapsed: false,
      items: rows.map(([desc, vol, unit, price]) => ({ id: uid(), desc, vol: String(vol), unit, price: Math.round(price) })),
    });

    if (opts.type === 'tambah') {
      const len = num(opts.roomLen);
      const wid = num(opts.roomWidth);
      if (len <= 0 || wid <= 0) return [];
      const roomArea = r1(len * wid);
      const perim = r1((len + wid) * 2);
      const newWallLen = r1(perim * (num(cf.roomWallRatio) || 0.78));
      const wallArea = r1(newWallLen * (num(cf.roomHeight) || 3.2));
      const roofArea = r1(roomArea * (num(cf.roomRoofRatio) || 1.35));
      const isL2 = opts.roomPos === 'lantai2';
      const kind = opts.roomKind || 'kamar';
      const tierMul = tier === 'premium' ? 1.25 : tier === 'ekonomis' ? 0.88 : 1;

      const secs = [];
      if (opts.roomConnect) {
        secs.push(toSec('Persiapan & Sambungan Bangunan Lama', [
          ['Bongkar sebagian dinding / akses penyambung', r1(Math.max(3, Math.min(len, wid) * 2.5)), 'm²', 45000],
          ['Angkut & buang puing bongkaran', 1, 'rit', 500000],
        ]));
      }

      if (isL2) {
        secs.push(toSec('Struktur & Dak Lantai 2', [
          ['Bongkar sebagian atap lama untuk naik lantai', roomArea, 'm²', 35000],
          ['Plat dak lantai beton bertulang (t=12cm)', r1(roomArea * 0.12), 'm³', 5600000 * T.concMul],
          ['Kolom & ring balok beton bertulang', r1(newWallLen * 0.075), 'm³', 5200000 * T.concMul],
        ]));
      } else {
        secs.push(toSec('Pondasi & Struktur', [
          ['Galian tanah pondasi', r1(newWallLen * 0.45), 'm³', 95000],
          ['Pasangan pondasi batu kali', r1(newWallLen * 0.36), 'm³', 1150000],
          ['Sloof, kolom praktis & ring balok beton', r1(newWallLen * 0.085), 'm³', 5000000 * T.concMul],
        ]));
      }

      secs.push(toSec('Pekerjaan Dinding', [
        [T.wallLabel, wallArea, 'm²', T.wallPrice],
        ['Plesteran dinding (2 sisi)', r1(wallArea * 2), 'm²', 68000],
        ['Acian dinding (2 sisi)', r1(wallArea * 2), 'm²', 38000],
      ]));

      if (opts.roomRoof) {
        secs.push(toSec('Pekerjaan Atap', [
          ['Rangka atap baja ringan', roofArea, 'm²', T.framePrice],
          [T.roofLabel, roofArea, 'm²', T.roofPrice],
          ['Flashing / talang sambungan atap lama', Math.max(len, wid), "m'", 120000],
        ]));
      }

      secs.push(toSec('Lantai & Plafon', [
        ...(!isL2 ? [['Urugan pasir & lantai kerja', roomArea, 'm²', 82000]] : []),
        [T.floorLabel, roomArea, 'm²', T.floorPrice],
        [T.ceilingLabel, roomArea, 'm²', T.ceilingPrice],
      ]));

      if (kind === 'km') {
        secs.push(toSec('Kamar Mandi & Sanitasi', [
          ['Waterproofing lantai & dinding bawah', r1(roomArea + perim * 0.5), 'm²', 155000],
          ['Pasang keramik dinding kamar mandi (t=2m)', r1(perim * 2), 'm²', T.bathWallPrice],
          [T.closetLabel, 1, 'set', T.closetPrice],
          ['Instalasi pipa air bersih & pembuangan', 1, 'ls', 1800000],
          ['Pintu kamar mandi + boven / exhaust fan', 1, 'unit', Math.round(1350000 * tierMul)],
        ]));
      } else {
        const winCount = roomArea >= 14 ? 2 : 1;
        secs.push(toSec('Kusen, Pintu & Jendela', [
          ['Kusen pintu & jendela', 1 + winCount, 'unit', T.kusenPrice],
          ['Daun pintu + engsel & kunci', 1, 'unit', T.doorPrice],
          ['Daun jendela kaca + aksesoris', winCount, 'unit', T.winPrice],
        ]));
      }

      if (kind === 'dapur') {
        const mejaLen = Math.max(2, r1(Math.min(len, wid)));
        secs.push(toSec('Meja Dapur & Sanitasi', [
          ['Meja dapur beton cor + keramik/granit + backsplash', mejaLen, "m'", Math.round(1650000 * tierMul)],
          ['Bak cuci piring (kitchen sink) + keran', 1, 'set', Math.round(1150000 * tierMul)],
          ['Instalasi pipa air bersih & pembuangan dapur', 1, 'ls', 1400000],
        ]));
      }

      const pts = Math.max(2, Math.round(roomArea / 4) + 1);
      secs.push(toSec('Listrik & Pengecatan', [
        ['Titik lampu, saklar & stop kontak', pts, 'titik', T.elecPrice],
        ['Cat dinding (2 sisi)', r1(wallArea * 2), 'm²', T.paintPrice],
        ['Cat plafon', roomArea, 'm²', T.paintPrice],
      ]));
      return applyFormulaCustom(secs);
    }

    if (opts.type === 'pagar') {
      const len = num(opts.fenceLen);
      const h = num(opts.fenceHeight);
      if (len <= 0 || h <= 0) return [];
      const style = opts.fenceStyle || 'kombinasi';
      const hasGate = !!opts.fenceGate;
      const tierMul = tier === 'premium' ? 1.3 : tier === 'ekonomis' ? 0.85 : 1;
      const colDist = Math.max(1.5, num(cf.fenceColDist) || 3);
      const gateW = Math.max(1, num(cf.gateWidth) || 3.5);

      const galianVol = r1(len * 0.25);
      const pondasiVol = r1(len * 0.22);
      const sloofVol = r1(len * 0.025);
      const kolomCount = Math.max(2, Math.ceil(len / colDist) + 1);
      const wallH = style === 'tembok' ? h : style === 'kombinasi' ? Math.min(1, r1(h * 0.45)) : 0.3;
      const ironH = style === 'tembok' ? 0 : r1(Math.max(0.5, h - wallH));
      const wallM2 = r1(len * wallH);
      const ironM2 = r1(len * ironH);

      const secs = [
        toSec('Pondasi & Struktur Pagar', [
          ['Galian tanah pondasi pagar', galianVol, 'm³', 95000],
          ['Pasangan pondasi batu kali', pondasiVol, 'm³', 1150000],
          ['Sloof beton bertulang pagar', sloofVol, 'm³', 4900000 * T.concMul],
          ['Kolom praktis beton pagar', kolomCount, 'titik', Math.round(450000 * T.concMul)],
        ]),
      ];

      const bodyRows = [];
      if (wallM2 > 0) {
        bodyRows.push([T.wallLabel, wallM2, 'm²', T.wallPrice]);
        bodyRows.push(['Plesteran & acian dinding pagar (2 sisi)', r1(wallM2 * 2), 'm²', 105000]);
      }
      if (ironM2 > 0) {
        const ironLabel = tier === 'premium'
          ? 'Pagar besi hollow galvanis tebal + motif / woodplank'
          : tier === 'ekonomis'
            ? 'Pagar besi hollow standar'
            : 'Pagar besi hollow galvanis minimalis';
        bodyRows.push([ironLabel, ironM2, 'm²', Math.round(620000 * tierMul)]);
      }
      secs.push(toSec('Dinding & Rangka Pagar', bodyRows));

      if (hasGate) {
        const gateArea = r1(gateW * Math.min(2.2, h));
        const gateLabel = tier === 'premium'
          ? 'Pintu gerbang dorong/lipat besi hollow + woodplank/laser cut'
          : tier === 'ekonomis'
            ? 'Pintu gerbang besi hollow standar + engsel & gembok'
            : 'Pintu gerbang dorong/lipat besi hollow galvanis + rel & kunci';
        secs.push(toSec('Pintu Gerbang', [
          [gateLabel, gateArea, 'm²', Math.round(850000 * tierMul)],
          ['Pemasangan rel bawah & aksesoris gerbang', 1, 'set', Math.round(950000 * tierMul)],
        ]));
      }

      const finishRows = [];
      if (wallM2 > 0) finishRows.push(['Cat tembok eksterior tahan cuaca (2 sisi)', r1(wallM2 * 2), 'm²', Math.round(T.paintPrice * 1.15)]);
      if (ironM2 > 0 || hasGate) finishRows.push(['Cat dasar anti karat & cat finishing besi', 1, 'ls', Math.round((650000 + len * 45000) * tierMul)]);
      secs.push(toSec('Finishing & Pengecatan', finishRows));
      return applyFormulaCustom(secs);
    }

    if (opts.type === 'kanopi') {
      const len = num(opts.canopyLen);
      const wid = num(opts.canopyWidth);
      if (len <= 0 || wid <= 0) return [];
      const canopyArea = r1(len * wid);
      const frame = opts.canopyFrame || 'hollow';
      const roof = opts.canopyRoof || 'alderon';
      const hasGutter = !!opts.canopyGutter;
      const tierMul = tier === 'premium' ? 1.25 : tier === 'ekonomis' ? 0.88 : 1;
      const postDist = Math.max(1.5, num(cf.canopyPostDist) || 3);
      const pipeLen = Math.max(1, num(cf.canopyPipeLen) || 4);

      const frameMap = {
        bajaringan: { label: 'Rangka & tiang baja ringan kanal C', price: 210000 },
        hollow: { label: 'Rangka & tiang besi hollow galvanis', price: 360000 },
        wf: { label: 'Rangka & tiang besi WF / struktur berat', price: 650000 },
      };
      const roofMap = {
        spandek: { label: 'Penutup atap spandek / spandek pasir', price: 145000 },
        alderon: { label: 'Penutup atap Alderon / UPVC double layer', price: 285000 },
        poly: { label: 'Penutup atap polikarbonat / Solarflat', price: 320000 },
      };

      const fInfo = frameMap[frame];
      const rInfo = roofMap[roof];
      const postCount = Math.max(2, Math.ceil(len / postDist) + 1);

      const secs = [
        toSec('Rangka & Atap Kanopi', [
          [fInfo.label, canopyArea, 'm²', Math.round(fInfo.price * tierMul)],
          [rInfo.label, canopyArea, 'm²', Math.round(rInfo.price * tierMul)],
          ['Umpak / dudukan tiang & baut dynabolt', postCount, 'titik', Math.round(180000 * tierMul)],
        ]),
      ];

      const accRows = [];
      if (hasGutter) {
        accRows.push(['Talang air PVC / galvalum + bracket', len, "m'", Math.round(115000 * tierMul)]);
        accRows.push(['Pipa pembuangan air hujan PVC 3"', pipeLen, "m'", 65000]);
      }
      if (frame !== 'bajaringan') {
        accRows.push(['Cat dasar anti karat & cat finishing rangka besi', canopyArea, 'm²', Math.round(48000 * tierMul)]);
      }
      accRows.push(['Sealant anti bocor & perapian sambungan dinding', len, "m'", 45000]);
      secs.push(toSec('Talang, Finishing & Aksesoris', accRows));
      return applyFormulaCustom(secs);
    }

    if (opts.type === 'renovasi') {
      if (area <= 0) return [];
      const scopes = new Set(opts.scopes || []);
      const secs = [];
      const wallArea = Math.round(area * (num(cf.renovWallRatio) || 1.4));
      const paintArea = Math.round(area * (num(cf.renovPaintRatio) || 2.8));
      const roofArea = Math.round(area * (num(cf.renovRoofRatio) || 1.32));

      if (scopes.has('bongkar')) {
        secs.push(toSec('Pekerjaan Bongkaran & Dinding', [
          ['Bongkar lantai / dinding lama', Math.round(area * 0.6), 'm²', 40000],
          ['Angkut & buang puing bongkaran', Math.max(1, Math.ceil(area / 20)), 'rit', 500000],
          [`${T.wallLabel} (perbaikan / tambahan)`, Math.round(wallArea * 0.4), 'm²', T.wallPrice],
          ['Plesteran & acian dinding', Math.round(wallArea * 0.8), 'm²', 105000],
        ]));
      }
      if (scopes.has('lantai')) {
        secs.push(toSec('Pekerjaan Lantai', [
          ['Perataan lantai kerja / screed', area, 'm²', 65000],
          [T.floorLabel, area, 'm²', T.floorPrice],
        ]));
      }
      if (scopes.has('plafon')) {
        secs.push(toSec('Pekerjaan Plafon', [
          ['Bongkar plafon lama', area, 'm²', 25000],
          [T.ceilingLabel, area, 'm²', T.ceilingPrice],
        ]));
      }
      if (scopes.has('km')) {
        const kmCount = Math.max(1, baths);
        secs.push(toSec('Renovasi Kamar Mandi', [
          ['Waterproofing lantai & dinding bawah', kmCount * 4, 'm²', 155000],
          ['Pasang keramik dinding kamar mandi', kmCount * 12, 'm²', T.bathWallPrice],
          [T.closetLabel, kmCount, 'set', T.closetPrice],
          ['Perbaikan pipa air bersih & pembuangan', kmCount, 'ls', 1200000],
        ]));
      }
      if (scopes.has('atap')) {
        secs.push(toSec('Pekerjaan Atap', [
          ['Bongkar atap lama', roofArea, 'm²', 35000],
          ['Rangka atap baja ringan', roofArea, 'm²', T.framePrice],
          [T.roofLabel, roofArea, 'm²', T.roofPrice],
          ['Lisplang & talang air', Math.round(Math.sqrt(area) * 4), "m'", 105000],
        ]));
      }
      if (scopes.has('listrik')) {
        const pts = Math.max(4, Math.round(area / 5) + beds);
        secs.push(toSec('Instalasi Listrik', [
          ['Tambah / ganti titik lampu & stop kontak', pts, 'titik', T.elecPrice],
          ['Perapian kabel & MCB', 1, 'ls', 1250000],
        ]));
      }
      if (scopes.has('cat')) {
        secs.push(toSec('Pekerjaan Pengecatan Ulang', [
          ['Cat ulang dinding (dalam & luar)', paintArea, 'm²', T.paintPrice],
          ['Cat ulang plafon', area, 'm²', T.paintPrice],
        ]));
      }
      return applyFormulaCustom(secs);
    }

    // Bangun Rumah Baru
    if (area <= 0) return [];
    const footprint = floors === 2 ? Math.round(area * 0.55) : area;
    const perim = Math.round(Math.sqrt(footprint) * 4 * (num(cf.perimRatio) || 1.35));
    const wallArea = Math.round(area * (num(cf.wallRatio) || 2.75) + beds * 10 + baths * 5);
    const roofArea = Math.round(footprint * (num(cf.roofRatio) || 1.38));
    const doors = 2 + beds + baths;
    const windows = Math.max(3, 2 + beds * 2);
    const elecPts = Math.max(8, Math.round(area / 3.2) + beds * 2 + baths);

    const pondasiVol = r1(perim * (floors === 2 ? 0.52 : 0.36));
    const galianVol = r1(perim * (floors === 2 ? 0.65 : 0.45));
    const sloofVol = r1(perim * (floors === 2 ? 0.06 : 0.036));
    const kolomVol = r1((area / 12) * (floors === 2 ? 0.14 : 0.08));
    const balokVol = r1(perim * (floors === 2 ? 0.08 : 0.036));

    const structRows = [
      ['Sloof beton bertulang', sloofVol, 'm³', 4900000 * T.concMul],
      ['Kolom beton bertulang', kolomVol, 'm³', 5300000 * T.concMul],
      ['Ring balok beton bertulang', balokVol, 'm³', 5100000 * T.concMul],
    ];
    if (floors === 2) {
      const upperArea = Math.max(12, area - footprint);
      structRows.unshift(['Pondasi cakar ayam / footplate', Math.max(6, Math.round(footprint / 8)), 'titik', 1650000 * T.concMul]);
      structRows.push(['Plat dak lantai 2 beton bertulang (t=12cm)', r1(upperArea * 0.12), 'm³', 5600000 * T.concMul]);
      structRows.push(['Tangga beton + railing', 1, 'unit', (tier === 'premium' ? 16000000 : tier === 'standar' ? 11500000 : 8500000)]);
    }

    const secs = [
      toSec('Pekerjaan Persiapan', [
        ['Pembersihan & perataan lahan', Math.round(footprint * 1.35), 'm²', 16000],
        ['Pengukuran & pemasangan bouwplank', Math.round(Math.sqrt(footprint) * 4 + 8), "m'", 42000],
        ['Gudang material, air & listrik kerja', 1, 'ls', Math.round(2000000 + area * 20000)],
      ]),
      toSec('Pekerjaan Tanah & Pondasi', [
        ['Galian tanah pondasi', galianVol, 'm³', 95000],
        ['Urugan pasir bawah pondasi', r1(perim * 0.05), 'm³', 320000],
        ['Pasangan batu kali pondasi', pondasiVol, 'm³', 1150000],
        ['Urugan tanah kembali & pemadatan', r1(galianVol * 0.35), 'm³', 65000],
      ]),
      toSec('Pekerjaan Beton & Struktur', structRows),
      toSec('Pekerjaan Dinding', [
        [T.wallLabel, wallArea, 'm²', T.wallPrice],
        ['Plesteran dinding (2 sisi)', wallArea * 2, 'm²', 68000],
        ['Acian dinding (2 sisi)', wallArea * 2, 'm²', 38000],
      ]),
      toSec('Pekerjaan Atap', [
        ['Rangka atap baja ringan', roofArea, 'm²', T.framePrice],
        [T.roofLabel, roofArea, 'm²', T.roofPrice],
        ['Lisplang & talang air', Math.round(Math.sqrt(footprint) * 4 + 6), "m'", 105000],
      ]),
      toSec('Pekerjaan Lantai', [
        ['Urugan pasir & lantai kerja dasar', footprint, 'm²', 82000],
        [T.floorLabel, area, 'm²', T.floorPrice],
        ...(baths > 0 ? [['Pasang keramik dinding kamar mandi', baths * 12, 'm²', T.bathWallPrice]] : []),
      ]),
      toSec('Kusen, Pintu & Jendela', [
        ['Kusen pintu & jendela', doors + windows, 'unit', T.kusenPrice],
        ['Daun pintu + engsel & kunci', doors, 'unit', T.doorPrice],
        ['Daun jendela kaca + aksesoris', windows, 'unit', T.winPrice],
      ]),
      toSec('Pekerjaan Plafon', [
        [T.ceilingLabel, area, 'm²', T.ceilingPrice],
      ]),
      toSec('Instalasi Listrik', [
        ['Titik lampu, saklar & stop kontak', elecPts, 'titik', T.elecPrice],
        ['Panel MCB, grounding & penyambungan PLN', 1, 'ls', floors === 2 ? 4800000 : 3500000],
      ]),
      toSec('Air Bersih & Sanitasi', [
        ['Instalasi pipa air bersih & air kotor', 1, 'ls', Math.round(2500000 + Math.max(1, baths) * 1100000)],
        ...(baths > 0 ? [[T.closetLabel, baths, 'set', T.closetPrice]] : []),
        ['Septic tank & sumur resapan', 1, 'unit', 4500000],
        ['Toren air + pompa & aksesoris', 1, 'set', 2800000],
      ]),
      toSec('Pekerjaan Pengecatan', [
        ['Cat dinding (dalam & luar)', wallArea * 2, 'm²', T.paintPrice],
        ['Cat plafon', area, 'm²', T.paintPrice],
        ['Cat kusen, lisplang & perapian', 1, 'ls', Math.round(1200000 + area * 18000)],
      ]),
    ];
    return applyFormulaCustom(secs);
  }

  function readGenOpts() {
    const f = els.genForm;
    return {
      type: f.elements.type.value,
      area: num(f.elements.area.value),
      floors: Number(f.elements.floors.value) || 1,
      bedrooms: num(f.elements.bedrooms.value),
      bathrooms: num(f.elements.bathrooms.value),
      roomLen: num(f.elements.roomLen.value),
      roomWidth: num(f.elements.roomWidth.value),
      roomPos: f.elements.roomPos.value,
      roomKind: f.elements.roomKind.value,
      roomRoof: f.elements.roomRoof.checked,
      roomConnect: f.elements.roomConnect.checked,
      fenceLen: num(f.elements.fenceLen.value),
      fenceHeight: num(f.elements.fenceHeight.value),
      fenceStyle: f.elements.fenceStyle.value,
      fenceGate: f.elements.fenceGate.checked,
      canopyLen: num(f.elements.canopyLen.value),
      canopyWidth: num(f.elements.canopyWidth.value),
      canopyFrame: f.elements.canopyFrame.value,
      canopyRoof: f.elements.canopyRoof.value,
      canopyGutter: f.elements.canopyGutter.checked,
      tier: f.elements.tier.value,
      scopes: [...f.querySelectorAll('input[name="scope"]:checked')].map((el) => el.value),
      mode: f.elements.mode ? f.elements.mode.value : 'replace',
    };
  }

  const TIER_DESC = {
    bangun: ['Keramik 40×40, baja ringan, cat standar', 'Granit 60×60, aluminium, cat menengah', 'Material pilihan, sanitair & finishing rapi'],
    renovasi: ['Keramik 40×40, baja ringan, cat standar', 'Granit 60×60, aluminium, cat menengah', 'Material pilihan, sanitair & finishing rapi'],
    tambah: ['Keramik 40×40, bata ringan, cat standar', 'Granit 60×60, aluminium, cat menengah', 'Material pilihan & finishing rapi'],
    pagar: ['Besi hollow standar, bata/batako, cat standar', 'Hollow galvanis, bata/hebel, cat eksterior', 'Hollow tebal + motif/woodplank, cat premium'],
    kanopi: ['Rangka & ketebalan standar, hemat biaya', 'Ketebalan & finishing standar awet', 'Besi lebih tebal, finishing rapi & tahan lama'],
  };

  function renderFormulaCoeffs(type) {
    const fields = COEFF_META[type] || COEFF_META.bangun;
    $('#genCoeffGrid').innerHTML = fields.map(([key, label, hint]) => `
      <label class="coeff-field">${esc(label)}
        <input type="text" inputmode="decimal" data-coeff="${key}" data-calc value="${esc(genCoeffs[key])}" autocomplete="off">
        <small>${esc(hint)}</small>
      </label>
    `).join('');
  }

  function updateGenSummary(opts, secs) {
    const total = secs.reduce((a, s) => a + s.items.reduce((b, it) => b + num(it.vol) * num(it.price), 0), 0);
    const itemCount = secs.reduce((a, s) => a + s.items.length, 0);
    els.genTotal.textContent = rp(total);
    $('#btnGenSubmit').disabled = total <= 0;

    if (total <= 0) {
      els.genMeta.textContent = (opts.type === 'renovasi' && opts.area > 0)
        ? 'Pilih minimal 1 bagian renovasi'
        : 'Isi ukuran terlebih dahulu untuk melihat perkiraan';
    } else if (opts.type === 'tambah') {
      const rArea = r1(opts.roomLen * opts.roomWidth);
      els.genMeta.textContent = `${rArea} m² · ${itemCount} item · ± ${rp(total / rArea)}/m²`;
    } else if (opts.type === 'pagar') {
      els.genMeta.textContent = `${secs.length} kelompok · ${itemCount} item · ± ${rp(total / opts.fenceLen)}/m'`;
    } else if (opts.type === 'kanopi') {
      const cArea = r1(opts.canopyLen * opts.canopyWidth);
      els.genMeta.textContent = `${cArea} m² · ${itemCount} item · ± ${rp(total / cArea)}/m²`;
    } else {
      els.genMeta.textContent = `${secs.length} kelompok · ${itemCount} item · ± ${rp(total / opts.area)}/m²`;
    }
  }

  function updateGenUI() {
    const opts = readGenOpts();
    const isHouse = opts.type === 'bangun' || opts.type === 'renovasi';
    $('#genHouseFields').hidden = !isHouse;
    $('#genFloorsField').hidden = opts.type !== 'bangun';
    $('#genScopesField').hidden = opts.type !== 'renovasi';
    $('#genTambahFields').hidden = opts.type !== 'tambah';
    $('#genPagarFields').hidden = opts.type !== 'pagar';
    $('#genKanopiFields').hidden = opts.type !== 'kanopi';

    const desc = TIER_DESC[opts.type] || TIER_DESC.bangun;
    $('#tierDescEco').textContent = desc[0];
    $('#tierDescStd').textContent = desc[1];
    $('#tierDescPre').textContent = desc[2];

    const secs = buildGeneratedSections(opts);
    updateGenSummary(opts, secs);

    if (!$('#genFormulaPane').hidden && lastFormulaType !== opts.type) {
      lastFormulaType = opts.type;
      renderFormulaCoeffs(opts.type);
    }
  }

  $('#btnToggleFormula').addEventListener('click', () => {
    const pane = $('#genFormulaPane');
    const open = pane.hidden;
    pane.hidden = !open;
    els.genDialog.classList.toggle('expanded', open);
    const btn = $('#btnToggleFormula');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '✕ Tutup Rumus' : '⚙️ Lihat & Ubah Rumus';
    if (open) {
      lastFormulaType = '';
      updateGenUI();
    }
  });

  $('#btnResetFormula').addEventListener('click', () => {
    genCoeffs = { ...DEFAULT_COEFFS };
    lastFormulaType = '';
    updateGenUI();
    toast('Parameter rumus dikembalikan ke standar');
  });

  $('#genFormulaPane').addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.dataset.coeff) return;
    genCoeffs[t.dataset.coeff] = num(t.value) || DEFAULT_COEFFS[t.dataset.coeff];
    const opts = readGenOpts();
    updateGenSummary(opts, buildGeneratedSections(opts));
  });

  // ---------- Dropdown searchable untuk Jenis Proyek ----------
  const typeDd = $('#typeDd');
  const typeTrigger = $('#typeTrigger');
  const typeCurrent = $('#typeCurrent');
  const typeMenu = $('#typeMenu');
  const typeSearch = $('#typeSearch');
  const typeList = $('#typeList');
  const genTypeInput = $('#genTypeInput');

  function renderTypeList(query = '') {
    const q = query.trim().toLowerCase();
    const list = q
      ? PROJECT_TYPES.filter((t) => `${t.name} ${t.desc} ${t.keywords || ''}`.toLowerCase().includes(q))
      : PROJECT_TYPES;
    if (!list.length) {
      typeList.innerHTML = '<div class="proj-empty">Jenis proyek tidak ditemukan</div>';
      return;
    }
    const activeId = genTypeInput.value;
    typeList.innerHTML = list.map((t) => {
      const active = t.id === activeId;
      return `<button type="button" class="proj-opt${active ? ' active' : ''}" role="option" aria-selected="${active}" data-tid="${t.id}">
        <span class="proj-opt-main">
          <span class="proj-opt-name">${t.icon} ${esc(t.name)}</span>
          <span class="proj-opt-meta">${esc(t.desc)}</span>
        </span>
        ${active ? '<span class="proj-opt-check" aria-hidden="true">✓</span>' : ''}
      </button>`;
    }).join('');
  }

  function setGenType(id) {
    const found = PROJECT_TYPES.find((t) => t.id === id) || PROJECT_TYPES[0];
    genTypeInput.value = found.id;
    typeCurrent.textContent = `${found.icon} ${found.name}`;
    closeTypeMenu();
    updateGenUI(false);
  }

  function openTypeMenu() {
    typeDd.classList.add('open');
    typeMenu.hidden = false;
    typeTrigger.setAttribute('aria-expanded', 'true');
    typeSearch.value = '';
    renderTypeList('');
    setTimeout(() => typeSearch.focus(), 0);
  }

  function closeTypeMenu() {
    if (typeMenu.hidden) return;
    typeDd.classList.remove('open');
    typeMenu.hidden = true;
    typeTrigger.setAttribute('aria-expanded', 'false');
  }

  typeTrigger.addEventListener('click', () => {
    if (typeMenu.hidden) openTypeMenu();
    else closeTypeMenu();
  });

  typeSearch.addEventListener('input', () => renderTypeList(typeSearch.value));

  typeSearch.addEventListener('keydown', (e) => {
    const opts = [...typeList.querySelectorAll('.proj-opt')];
    if (e.key === 'Escape') { e.stopPropagation(); closeTypeMenu(); typeTrigger.focus(); return; }
    if (!opts.length) return;
    const idx = opts.findIndex((o) => o.classList.contains('focus'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx >= 0) opts[idx].classList.remove('focus');
      const next = e.key === 'ArrowDown' ? (idx + 1) % opts.length : (idx <= 0 ? opts.length - 1 : idx - 1);
      opts[next].classList.add('focus');
      opts[next].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = opts[idx >= 0 ? idx : 0];
      if (target) setGenType(target.dataset.tid);
    }
  });

  typeList.addEventListener('click', (e) => {
    const opt = e.target.closest('.proj-opt');
    if (opt) setGenType(opt.dataset.tid);
  });

  els.genDialog.addEventListener('click', (e) => {
    if (!typeMenu.hidden && !typeDd.contains(e.target)) closeTypeMenu();
  });

  $('#btnGen').addEventListener('click', () => {
    const p = cur();
    els.genForm.reset();
    setGenType('bangun');
    genCoeffs = { ...DEFAULT_COEFFS };
    lastFormulaType = '';
    $('#genFormulaPane').hidden = true;
    els.genDialog.classList.remove('expanded');
    const btn = $('#btnToggleFormula');
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '⚙️ Lihat & Ubah Rumus';
    if (p && num(p.area) > 0) els.genForm.elements.area.value = p.area;
    $('#genModeField').hidden = !(p && p.sections.length > 0);
    els.genDialog.returnValue = '';
    updateGenUI(false);
    els.genDialog.showModal();
  });

  els.genForm.addEventListener('input', (e) => {
    if ($('#genFormulaPane').contains(e.target) || typeDd.contains(e.target)) return;
    updateGenUI(false);
  });
  els.genForm.addEventListener('change', (e) => {
    if ($('#genFormulaPane').contains(e.target) || typeDd.contains(e.target)) return;
    updateGenUI(false);
  });

  els.genDialog.addEventListener('close', () => {
    if (els.genDialog.returnValue !== 'ok') return;
    const opts = readGenOpts();
    const secs = buildGeneratedSections(opts);
    if (!secs.length) { toast('Pilih minimal 1 bagian pekerjaan'); return; }
    const p = cur();
    const prevSections = p.sections.slice();
    const prevArea = p.area;

    if (opts.mode === 'append' && p.sections.length) p.sections.push(...secs);
    else p.sections = secs;
    if (!num(p.area) && (opts.type === 'bangun' || opts.type === 'renovasi')) p.area = String(opts.area);

    renderInfo();
    renderSections();
    renderTotals();
    save();
    toast('Rincian RAB berhasil dibuat', () => {
      p.sections = prevSections;
      p.area = prevArea;
      renderInfo();
      renderSections();
      renderTotals();
      save();
    });
  });

  // ---------- Proyek (searchable dropdown) ----------
  function openProjMenu() {
    els.projDd.classList.add('open');
    els.projMenu.hidden = false;
    els.projTrigger.setAttribute('aria-expanded', 'true');
    els.projSearch.value = '';
    renderProjectList('');
    setTimeout(() => els.projSearch.focus(), 0);
  }

  function closeProjMenu() {
    if (els.projMenu.hidden) return;
    els.projDd.classList.remove('open');
    els.projMenu.hidden = true;
    els.projTrigger.setAttribute('aria-expanded', 'false');
  }

  function selectProject(id) {
    closeProjMenu();
    if (id === db.currentId) return;
    db.currentId = id;
    renderAll();
    save();
    window.scrollTo({ top: 0 });
  }

  els.projTrigger.addEventListener('click', () => {
    if (els.projMenu.hidden) openProjMenu();
    else closeProjMenu();
  });

  els.projSearch.addEventListener('input', () => renderProjectList(els.projSearch.value));

  els.projSearch.addEventListener('keydown', (e) => {
    const opts = [...els.projList.querySelectorAll('.proj-opt')];
    if (e.key === 'Escape') { closeProjMenu(); els.projTrigger.focus(); return; }
    if (!opts.length) return;
    const idx = opts.findIndex((o) => o.classList.contains('focus'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx >= 0) opts[idx].classList.remove('focus');
      const next = e.key === 'ArrowDown' ? (idx + 1) % opts.length : (idx <= 0 ? opts.length - 1 : idx - 1);
      opts[next].classList.add('focus');
      opts[next].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = opts[idx >= 0 ? idx : 0];
      if (target) selectProject(target.dataset.pid);
    }
  });

  els.projList.addEventListener('click', (e) => {
    const opt = e.target.closest('.proj-opt');
    if (opt) selectProject(opt.dataset.pid);
  });

  document.addEventListener('click', (e) => {
    if (!els.projMenu.hidden && !els.projDd.contains(e.target)) closeProjMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.projMenu.hidden) { closeProjMenu(); els.projTrigger.focus(); }
  });

  function openNewDialog() {
    els.form.reset();
    els.dialog.returnValue = '';
    els.dialog.showModal();
  }
  $('#btnNew').addEventListener('click', openNewDialog);

  els.dialog.addEventListener('close', () => {
    const ok = els.dialog.returnValue === 'ok';
    if (!ok && db.projects.length) return;
    const name = ok ? els.form.elements.name.value.trim() : '';
    const p = makeProject(name);
    db.projects.unshift(p);
    db.currentId = p.id;
    renderAll();
    save();
    window.scrollTo({ top: 0 });
  });

  $('#btnDelete').addEventListener('click', () => {
    const p = cur();
    if (!confirm(`Hapus RAB "${p.name || 'tanpa nama'}"? Data yang dihapus tidak bisa dikembalikan.`)) return;
    db.projects = db.projects.filter((x) => x.id !== p.id);
    db.currentId = db.projects[0]?.id ?? null;
    flush();
    if (db.currentId) { renderAll(); toast('RAB dihapus'); } else openNewDialog();
  });

  // ---------- Unduh file ----------
  function download(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('#btnBackup').addEventListener('click', () => {
    const p = cur();
    download(JSON.stringify({ app: 'rab-mudah', version: 1, project: p }, null, 2), `RAB-${slug(p.name)}.json`, 'application/json');
    toast('File cadangan diunduh');
  });

  $('#btnRestore').addEventListener('click', () => els.file.click());
  els.file.addEventListener('change', async () => {
    const file = els.file.files[0];
    els.file.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const raw = data.project || data;
      if (!Array.isArray(raw.sections)) throw new Error('format');
      const p = sanitizeProject(raw);
      db.projects.unshift(p);
      db.currentId = p.id;
      renderAll();
      save();
      toast(`"${p.name}" berhasil dibuka`);
    } catch (_) {
      alert('File tidak bisa dibuka. Pastikan file berasal dari tombol "Simpan cadangan" di aplikasi ini.');
    }
  });

  $('#btnCsv').addEventListener('click', () => {
    const p = cur();
    const c = calc(p);
    const area = num(p.area);
    const logoUrl = new URL('assets/logo-text.png', location.href).href;
    const nFmt = 'mso-number-format:"#,##0";';
    const vFmt = 'mso-number-format:"#,##0.###";';

    let rows = '';
    p.sections.forEach((s, i) => {
      rows += `<tr style="background:#eef4fc;font-weight:bold;color:#032c69"><td align="center">${letter(i)}</td><td colspan="5">${esc(s.name || 'Tanpa nama')}</td></tr>`;
      s.items.forEach((it, j) => {
        const sub = Math.round(num(it.vol) * num(it.price));
        rows += `<tr><td align="center">${j + 1}</td><td>${esc(it.desc)}</td><td align="right" style="${vFmt}">${num(it.vol)}</td><td align="center">${esc(it.unit)}</td><td align="right" style="${nFmt}">${Math.round(num(it.price))}</td><td align="right" style="${nFmt}">${sub}</td></tr>`;
      });
      rows += `<tr style="font-weight:bold;font-style:italic;background:#fafafa"><td></td><td colspan="4">Subtotal ${letter(i)}</td><td align="right" style="${nFmt}">${Math.round(c.secs[i])}</td></tr>`;
    });

    const rRow = (label, val, style = '') => `<tr style="${style}"><td colspan="5">${esc(label)}</td><td align="right" style="${nFmt}">${Math.round(val)}</td></tr>`;
    let recap = p.sections.map((s, i) => rRow(`${letter(i)}. ${s.name || 'Tanpa nama'}`, c.secs[i])).join('');
    recap += rRow('TOTAL PEKERJAAN', c.subtotal, 'font-weight:bold;background:#f5f7fa');
    if (num(p.contingency)) recap += rRow(`Biaya tak terduga (${num(p.contingency)}%)`, c.cont);
    if (num(p.profit)) recap += rRow(`Jasa kontraktor (${num(p.profit)}%)`, c.profit);
    if (num(p.tax)) recap += rRow(`PPN / Pajak (${num(p.tax)}%)`, c.tax);
    recap += rRow('TOTAL ANGGARAN', c.total, 'font-weight:bold');
    recap += rRow('DIBULATKAN', c.rounded, 'font-weight:bold;background:#eef4fc;color:#032c69;font-size:12pt');

    const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1f2937; }
  table { border-collapse: collapse; width: 100%; }
  .tbl th, .tbl td { border: 1px solid #9ca3af; padding: 5px 8px; vertical-align: top; }
  .tbl th { background: #032c69; color: #ffffff; font-weight: bold; text-align: center; }
</style></head>
<body>
  <table style="border-bottom:3px solid #032c69;margin-bottom:10px">
    <tr>
      <td colspan="2" style="padding:8px 0;vertical-align:middle"><img src="${esc(logoUrl)}" height="42" alt="ER•AB"></td>
      <td colspan="4" align="right" style="padding:8px 0;vertical-align:middle">
        <div style="font-size:15pt;font-weight:bold;color:#032c69">RENCANA ANGGARAN BIAYA (RAB)</div>
        <div style="font-size:11pt;font-weight:bold;color:#ff6a00">${esc(p.name || 'Proyek')}</div>
        <div style="font-size:9pt;color:#6b7280">ER•AB — er-ab.jproject.id</div>
      </td>
    </tr>
  </table>
  <table style="margin-bottom:10px">
    <tr><td style="width:120px"><b>Proyek</b></td><td colspan="5">: ${esc(p.name || '-')}</td></tr>
    <tr><td><b>Pemilik</b></td><td colspan="5">: ${esc(p.owner || '-')}</td></tr>
    <tr><td><b>Lokasi</b></td><td colspan="5">: ${esc(p.location || '-')}</td></tr>
    <tr><td><b>Tanggal</b></td><td colspan="5">: ${esc(fmtDate(p.date))}</td></tr>
    ${area > 0 ? `<tr><td><b>Luas bangunan</b></td><td colspan="5">: ${fmtVol(area)} m²</td></tr>` : ''}
  </table>
  <br>
  <table class="tbl">
    <thead><tr><th>No</th><th>Uraian Pekerjaan</th><th>Volume</th><th>Satuan</th><th>Harga Satuan (Rp)</th><th>Jumlah (Rp)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <br>
  <table class="tbl">
    <thead><tr><th colspan="6" align="left">REKAPITULASI</th></tr></thead>
    <tbody>
      ${recap}
      <tr><td colspan="6" style="font-style:italic">Terbilang: <b>${esc(terbilang(c.rounded))}</b></td></tr>
      ${area > 0 && c.total > 0 ? `<tr><td colspan="6">Biaya per m² bangunan: ± ${rp(c.total / area)}</td></tr>` : ''}
    </tbody>
  </table>
  <br>
  <table>
    <tr><td colspan="3" align="center">Dibuat oleh,</td><td colspan="3" align="center">Disetujui oleh,</td></tr>
    <tr><td colspan="6" style="height:48px"></td></tr>
    <tr><td colspan="3" align="center">(.................................)</td><td colspan="3" align="center">${esc(p.owner || '(.................................)')}</td></tr>
  </table>
</body></html>`;

    download('\ufeff' + html, `RAB-${slug(p.name)}.xls`, 'application/vnd.ms-excel;charset=utf-8');
    toast('File Excel (.xls) diunduh');
  });

  // ---------- Cetak / PDF ----------
  function buildPrint() {
    const p = cur();
    if (!p) return;
    const c = calc(p);
    let rows = '';
    p.sections.forEach((s, i) => {
      rows += `<tr class="p-sec"><td class="c">${letter(i)}</td><td colspan="5">${esc(s.name || 'Tanpa nama')}</td></tr>`;
      s.items.forEach((it, j) => {
        rows += `<tr><td class="c">${j + 1}</td><td>${esc(it.desc)}</td><td class="r">${fmtVol(it.vol)}</td><td class="c">${esc(it.unit)}</td><td class="r">${fmt(it.price)}</td><td class="r">${fmt(num(it.vol) * num(it.price))}</td></tr>`;
      });
      rows += `<tr class="p-sub"><td></td><td colspan="4">Subtotal ${letter(i)}</td><td class="r">${fmt(c.secs[i])}</td></tr>`;
    });

    const rr = (label, val, cls = '') => `<tr class="${cls}"><td>${esc(label)}</td><td class="r">${rp(val)}</td></tr>`;
    let recap = p.sections.map((s, i) => rr(`${letter(i)}. ${s.name || 'Tanpa nama'}`, c.secs[i])).join('');
    recap += rr('Total Pekerjaan', c.subtotal, 'p-total');
    if (num(p.contingency)) recap += rr(`Biaya tak terduga (${num(p.contingency)}%)`, c.cont);
    if (num(p.profit)) recap += rr(`Jasa kontraktor (${num(p.profit)}%)`, c.profit);
    if (num(p.tax)) recap += rr(`PPN / Pajak (${num(p.tax)}%)`, c.tax);
    recap += rr('TOTAL ANGGARAN', c.total, 'p-total');
    recap += rr('DIBULATKAN', c.rounded, 'p-grand');

    const area = num(p.area);
    els.print.innerHTML = `
      <header class="p-header">
        <img class="p-logo" src="assets/logo-text.png" alt="ER•AB">
        <div class="p-head-right">
          <h1 class="p-title">RENCANA ANGGARAN BIAYA (RAB)</h1>
          <p class="p-subtitle">${esc(p.name || 'Proyek')}</p>
          <p class="p-domain">er-ab.jproject.id</p>
        </div>
      </header>
      <table class="p-info">
        <tr><td>Pemilik</td><td>: ${esc(p.owner || '-')}</td></tr>
        <tr><td>Lokasi</td><td>: ${esc(p.location || '-')}</td></tr>
        <tr><td>Tanggal</td><td>: ${esc(fmtDate(p.date))}</td></tr>
        ${area > 0 ? `<tr><td>Luas bangunan</td><td>: ${fmtVol(area)} m²</td></tr>` : ''}
      </table>
      <table class="p-table">
        <thead><tr><th style="width:6%">No</th><th>Uraian Pekerjaan</th><th style="width:9%">Volume</th><th style="width:8%">Satuan</th><th style="width:16%">Harga Satuan (Rp)</th><th style="width:17%">Jumlah (Rp)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="p-recap">
        <h3>REKAPITULASI</h3>
        <table class="p-table">${recap}</table>
        <p class="p-words">Terbilang: <b>${esc(terbilang(c.rounded))}</b></p>
        ${area > 0 && c.total > 0 ? `<p>Biaya per m² bangunan: ± ${rp(c.total / area)}</p>` : ''}
      </div>
      <div class="p-sign">
        <div>Dibuat oleh,<div class="line">(.................................)</div></div>
        <div>Disetujui oleh,<div class="line">${esc(p.owner || '(.................................)')}</div></div>
      </div>
      <p class="p-note">Harga satuan sudah termasuk bahan dan upah kecuali disebutkan lain. Dibuat dengan ER•AB (er-ab.jproject.id).</p>`;
  }

  $('#btnPrint').addEventListener('click', () => { buildPrint(); window.print(); });
  window.addEventListener('beforeprint', buildPrint);

  $('#btnGoSummary').addEventListener('click', () => {
    $('#summary').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- Layar penuh Daftar Pekerjaan ----------
  const ICON_FS_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  const ICON_FS_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';

  function setWorkFullscreen(on) {
    const card = $('#workCard');
    const btn = $('#btnFullscreen');
    const fsTotal = $('#fsTotal');
    card.classList.toggle('is-fullscreen', on);
    document.body.classList.toggle('work-fullscreen', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Keluar layar penuh' : 'Mode layar penuh');
    btn.title = on ? 'Keluar layar penuh (Esc)' : 'Mode layar penuh';
    btn.innerHTML = on ? ICON_FS_CLOSE : ICON_FS_OPEN;
    if (fsTotal) fsTotal.hidden = !on;
    if (on) card.scrollTop = 0;
  }

  $('#btnFullscreen').addEventListener('click', () => {
    setWorkFullscreen(!$('#workCard').classList.contains('is-fullscreen'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#workCard').classList.contains('is-fullscreen') && !els.dialog.open && !els.genDialog.open) {
      setWorkFullscreen(false);
    }
  });

  // ---------- Sembunyikan / tampilkan nominal ----------
  const ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const ICON_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';

  function syncHideBtn() {
    const btn = $('#btnHideAmount');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(hideAmount));
    btn.setAttribute('aria-label', hideAmount ? 'Tampilkan nominal' : 'Sembunyikan nominal');
    btn.title = hideAmount ? 'Tampilkan nominal' : 'Sembunyikan nominal';
    btn.innerHTML = hideAmount ? ICON_EYE_OFF : ICON_EYE;
  }

  $('#btnHideAmount').addEventListener('click', () => {
    hideAmount = !hideAmount;
    try { localStorage.setItem(STORE_KEY + ':hide', hideAmount ? '1' : '0'); } catch (_) { /* abaikan */ }
    syncHideBtn();
    renderTotals();
  });

  // ---------- Mulai ----------
  syncHideBtn();
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  if (!cur()) db.currentId = db.projects[0]?.id ?? null;
  if (!db.currentId) {
    const p = makeProject('');
    db.projects.push(p);
    db.currentId = p.id;
    flush();
  }
  renderAll();
})();
