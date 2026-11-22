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
          id: uid(), desc: str(it.desc), vol: str(it.vol), unit: str(it.unit), price: num(it.price) + num(it.labor),
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
  const itemTotal = (it) => num(it.vol) * num(it.price);
  const isLaborItem = (it) => /\b(upah|tukang|kenek|mandor|ongkos|tenaga kerja)\b/i.test(String(it.desc || '')) || String(it.unit || '').trim().toLowerCase() === 'org/hari';

  function calc(p) {
    let matTotal = 0;
    let laborTotal = 0;
    const secs = p.sections.map((s) => s.items.reduce((a, it) => {
      const t = itemTotal(it);
      if (isLaborItem(it)) laborTotal += t;
      else matTotal += t;
      return a + t;
    }, 0));
    const subtotal = secs.reduce((a, b) => a + b, 0);
    const cont = subtotal * num(p.contingency) / 100;
    const profit = subtotal * num(p.profit) / 100;
    const base = subtotal + cont + profit;
    const tax = base * num(p.tax) / 100;
    const total = base + tax;
    return { secs, matTotal, laborTotal, subtotal, cont, profit, tax, total, rounded: Math.ceil(total / 1000) * 1000 };
  }

  // ---------- Render ----------
  const ICON = {
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    grip: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  };

  function itemHTML(it) {
    return `<div class="item${isLaborItem(it) ? ' is-labor' : ''}" data-iid="${it.id}">
      <button type="button" class="icon-btn drag-handle" data-drag="item" title="Geser untuk atur urutan" aria-label="Geser untuk atur urutan">${ICON.grip}</button>
      <label class="cell c-desc"><span class="cell-label">Uraian pekerjaan</span><input data-ifield="desc" list="masterItemList" value="${esc(it.desc)}" placeholder="mis. Pasang keramik lantai atau pilih dari master" aria-label="Uraian pekerjaan" autocomplete="off"></label>
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
      : '<div class="empty">Belum ada pekerjaan. Klik <b>Generate Otomatis</b> di atas atau tombol di bawah untuk menambah manual.</div>';
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
        if (out) out.textContent = rp(itemTotal(it));
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
    if (c.laborTotal > 0 && c.matTotal > 0) {
      html += row('Subtotal material / bahan', c.matTotal);
      html += row('Subtotal upah tukang', c.laborTotal);
    }
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
      else {
        it[f] = t.value;
        const rowEl = t.closest('.item');
        if (f === 'desc') {
          const m = findMasterByName(t.value);
          if (m) {
            it.unit = m.unit;
            it.price = m.price;
            it.mkey = m.key;
            const unitIn = rowEl.querySelector('[data-ifield="unit"]');
            const priceIn = rowEl.querySelector('[data-ifield="price"]');
            if (unitIn) unitIn.value = m.unit;
            if (priceIn) priceIn.value = m.price ? fmt(m.price) : '';
          }
        }
        rowEl.classList.toggle('is-labor', isLaborItem(it));
      }
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

  // ---------- Master Harga Bahan & Upah ----------
  const MASTER_KEY = STORE_KEY + ':master';
  const MASTER_DEFS = [
    { group: 'Material Utama', key: 'cement', label: 'Semen (50 kg)', unit: 'zak', def: 70000 },
    { group: 'Material Utama', key: 'sand', label: 'Pasir pasang / beton', unit: 'truk', def: 850000 },
    { group: 'Material Utama', key: 'stone', label: 'Batu kali pondasi', unit: 'truk', def: 800000 },
    { group: 'Material Utama', key: 'split', label: 'Batu pecah / batu cor', unit: 'truk', def: 1150000 },
    { group: 'Material Utama', key: 'brick', label: 'Bata ringan / hebel', unit: 'm³', def: 750000 },
    { group: 'Material Utama', key: 'ironMain', label: 'Besi beton utama Ø10/Ø12', unit: 'btg', def: 95000 },
    { group: 'Material Utama', key: 'ironRing', label: 'Besi begel Ø6/Ø8', unit: 'btg', def: 48000 },
    { group: 'Material Utama', key: 'tile', label: 'Granit / keramik lantai', unit: 'dos', def: 165000 },
    { group: 'Material Utama', key: 'steelC', label: 'Baja ringan kanal C75', unit: 'btg', def: 88000 },
    { group: 'Material Utama', key: 'gypsum', label: 'Papan gypsum 9mm', unit: 'lbr', def: 72000 },
    { group: 'Material Utama', key: 'paint', label: 'Cat tembok (pail 25 kg)', unit: 'pail', def: 580000 },
    { group: 'Upah Tukang', key: 'tukang', label: 'Upah tukang / kepala tukang', unit: 'org/hari', def: 175000 },
    { group: 'Upah Tukang', key: 'kenek', label: 'Upah kenek / pembantu', unit: 'org/hari', def: 125000 },
    { group: 'Upah Tukang', key: 'pondasiLabor', label: 'Upah pasang pondasi batu kali', unit: "m'", def: 55000 },
    { group: 'Upah Tukang', key: 'tileLabor', label: 'Upah pasang keramik / granit', unit: 'dos', def: 45000 },
  ];

  function loadMaster() {
    const base = Object.fromEntries(MASTER_DEFS.map((m) => [m.key, m.def]));
    try {
      const saved = JSON.parse(localStorage.getItem(MASTER_KEY));
      if (saved && typeof saved === 'object') {
        MASTER_DEFS.forEach((m) => { if (num(saved[m.key]) > 0) base[m.key] = Math.round(num(saved[m.key])); });
      }
    } catch (_) { /* abaikan */ }
    return base;
  }

  const MASTER_CUSTOM_KEY = STORE_KEY + ':master-custom';

  function loadCustomMaster() {
    try {
      const arr = JSON.parse(localStorage.getItem(MASTER_CUSTOM_KEY));
      if (Array.isArray(arr)) {
        return arr.map((x) => ({
          id: x.id || uid(),
          label: String(x.label || ''),
          unit: String(x.unit || ''),
          price: Math.round(num(x.price)),
        }));
      }
    } catch (_) { /* abaikan */ }
    return [];
  }

  let masterPrices = loadMaster();
  let masterCustom = loadCustomMaster();

  const masterPrice = (key, tierMul = 1) => {
    const def = MASTER_DEFS.find((m) => m.key === key)?.def || 0;
    const curVal = masterPrices[key];
    return curVal !== def ? curVal : Math.round(def * tierMul);
  };

  function allMasterEntries() {
    return [
      ...MASTER_DEFS.map((m) => ({ key: m.key, label: m.label, unit: m.unit, price: masterPrices[m.key] })),
      ...masterCustom.filter((c) => c.label.trim()).map((c) => ({ key: 'custom:' + c.id, label: c.label.trim(), unit: c.unit.trim(), price: c.price })),
    ];
  }

  function findMasterByName(name) {
    const q = String(name || '').trim().toLowerCase();
    if (!q) return null;
    return allMasterEntries().find((m) => m.label.toLowerCase() === q) || null;
  }

  function renderMasterDatalist() {
    const dl = $('#masterItemList');
    if (!dl) return;
    dl.innerHTML = allMasterEntries().map((m) => `<option value="${esc(m.label)}">${esc(m.unit)} · ${rp(m.price)}</option>`).join('');
  }

  function syncActiveProjectFromMaster() {
    const p = cur();
    if (!p) return 0;
    const byKey = new Map(allMasterEntries().map((m) => [m.key, m]));
    const byName = new Map(allMasterEntries().map((m) => [m.label.toLowerCase(), m]));
    let updated = 0;

    // Pencocokan kata kunci bawaan untuk item hasil Generate Otomatis
    const inferKey = (it) => {
      if (it.mkey && byKey.has(it.mkey)) return it.mkey;
      const d = String(it.desc || '').toLowerCase();
      const u = String(it.unit || '').toLowerCase();
      if (d.includes('semen') && u === 'zak') return 'cement';
      if (d.includes('pasir') && u === 'truk') return 'sand';
      if (d.includes('batu kali') && u === 'truk') return 'stone';
      if ((d.includes('batu pecah') || d.includes('batu cor')) && u === 'truk') return 'split';
      if ((d.includes('bata ringan') || d.includes('hebel')) && u === 'm³') return 'brick';
      if (d.includes('besi beton utama') && u === 'btg') return 'ironMain';
      if (d.includes('besi begel') && u === 'btg') return 'ironRing';
      if ((d.includes('granit lantai') || d.includes('keramik lantai')) && u === 'dos') return 'tile';
      if (d.includes('baja ringan kanal') && u === 'btg') return 'steelC';
      if (d.includes('papan gypsum') && u === 'lbr') return 'gypsum';
      if (d.includes('cat tembok') && u === 'pail') return 'paint';
      if (d.includes('upah tukang') && u === 'org/hari') return 'tukang';
      if (d.includes('upah kenek') && u === 'org/hari') return 'kenek';
      if (d.includes('upah') && d.includes('pondasi') && u === "m'") return 'pondasiLabor';
      if (d.includes('upah') && (d.includes('keramik') || d.includes('granit')) && u === 'dos') return 'tileLabor';
      return null;
    };

    p.sections.forEach((s) => {
      s.items.forEach((it) => {
        const match = byName.get(String(it.desc || '').trim().toLowerCase()) || byKey.get(inferKey(it));
        if (match && match.price > 0 && it.price !== match.price) {
          it.price = match.price;
          updated++;
        }
      });
    });

    if (updated > 0) {
      renderSections();
      renderTotals();
      save();
    }
    return updated;
  }

  function saveMaster() {
    try {
      localStorage.setItem(MASTER_KEY, JSON.stringify(masterPrices));
      localStorage.setItem(MASTER_CUSTOM_KEY, JSON.stringify(masterCustom));
    } catch (_) { /* abaikan */ }
    renderMasterDatalist();
  }

  function customMasterRowHTML(c) {
    return `<div class="master-custom-row" data-mcid="${c.id}">
      <input type="text" data-mc="label" value="${esc(c.label)}" placeholder="Nama bahan / upah, mis. Paku 7cm" autocomplete="off">
      <input type="text" data-mc="unit" list="unitList" value="${esc(c.unit)}" placeholder="kg" autocomplete="off">
      <input type="text" data-mc="price" inputmode="numeric" value="${c.price ? fmt(c.price) : ''}" placeholder="Harga (Rp)" autocomplete="off">
      <button type="button" class="icon-btn danger" data-mcdel title="Hapus item master" aria-label="Hapus item master">${ICON.x}</button>
    </div>`;
  }

  function renderMasterModal() {
    const groups = [...new Set(MASTER_DEFS.map((m) => m.group))];
    let html = groups.map((g) => {
      const items = MASTER_DEFS.filter((m) => m.group === g).map((m) => `
        <div class="master-item">
          <div class="master-item-top">
            <label for="mp_${m.key}">${esc(m.label)}</label>
            <span class="master-unit">per ${esc(m.unit)}</span>
          </div>
          <input id="mp_${m.key}" data-mkey="${m.key}" inputmode="numeric" value="${fmt(masterPrices[m.key])}" placeholder="${fmt(m.def)}" autocomplete="off">
        </div>
      `).join('');
      return `<div class="master-group"><div class="master-group-title">${esc(g)}</div><div class="master-list">${items}</div></div>`;
    }).join('');

    html += `<div class="master-group" id="masterCustomGroup"${masterCustom.length ? '' : ' hidden'}>
      <div class="master-group-title">Item Master Tambahan</div>
      <div class="master-group" id="masterCustomList">${masterCustom.map(customMasterRowHTML).join('')}</div>
    </div>`;

    $('#masterGrid').innerHTML = html;
  }

  // ---------- Generator RAB otomatis (berbasis rumus standar + custom) ----------
  const r1 = (n) => Math.round(n * 10) / 10;

  // Daftar jenis proyek dinamis — cukup tambah entri di sini jika ada tipe baru
  const TYPE_ICON = {
    bangun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7"/><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/><path d="M9 21v-6h6v6"/></svg>',
    renovasi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    tambah: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    pagar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6v14M12 4v16M20 6v14M4 10h16M4 16h16"/></svg>',
    kanopi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 10 12 4l10 6H2Z"/><path d="M5 10v10M19 10v10"/></svg>',
  };

  const PROJECT_TYPES = [
    { id: 'bangun', icon: TYPE_ICON.bangun, name: 'Bangun Rumah Baru', desc: 'Lengkap dari persiapan sampai finishing', keywords: 'rumah bangun baru struktur pondasi' },
    { id: 'renovasi', icon: TYPE_ICON.renovasi, name: 'Renovasi Rumah', desc: 'Pilih bagian rumah yang ingin direnovasi', keywords: 'renovasi perbaikan bongkar cat lantai' },
    { id: 'tambah', icon: TYPE_ICON.tambah, name: 'Tambah Ruangan', desc: 'Nambah kamar, dapur, atau ruang baru', keywords: 'tambah ruangan kamar dapur kamar mandi dak' },
    { id: 'pagar', icon: TYPE_ICON.pagar, name: 'Bangun Pagar Rumah', desc: 'Pondasi, dinding/besi, gerbang & cat', keywords: 'pagar tembok besi hollow gerbang' },
    { id: 'kanopi', icon: TYPE_ICON.kanopi, name: 'Pasang Kanopi', desc: 'Rangka, penutup atap, talang & finishing', keywords: 'kanopi carport alderon spandek baja ringan' },
  ];

  const DEFAULT_COEFFS = {
    priceFactor: 100,
    laborShare: 32,
    tukangRate: 175000,
    kenekRate: 125000,
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
  let lastFormulaKey = '';

  const isLaborOnlyDesc = (desc) => /\b(galian|urugan tanah kembali|bongkar|buang puing|pembersihan)\b/i.test(String(desc || ''));

  // Konversi daftar pekerjaan ke rincian belanja material toko (semen zak, pasir truk, batu truk, besi btg, keramik dos, cat pail, dll)
  function buildMaterialBreakdown(opts, tier, pf) {
    const cf = genCoeffs;
    const mode = opts.workMode; // 'pisah' | 'pisah_satuan'
    const withPieceLabor = mode === 'pisah_satuan';
    const round1k = (n) => Math.max(1000, Math.round((n * pf) / 1000) * 1000);
    const toSec = (name, rows) => ({
      id: uid(),
      name,
      collapsed: false,
      items: rows.filter((r) => num(r[1]) > 0).map(([desc, vol, unit, price]) => ({
        id: uid(), desc, vol: String(vol), unit, price: round1k(price),
      })),
    });

    const tierMul = tier === 'premium' ? 1.25 : tier === 'ekonomis' ? 0.85 : 1;
    const cementPrice = masterPrice('cement', tier === 'premium' ? 1.08 : tier === 'ekonomis' ? 0.94 : 1);
    const sandTruckPrice = masterPrice('sand');
    const stoneTruckPrice = masterPrice('stone');
    const splitTruckPrice = masterPrice('split');
    const brickM3Price = masterPrice('brick');
    const ironMainPrice = masterPrice('ironMain', tier === 'premium' ? 1.2 : tier === 'ekonomis' ? 0.86 : 1);
    const ironRingPrice = masterPrice('ironRing', tier === 'premium' ? 1.2 : tier === 'ekonomis' ? 0.88 : 1);
    const tileM2PerDos = tier === 'ekonomis' ? 1 : 1.44;
    const tileDosPrice = masterPrice('tile', tier === 'premium' ? 1.72 : tier === 'ekonomis' ? 0.48 : 1);
    const tileLabel = tier === 'ekonomis' ? 'Keramik lantai 40×40' : tier === 'premium' ? 'Granit lantai premium 60×60' : 'Granit lantai 60×60';
    const steelCPrice = masterPrice('steelC');
    const gypsumPrice = masterPrice('gypsum');
    const paintPailPrice = masterPrice('paint', tier === 'premium' ? 1.64 : tier === 'ekonomis' ? 0.62 : 1);
    const pondasiLaborPrice = masterPrice('pondasiLabor');
    const tileLaborPrice = masterPrice('tileLabor');
    void tierMul;

    const addDailyLabor = (secs, estLaborRp) => {
      if (mode !== 'pisah' || !secs.length) return secs;
      const tukangRate = Math.max(50000, Math.round(num(cf.tukangRate) || 175000));
      const kenekRate = Math.max(40000, Math.round(num(cf.kenekRate) || 125000));
      const days = Math.max(1, Math.round((estLaborRp * pf) / (tukangRate + kenekRate)));
      secs.push({
        id: uid(),
        name: 'Upah Tenaga Kerja (Harian)',
        collapsed: false,
        items: [
          { id: uid(), desc: 'Upah Tukang / Kepala Tukang', vol: String(days), unit: 'org/hari', price: tukangRate },
          { id: uid(), desc: 'Upah Kenek / Pembantu Tukang', vol: String(days), unit: 'org/hari', price: kenekRate },
        ],
      });
      return secs;
    };

    const trucks = (m3) => Math.max(1, Math.ceil(m3 / 4));

    if (opts.type === 'kanopi') {
      const len = num(opts.canopyLen);
      const wid = num(opts.canopyWidth);
      if (len <= 0 || wid <= 0) return [];
      const area = r1(len * wid);
      const frame = opts.canopyFrame || 'hollow';
      const roof = opts.canopyRoof || 'alderon';
      const postCount = Math.max(2, Math.ceil(len / Math.max(1.5, num(cf.canopyPostDist) || 3)) + 1);
      const pipeLen = Math.max(1, num(cf.canopyPipeLen) || 4);
      const frameBtg = Math.max(4, Math.ceil(area * 1.15));
      const framePrice = frame === 'wf' ? 420000 : frame === 'bajaringan' ? 92000 : 145000;
      const frameName = frame === 'wf' ? 'Besi WF / H-Beam rangka & tiang (6m)' : frame === 'bajaringan' ? 'Baja ringan kanal C75 & reng (6m)' : 'Besi hollow galvanis rangka & tiang (6m)';
      const roofPrice = roof === 'poly' ? 215000 : roof === 'spandek' ? 95000 : 190000;
      const roofName = roof === 'poly' ? 'Atap polikarbonat / Solarflat' : roof === 'spandek' ? 'Atap spandek / spandek pasir' : 'Atap Alderon / UPVC double layer';

      const secs = [
        toSec('Material Rangka & Atap Kanopi', [
          [frameName, frameBtg, 'btg', framePrice],
          [roofName, area, 'm²', roofPrice],
          ['Baut roofing, dynabolt, elektroda las & sealant', 1, 'ls', 450000 + area * 15000],
          ...(frame !== 'bajaringan' ? [['Cat anti karat & cat besi + thinner', Math.max(1, Math.ceil(area / 12)), 'kaleng', 95000]] : []),
          ...(opts.canopyGutter ? [
            ['Talang air PVC / galvalum + bracket', len, "m'", 75000],
            ['Pipa PVC 3" pembuangan air hujan', Math.max(1, Math.ceil(pipeLen / 4)), 'btg', 135000],
          ] : []),
          ...(withPieceLabor ? [['Upah pemasangan rangka, atap & finishing kanopi', area, 'm²', frame === 'wf' ? 180000 : 115000]] : []),
        ]),
      ];
      return addDailyLabor(secs, area * (frame === 'wf' ? 180000 : 115000));
    }

    if (opts.type === 'pagar') {
      const len = num(opts.fenceLen);
      const h = num(opts.fenceHeight);
      if (len <= 0 || h <= 0) return [];
      const style = opts.fenceStyle || 'kombinasi';
      const hasGate = !!opts.fenceGate;
      const colDist = Math.max(1.5, num(cf.fenceColDist) || 3);
      const gateW = Math.max(1, num(cf.gateWidth) || 3.5);
      const wallH = style === 'tembok' ? h : style === 'kombinasi' ? Math.min(1, r1(h * 0.45)) : 0.3;
      const ironH = style === 'tembok' ? 0 : r1(Math.max(0.5, h - wallH));
      const wallM2 = r1(len * wallH);
      const ironM2 = r1(len * ironH);
      const pondasiM3 = r1(len * 0.22);
      const betonM3 = r1(len * 0.045 + Math.ceil(len / colDist) * 0.03);

      const totalCement = Math.ceil(pondasiM3 * 3.2 + betonM3 * 6.5 + wallM2 * 0.42);
      const totalSandM3 = pondasiM3 * 0.52 + betonM3 * 0.55 + wallM2 * 0.065;
      const stoneM3 = pondasiM3 * 1.2;
      const splitM3 = betonM3 * 0.82;
      const secs = [
        toSec('Material Pondasi, Beton & Dinding Pagar', [
          ['Batu kali pondasi', trucks(stoneM3), 'truk', stoneTruckPrice],
          ['Batu pecah / batu cor (split)', Math.max(1, Math.ceil(splitM3)), 'm³', 310000],
          ['Pasir pasang & beton', trucks(totalSandM3), 'truk', sandTruckPrice],
          ['Semen (50 kg)', totalCement, 'zak', cementPrice],
          ['Besi beton utama Ø10 (12m)', Math.max(4, Math.ceil(betonM3 * 14)), 'btg', ironMainPrice],
          ['Besi begel / cincin Ø6-Ø8 (12m)', Math.max(3, Math.ceil(betonM3 * 10)), 'btg', ironRingPrice],
          ['Kawat bendrat, papan bekisting & paku', 1, 'ls', 450000 + len * 15000],
          ...(wallM2 > 0 ? [['Bata ringan / hebel (atau bata merah)', Math.max(1, Math.ceil(wallM2 / 10)), 'm³', brickM3Price]] : []),
          ...(withPieceLabor ? [
            ['Upah galian & pasangan pondasi pagar', len, "m'", pondasiLaborPrice],
            ...(wallM2 > 0 ? [['Upah pasangan dinding, plester & aci pagar', wallM2, 'm²', 85000]] : []),
          ] : []),
        ]),
      ];

      if (ironM2 > 0 || hasGate) {
        const gateArea = hasGate ? r1(gateW * Math.min(2.2, h)) : 0;
        const hollowBtg = Math.max(4, Math.ceil((ironM2 + gateArea) * 1.3));
        secs.push(toSec('Material Besi Pagar & Gerbang', [
          ['Besi hollow galvanis pagar & gerbang (6m)', hollowBtg, 'btg', tier === 'premium' ? 165000 : 125000],
          ...(hasGate ? [['Rel besi, roda gerbang, engsel & kunci', 1, 'set', 750000]] : []),
          ['Elektroda las, mata gerinda, cat anti karat & cat besi', 1, 'ls', 450000 + len * 20000],
          ...(withPieceLabor ? [['Upah fabrikasi & pasang besi pagar/gerbang', r1(ironM2 + gateArea), 'm²', 185000]] : []),
        ]));
      }

      if (wallM2 > 0) {
        secs.push(toSec('Material Pengecatan Pagar', [
          ['Cat tembok eksterior (pail 25 kg)', Math.max(1, Math.ceil((wallM2 * 2) / 65)), 'pail', paintPailPrice],
          ['Cat dasar / alkali sealer & kuas roller', 1, 'set', 350000],
          ...(withPieceLabor ? [['Upah pengecatan tembok pagar', r1(wallM2 * 2), 'm²', 16000]] : []),
        ]));
      }

      const estLabor = len * 55000 + wallM2 * 117000 + (ironM2 + (hasGate ? gateW * 2 : 0)) * 185000;
      return addDailyLabor(secs, estLabor);
    }

    if (opts.type === 'renovasi') {
      const area = num(opts.area);
      if (area <= 0) return [];
      const scopes = new Set(opts.scopes || []);
      const baths = Math.max(0, Math.round(num(opts.bathrooms)));
      const beds = Math.max(0, Math.round(num(opts.bedrooms)));
      const wallArea = Math.round(area * (num(cf.renovWallRatio) || 1.4));
      const paintArea = Math.round(area * (num(cf.renovPaintRatio) || 2.8));
      const roofArea = Math.round(area * (num(cf.renovRoofRatio) || 1.32));
      const secs = [];
      let estLabor = 0;

      if (scopes.has('bongkar')) {
        const wRep = Math.round(wallArea * 0.4);
        const cem = Math.max(3, Math.ceil(wRep * 0.42));
        secs.push(toSec('Bongkaran & Material Dinding', [
          ['Bata ringan / hebel perbaikan', Math.max(1, Math.ceil(wRep / 10)), 'm³', 750000],
          ['Semen pasang, plester & aci (50 kg)', cem, 'zak', cementPrice],
          ['Pasir pasang & plester', trucks(wRep * 0.065), 'truk', sandTruckPrice],
          ['Angkut & buang puing bongkaran', Math.max(1, Math.ceil(area / 20)), 'rit', 500000],
          ...(withPieceLabor ? [
            ['Upah bongkar lantai / dinding lama', Math.round(area * 0.6), 'm²', 40000],
            ['Upah pasang bata, plester & aci', wRep, 'm²', 85000],
          ] : []),
        ]));
        estLabor += area * 0.6 * 40000 + wRep * 85000;
      }
      if (scopes.has('lantai')) {
        const dos = Math.max(1, Math.ceil((area / tileM2PerDos) * 1.05));
        secs.push(toSec('Material Lantai', [
          [tileLabel, dos, 'dos', tileDosPrice],
          ['Semen & nat keramik (50 kg)', Math.max(2, Math.ceil(area * 0.25)), 'zak', cementPrice],
          ['Pasir urug / spesi lantai', trucks(area * 0.05), 'truk', sandTruckPrice],
          ...(withPieceLabor ? [['Upah pasang lantai keramik / granit', dos, 'dos', tileLaborPrice]] : []),
        ]));
        estLabor += dos * tileLaborPrice;
      }
      if (scopes.has('plafon')) {
        secs.push(toSec('Material Plafon', [
          ['Papan gypsum 9mm (120×240)', Math.max(2, Math.ceil((area / 2.88) * 1.08)), 'lbr', gypsumPrice],
          ['Besi hollow rangka plafon (4m)', Math.max(4, Math.ceil(area * 0.7)), 'btg', 26000],
          ['Kompon, kasa & sekrup gypsum', Math.max(1, Math.ceil(area / 25)), 'zak', 85000],
          ...(withPieceLabor ? [['Upah bongkar & pasang plafon', area, 'm²', 60000]] : []),
        ]));
        estLabor += area * 60000;
      }
      if (scopes.has('km')) {
        const km = Math.max(1, baths);
        secs.push(toSec('Material Kamar Mandi', [
          ['Waterproofing / pelapis anti bocor (galon)', km * 2, 'kaleng', 185000],
          ['Keramik dinding & lantai kamar mandi', km * 16, 'dos', 95000],
          ['Kloset duduk + shower + keran & floor drain', km, 'set', tier === 'premium' ? 3600000 : 1900000],
          ['Pipa PVC, sambungan & lem pipa', km, 'ls', 750000],
          ...(withPieceLabor ? [['Upah renovasi kamar mandi & sanitasi', km, 'unit', 1650000]] : []),
        ]));
        estLabor += km * 1650000;
      }
      if (scopes.has('atap')) {
        secs.push(toSec('Material Atap', [
          ['Baja ringan kanal C75 (6m)', Math.ceil(roofArea * 0.85), 'btg', 88000],
          ['Reng baja ringan (6m)', Math.ceil(roofArea * 0.75), 'btg', 45000],
          ['Penutup atap genteng metal / spandek', roofArea, 'm²', tier === 'premium' ? 145000 : 88000],
          ['Nok, lisplang & baut roofing', 1, 'ls', 650000 + roofArea * 15000],
          ...(withPieceLabor ? [['Upah bongkar & pasang rangka + atap', roofArea, 'm²', 95000]] : []),
        ]));
        estLabor += roofArea * 95000;
      }
      if (scopes.has('listrik')) {
        const pts = Math.max(4, Math.round(area / 5) + beds);
        secs.push(toSec('Material Listrik', [
          ['Kabel NYM, pipa conduit, saklar, stop kontak & lampu LED', pts, 'titik', 210000],
          ['Box MCB & aksesoris perapian', 1, 'set', 650000],
          ...(withPieceLabor ? [['Upah instalasi titik listrik', pts, 'titik', 110000]] : []),
        ]));
        estLabor += pts * 110000;
      }
      if (scopes.has('cat')) {
        secs.push(toSec('Material Pengecatan', [
          ['Cat tembok dalam & luar (pail 25 kg)', Math.max(1, Math.ceil(paintArea / 70)), 'pail', paintPailPrice],
          ['Cat plafon putih (pail 25 kg)', Math.max(1, Math.ceil(area / 70)), 'pail', 340000],
          ['Plamir, sealer, amplas, kuas & roller', 1, 'ls', 450000],
          ...(withPieceLabor ? [['Upah pengecatan dinding & plafon', paintArea + area, 'm²', 15000]] : []),
        ]));
        estLabor += (paintArea + area) * 15000;
      }
      return addDailyLabor(secs, estLabor);
    }

    // Bangun Rumah Baru & Tambah Ruangan — rincian material toko lengkap!
    const isTambah = opts.type === 'tambah';
    let area = 0;
    let footprint = 0;
    let floors = 1;
    let beds = 0;
    let baths = 0;
    let perim = 0;
    let wallArea = 0;
    let roofArea = 0;
    let pondasiM3 = 0;
    let betonM3 = 0;
    let doors = 1;
    let windows = 1;
    let elecPts = 4;

    if (isTambah) {
      const len = num(opts.roomLen);
      const wid = num(opts.roomWidth);
      if (len <= 0 || wid <= 0) return [];
      area = r1(len * wid);
      footprint = area;
      const isL2 = opts.roomPos === 'lantai2';
      perim = r1((len + wid) * 2);
      const newWallLen = r1(perim * (num(cf.roomWallRatio) || 0.78));
      wallArea = r1(newWallLen * (num(cf.roomHeight) || 3.2));
      roofArea = opts.roomRoof ? r1(area * (num(cf.roomRoofRatio) || 1.35)) : 0;
      pondasiM3 = isL2 ? 0 : r1(newWallLen * 0.36);
      betonM3 = isL2 ? r1(area * 0.12 + newWallLen * 0.075) : r1(newWallLen * 0.085);
      baths = opts.roomKind === 'km' ? 1 : 0;
      doors = 1;
      windows = opts.roomKind === 'km' ? 0 : (area >= 14 ? 2 : 1);
      elecPts = Math.max(2, Math.round(area / 4) + 1);
    } else {
      area = num(opts.area);
      if (area <= 0) return [];
      floors = opts.floors === 2 ? 2 : 1;
      beds = Math.max(0, Math.round(num(opts.bedrooms)));
      baths = Math.max(0, Math.round(num(opts.bathrooms)));
      footprint = floors === 2 ? Math.round(area * 0.55) : area;
      perim = Math.round(Math.sqrt(footprint) * 4 * (num(cf.perimRatio) || 1.35));
      wallArea = Math.round(area * (num(cf.wallRatio) || 2.75) + beds * 10 + baths * 5);
      roofArea = Math.round(footprint * (num(cf.roofRatio) || 1.38));
      pondasiM3 = r1(perim * (floors === 2 ? 0.52 : 0.36));
      const sloof = perim * (floors === 2 ? 0.06 : 0.036);
      const kolom = (area / 12) * (floors === 2 ? 0.14 : 0.08);
      const balok = perim * (floors === 2 ? 0.08 : 0.036);
      const dak = floors === 2 ? Math.max(12, area - footprint) * 0.12 : 0;
      betonM3 = r1(sloof + kolom + balok + dak);
      doors = 2 + beds + baths;
      windows = Math.max(3, 2 + beds * 2);
      elecPts = Math.max(8, Math.round(area / 3.2) + beds * 2 + baths);
    }

    const structCement = Math.ceil(pondasiM3 * 3.2 + betonM3 * 6.5);
    const structSandM3 = pondasiM3 * 0.52 + betonM3 * 0.55;
    const stoneM3 = pondasiM3 * 1.2;
    const splitM3 = betonM3 * 0.82;
    const wallCement = Math.ceil(wallArea * 0.42);
    const wallSandM3 = wallArea * 0.065;
    const floorDos = Math.max(1, Math.ceil((area / tileM2PerDos) * 1.05));
    const floorCement = Math.max(2, Math.ceil(area * 0.25));

    const secs = [
      toSec('Material Pondasi & Struktur Beton', [
        ...(pondasiM3 > 0 ? [['Batu kali pondasi', trucks(stoneM3), 'truk', stoneTruckPrice]] : []),
        ['Batu pecah / batu cor (split)', trucks(splitM3), 'truk', splitTruckPrice],
        ['Pasir beton & pondasi', trucks(structSandM3), 'truk', sandTruckPrice],
        ['Semen pondasi & struktur (50 kg)', structCement, 'zak', cementPrice],
        ['Besi beton utama Ø10 / Ø12 (12m)', Math.max(6, Math.ceil(betonM3 * 14)), 'btg', ironMainPrice],
        ['Besi begel / cincin Ø6 / Ø8 (12m)', Math.max(4, Math.ceil(betonM3 * 10)), 'btg', ironRingPrice],
        ['Kawat bendrat', Math.max(2, Math.ceil(betonM3 * 2)), 'kg', 24000],
        ['Papan bekisting, kaso & paku', 1, 'ls', 750000 + Math.round(betonM3 * 350000)],
        ...(withPieceLabor ? [
          ...(pondasiM3 > 0 ? [['Upah galian & pasangan pondasi batu kali', perim, "m'", pondasiLaborPrice]] : []),
          ['Upah perakitan besi, bekisting & pengecoran struktur', betonM3, 'm³', 1350000],
        ] : []),
      ]),
      toSec('Material Dinding, Plester & Aci', [
        ['Bata ringan / hebel (atau bata merah)', Math.max(1, Math.ceil(wallArea / 10)), 'm³', brickM3Price],
        ['Semen pasang, plester & aci (50 kg)', wallCement, 'zak', cementPrice],
        ['Pasir pasang & plester', trucks(wallSandM3), 'truk', sandTruckPrice],
        ...(withPieceLabor ? [
          ['Upah pasang dinding bata / hebel', wallArea, 'm²', 38000],
          ['Upah plesteran & acian dinding (2 sisi)', r1(wallArea * 2), 'm²', 32000],
        ] : []),
      ]),
    ];

    if (roofArea > 0) {
      secs.push(toSec('Material Atap', [
        ['Baja ringan kanal C75 (6m)', Math.ceil(roofArea * 0.85), 'btg', steelCPrice],
        ['Reng baja ringan (6m)', Math.ceil(roofArea * 0.75), 'btg', 45000],
        ['Penutup atap genteng metal / spandek', roofArea, 'm²', tier === 'premium' ? 145000 : 88000],
        ['Nok, lisplang, talang & baut roofing', 1, 'ls', 650000 + roofArea * 18000],
        ...(withPieceLabor ? [['Upah pemasangan rangka & penutup atap', roofArea, 'm²', 75000]] : []),
      ]));
    }

    secs.push(
      toSec('Material Lantai & Plafon', [
        [tileLabel, floorDos, 'dos', tileDosPrice],
        ['Semen pasang lantai & nat (50 kg)', floorCement, 'zak', cementPrice],
        ['Pasir urug & spesi lantai', trucks(area * 0.05), 'truk', sandTruckPrice],
        ['Papan gypsum plafon 9mm (120×240)', Math.max(2, Math.ceil((area / 2.88) * 1.08)), 'lbr', gypsumPrice],
        ['Besi hollow rangka plafon (4m)', Math.max(4, Math.ceil(area * 0.7)), 'btg', 26000],
        ['Kompon, kasa & sekrup gypsum', Math.max(1, Math.ceil(area / 25)), 'zak', 85000],
        ...(withPieceLabor ? [
          ['Upah pemasangan lantai keramik / granit', floorDos, 'dos', tileLaborPrice],
          ['Upah pemasangan plafon gypsum', area, 'm²', 45000],
        ] : []),
      ]),
      toSec('Kusen, Pintu & Jendela', [
        ['Kusen, daun pintu + engsel & kunci', doors, 'unit', tier === 'premium' ? 2800000 : tier === 'ekonomis' ? 1450000 : 1950000],
        ...(windows > 0 ? [['Kusen & daun jendela kaca + aksesoris', windows, 'unit', tier === 'premium' ? 1650000 : tier === 'ekonomis' ? 900000 : 1200000]] : []),
        ...(withPieceLabor ? [['Upah pemasangan kusen, pintu & jendela', doors + windows, 'unit', 225000]] : []),
      ]),
      toSec('Material Listrik, Air & Sanitasi', [
        ['Kabel NYM, pipa conduit, saklar, stop kontak & lampu LED', elecPts, 'titik', 210000],
        ...(!isTambah ? [['Panel MCB & penyambungan baru PLN', 1, 'ls', floors === 2 ? 4200000 : 3000000]] : []),
        ...(baths > 0 ? [
          ['Keramik dinding kamar mandi & waterproofing', baths * 14, 'dos', 95000],
          ['Kloset duduk + shower + keran & floor drain', baths, 'set', tier === 'premium' ? 3600000 : 1900000],
        ] : []),
        ...(isTambah && opts.roomKind === 'dapur' ? [
          ['Bak cuci piring (kitchen sink), keran & pipa dapur', 1, 'set', 1450000],
        ] : []),
        ...(!isTambah ? [
          ['Pipa PVC air bersih & kotor + fitting', 1, 'ls', 2200000],
          ['Septic tank, sumur resapan, toren & pompa air', 1, 'set', 5800000],
        ] : []),
        ...(withPieceLabor ? [
          ['Upah instalasi titik listrik', elecPts, 'titik', 110000],
          ...(baths > 0 || !isTambah ? [['Upah instalasi pipa air & sanitasi', Math.max(1, baths), 'ls', 1650000]] : []),
        ] : []),
      ]),
      toSec('Material Pengecatan', [
        ['Cat tembok dalam & luar (pail 25 kg)', Math.max(1, Math.ceil((wallArea * 2) / 70)), 'pail', paintPailPrice],
        ['Cat plafon putih (pail 25 kg)', Math.max(1, Math.ceil(area / 70)), 'pail', 340000],
        ['Cat dasar (sealer), plamir, amplas, kuas & roller', 1, 'ls', 450000 + Math.round(area * 12000)],
        ...(withPieceLabor ? [['Upah pengecatan dinding & plafon', r1(wallArea * 2 + area), 'm²', 15000]] : []),
      ]),
    );

    const estLabor = (pondasiM3 > 0 ? perim * 55000 : 0) + betonM3 * 1350000 + wallArea * 102000 + roofArea * 75000 + floorDos * 45000 + area * 45000 + (doors + windows) * 225000 + elecPts * 110000 + (wallArea * 2 + area) * 15000;
    return addDailyLabor(secs, estLabor);
  }

  function applyFormulaCustom(secs, opts) {
    const pf = Math.max(0.1, num(genCoeffs.priceFactor) / 100 || 1);
    const mode = opts?.workMode || 'borongan';

    if (mode === 'pisah' || mode === 'pisah_satuan') {
      return buildMaterialBreakdown(opts, opts?.tier || 'standar', pf);
    }

    if (pf !== 1) {
      secs.forEach((s) => {
        s.items.forEach((it) => { it.price = Math.round(it.price * pf); });
      });
    }

    const laborPct = Math.min(0.8, Math.max(0.1, (num(genCoeffs.laborShare) || 32) / 100));
    const round1k = (n) => Math.max(1000, Math.round(n / 1000) * 1000);

    const toLaborItem = (it) => {
      if (isLaborOnlyDesc(it.desc)) {
        return { id: uid(), desc: 'Upah ' + it.desc, vol: it.vol, unit: it.unit, price: round1k(it.price) };
      }
      const descLow = it.desc.toLowerCase();
      if ((descLow.includes('granit') || descLow.includes('keramik')) && it.unit === 'm²') {
        const m2PerDos = descLow.includes('60×60') || descLow.includes('60x60') ? 1.44 : 1;
        const dosVol = Math.max(1, Math.ceil(num(it.vol) / m2PerDos));
        const dosPrice = round1k(num(it.price) * laborPct * m2PerDos);
        return { id: uid(), desc: 'Upah ' + it.desc, vol: String(dosVol), unit: 'dos', price: dosPrice };
      }
      return { id: uid(), desc: 'Upah ' + it.desc, vol: it.vol, unit: it.unit, price: round1k(it.price * laborPct) };
    };

    if (mode === 'jasa' && secs.length) {
      secs.forEach((s) => {
        s.items = s.items.map(toLaborItem);
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
      return applyFormulaCustom(secs, opts);
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
      return applyFormulaCustom(secs, opts);
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
      return applyFormulaCustom(secs, opts);
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
      return applyFormulaCustom(secs, opts);
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
    return applyFormulaCustom(secs, opts);
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
      workMode: f.elements.workMode ? f.elements.workMode.value : 'borongan',
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

  function renderFormulaCoeffs(type, workMode) {
    const fields = [...(COEFF_META[type] || COEFF_META.bangun)];
    if (workMode === 'pisah' || workMode === 'pisah_satuan' || workMode === 'jasa') {
      fields.push(['laborShare', 'Porsi upah tukang (%)', 'Standar konstruksi umumnya 30% – 35% dari total borongan']);
    }
    if (workMode === 'pisah') {
      fields.push(['tukangRate', 'Upah tukang / hari (Rp)', 'Tarif harian tukang atau kepala tukang']);
      fields.push(['kenekRate', 'Upah kenek / hari (Rp)', 'Tarif harian kenek / pembantu tukang']);
    }
    $('#genCoeffGrid').innerHTML = fields.map(([key, label, hint]) => `
      <label class="coeff-field">${esc(label)}
        <input type="text" inputmode="decimal" data-coeff="${key}" data-calc value="${esc(genCoeffs[key])}" autocomplete="off">
        <small>${esc(hint)}</small>
      </label>
    `).join('');
  }

  function updateGenSummary(opts, secs) {
    const total = secs.reduce((a, s) => a + s.items.reduce((b, it) => b + itemTotal(it), 0), 0);
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

    const formulaKey = `${opts.type}:${opts.workMode}`;
    if (!$('#genFormulaPane').hidden && lastFormulaKey !== formulaKey) {
      lastFormulaKey = formulaKey;
      renderFormulaCoeffs(opts.type, opts.workMode);
    }
  }

  const ICON_SLIDERS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="2" y1="14" x2="6" y2="14"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/></svg>';

  function syncFormulaBtn(open) {
    const btn = $('#btnToggleFormula');
    btn.setAttribute('aria-expanded', String(open));
    btn.innerHTML = open ? (ICON.x + '<span>Tutup Rumus</span>') : (ICON_SLIDERS + '<span>Lihat &amp; Ubah Rumus</span>');
  }

  $('#btnToggleFormula').addEventListener('click', () => {
    const pane = $('#genFormulaPane');
    const open = pane.hidden;
    pane.hidden = !open;
    els.genDialog.classList.toggle('expanded', open);
    syncFormulaBtn(open);
    if (open) {
      lastFormulaKey = '';
      updateGenUI();
    }
  });

  $('#btnResetFormula').addEventListener('click', () => {
    genCoeffs = { ...DEFAULT_COEFFS, tukangRate: masterPrices.tukang, kenekRate: masterPrices.kenek };
    lastFormulaKey = '';
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
    typeCurrent.innerHTML = `${found.icon}<span>${esc(found.name)}</span>`;
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
    genCoeffs = { ...DEFAULT_COEFFS, tukangRate: masterPrices.tukang, kenekRate: masterPrices.kenek };
    lastFormulaKey = '';
    $('#genFormulaPane').hidden = true;
    els.genDialog.classList.remove('expanded');
    syncFormulaBtn(false);
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
        const sub = Math.round(itemTotal(it));
        const bg = isLaborItem(it) ? ' style="background:#fff8f3"' : '';
        rows += `<tr${bg}><td align="center">${j + 1}</td><td>${esc(it.desc)}</td><td align="right" style="${vFmt}">${num(it.vol)}</td><td align="center">${esc(it.unit)}</td><td align="right" style="${nFmt}">${Math.round(num(it.price))}</td><td align="right" style="${nFmt}">${sub}</td></tr>`;
      });
      rows += `<tr style="font-weight:bold;font-style:italic;background:#fafafa"><td></td><td colspan="4">Subtotal ${letter(i)}</td><td align="right" style="${nFmt}">${Math.round(c.secs[i])}</td></tr>`;
    });

    const rRow = (label, val, style = '') => `<tr style="${style}"><td colspan="5">${esc(label)}</td><td align="right" style="${nFmt}">${Math.round(val)}</td></tr>`;
    let recap = p.sections.map((s, i) => rRow(`${letter(i)}. ${s.name || 'Tanpa nama'}`, c.secs[i])).join('');
    if (c.laborTotal > 0 && c.matTotal > 0) {
      recap += rRow('Subtotal Material / Bahan', c.matTotal);
      recap += rRow('Subtotal Upah Tukang', c.laborTotal, 'background:#fff8f3;color:#c2410c');
    }
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
        rows += `<tr${isLaborItem(it) ? ' class="p-labor"' : ''}><td class="c">${j + 1}</td><td>${esc(it.desc)}</td><td class="r">${fmtVol(it.vol)}</td><td class="c">${esc(it.unit)}</td><td class="r">${fmt(it.price)}</td><td class="r">${fmt(itemTotal(it))}</td></tr>`;
      });
      rows += `<tr class="p-sub"><td></td><td colspan="4">Subtotal ${letter(i)}</td><td class="r">${fmt(c.secs[i])}</td></tr>`;
    });

    const rr = (label, val, cls = '') => `<tr class="${cls}"><td>${esc(label)}</td><td class="r">${rp(val)}</td></tr>`;
    let recap = p.sections.map((s, i) => rr(`${letter(i)}. ${s.name || 'Tanpa nama'}`, c.secs[i])).join('');
    if (c.laborTotal > 0 && c.matTotal > 0) {
      recap += rr('Subtotal Material / Bahan', c.matTotal);
      recap += rr('Subtotal Upah Tukang', c.laborTotal, 'p-labor');
    }
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

  // ---------- Welcome Banner & Spotlight Quick Guide Tour ----------
  const ONBOARD_KEY = STORE_KEY + ':onboarded';
  const welcomeDialog = $('#welcomeDialog');
  const tourLayer = $('#tourLayer');
  const tourRing = $('#tourRing');
  const tourTip = $('#tourTip');

  const TOUR_STEPS = [
    {
      sel: '#projDd',
      title: 'Pilih & Cari Proyek',
      desc: 'Simpan banyak RAB sekaligus. Klik di sini untuk berpindah atau mencari proyek, dan klik "+ RAB Baru" di sampingnya untuk membuat proyek baru.',
    },
    {
      sel: '#infoCard',
      title: '1. Isi Info Proyek',
      desc: 'Masukkan nama proyek, pemilik, lokasi, tanggal, dan luas bangunan. Info ini otomatis tampil di kop dokumen PDF & Excel.',
    },
    {
      sel: '#btnGen',
      title: 'Generate RAB Otomatis',
      desc: 'Tidak perlu mulai dari nol! Klik tombol ini untuk membuat rincian pekerjaan otomatis (bangun rumah, renovasi, tambah ruangan, pagar, atau kanopi).',
    },
    {
      sel: '#workCard',
      title: '2. Daftar Pekerjaan Fleksibel',
      desc: 'Isi volume & harga satuan (bisa ketik rumus langsung seperti 4*3 atau 150000+25000), geser urutan dengan ikon ⋮⋮, atau klik ikon layar penuh agar lebih lega.',
    },
    {
      sel: '#summary',
      title: 'Ringkasan, Cetak PDF & Excel',
      desc: 'Total anggaran terhitung otomatis dan bisa disamarkan dengan ikon mata. Jika sudah selesai, langsung klik Cetak / Simpan PDF atau Unduh untuk Excel.',
    },
  ];

  let tourIdx = -1;

  function markOnboarded() {
    try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (_) { /* abaikan */ }
  }

  function positionTour() {
    if (tourIdx < 0) return;
    const step = TOUR_STEPS[tourIdx];
    const target = $(step.sel);
    if (!target) { endTour(); return; }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw <= 680;
    const r = target.getBoundingClientRect();
    const pad = isMobile ? 4 : 6;
    const top = Math.max(4, Math.min(vh - 48, r.top - pad));
    const left = Math.max(4, r.left - pad);
    const width = Math.max(40, Math.min(vw - left - 4, r.width + pad * 2));
    const maxRingH = isMobile ? Math.min(vh * 0.48, vh - top - 4) : (vh - top - 4);
    const height = Math.max(36, Math.min(maxRingH, r.height + pad * 2));

    tourRing.style.top = top + 'px';
    tourRing.style.left = left + 'px';
    tourRing.style.width = width + 'px';
    tourRing.style.height = height + 'px';

    const tipW = tourTip.offsetWidth || Math.min(350, vw - 24);
    const tipH = tourTip.offsetHeight || 180;
    const spaceBelow = vh - (top + height);
    const spaceAbove = top;

    let tipTop;
    if (spaceBelow >= tipH + 16) tipTop = top + height + 12;
    else if (spaceAbove >= tipH + 16) tipTop = top - tipH - 12;
    else tipTop = Math.max(12, vh - tipH - 14);

    const tipLeft = isMobile ? 12 : Math.min(vw - tipW - 12, Math.max(12, left));
    tourTip.style.top = tipTop + 'px';
    tourTip.style.left = tipLeft + 'px';
  }

  function showTourStep(idx) {
    tourIdx = idx;
    const step = TOUR_STEPS[idx];
    const target = $(step.sel);
    if (!target) { endTour(); return; }

    $('#tourStep').textContent = `Langkah ${idx + 1} dari ${TOUR_STEPS.length}`;
    $('#tourTitle').textContent = step.title;
    $('#tourDesc').textContent = step.desc;
    $('#btnTourPrev').hidden = idx === 0;
    $('#btnTourNext').textContent = idx === TOUR_STEPS.length - 1 ? 'Selesai ✓' : 'Lanjut →';

    tourLayer.hidden = false;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    positionTour();
    setTimeout(positionTour, 320);
  }

  function startTour() {
    if (welcomeDialog.open) welcomeDialog.close();
    markOnboarded();
    showTourStep(0);
  }

  function endTour() {
    tourIdx = -1;
    tourLayer.hidden = true;
    markOnboarded();
  }

  $('#btnWelcomeSkip').addEventListener('click', () => {
    markOnboarded();
    welcomeDialog.close();
  });
  $('#btnStartTour').addEventListener('click', startTour);
  welcomeDialog.addEventListener('cancel', markOnboarded);

  $('#btnTourSkip').addEventListener('click', endTour);
  $('#btnTourPrev').addEventListener('click', () => { if (tourIdx > 0) showTourStep(tourIdx - 1); });
  $('#btnTourNext').addEventListener('click', () => {
    if (tourIdx < TOUR_STEPS.length - 1) showTourStep(tourIdx + 1);
    else endTour();
  });

  // ---------- Menu gabungan (Master Harga + Spotlight + Info) ----------
  const moreDd = $('#moreDd');
  const btnMore = $('#btnMore');
  const moreMenu = $('#moreMenu');

  function closeMoreMenu() {
    if (moreMenu.hidden) return;
    moreMenu.hidden = true;
    btnMore.setAttribute('aria-expanded', 'false');
  }

  btnMore.addEventListener('click', () => {
    const open = moreMenu.hidden;
    moreMenu.hidden = !open;
    btnMore.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (e) => {
    if (!moreMenu.hidden && !moreDd.contains(e.target)) closeMoreMenu();
  });

  // ---------- Event Master Harga ----------
  const masterDialog = $('#masterDialog');
  const masterForm = $('#masterForm');

  $('#btnMaster').addEventListener('click', () => {
    closeMoreMenu();
    renderMasterModal();
    masterDialog.returnValue = '';
    masterDialog.showModal();
  });

  $('#btnMenuTour').addEventListener('click', () => {
    closeMoreMenu();
    startTour();
  });

  masterForm.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.dataset.mkey || t.dataset.mc === 'price') moneyInput(t);
  });

  masterForm.addEventListener('click', (e) => {
    const del = e.target.closest('[data-mcdel]');
    if (!del) return;
    const row = del.closest('.master-custom-row');
    if (!row) return;
    masterCustom = masterCustom.filter((c) => c.id !== row.dataset.mcid);
    row.remove();
    if (!$('#masterCustomList').children.length) $('#masterCustomGroup').hidden = true;
  });

  $('#btnAddMaster').addEventListener('click', () => {
    const item = { id: uid(), label: '', unit: '', price: 0 };
    masterCustom.push(item);
    $('#masterCustomGroup').hidden = false;
    $('#masterCustomList').insertAdjacentHTML('beforeend', customMasterRowHTML(item));
    const input = $(`[data-mcid="${item.id}"] [data-mc="label"]`);
    input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    input.focus();
  });

  $('#btnResetMaster').addEventListener('click', () => {
    masterPrices = Object.fromEntries(MASTER_DEFS.map((m) => [m.key, m.def]));
    masterCustom = [];
    saveMaster();
    renderMasterModal();
    syncActiveProjectFromMaster();
    toast('Master harga dikembalikan ke standar');
  });

  masterDialog.addEventListener('close', () => {
    if (masterDialog.returnValue !== 'ok') {
      masterCustom = loadCustomMaster();
      return;
    }
    masterForm.querySelectorAll('[data-mkey]').forEach((el) => {
      const v = evalExpr(el.value, true);
      if (v && v > 0) masterPrices[el.dataset.mkey] = Math.round(v);
    });
    masterCustom = [...masterForm.querySelectorAll('.master-custom-row')].map((row) => ({
      id: row.dataset.mcid,
      label: row.querySelector('[data-mc="label"]').value.trim(),
      unit: row.querySelector('[data-mc="unit"]').value.trim(),
      price: Math.round(evalExpr(row.querySelector('[data-mc="price"]').value, true) || 0),
    })).filter((c) => c.label);
    saveMaster();
    const n = syncActiveProjectFromMaster();
    toast(n > 0 ? `Master harga disimpan · ${n} item RAB diperbarui` : 'Master harga disimpan');
  });

  function openWelcome() {
    closeMoreMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    welcomeDialog.showModal();
  }

  $('#btnReplayTour').addEventListener('click', openWelcome);
  $('#btnHelp').addEventListener('click', openWelcome);

  window.addEventListener('resize', positionTour);
  window.addEventListener('orientationchange', () => setTimeout(positionTour, 150));
  window.addEventListener('scroll', positionTour, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (tourIdx < 0) return;
    if (e.key === 'Escape') endTour();
    else if (e.key === 'ArrowRight') $('#btnTourNext').click();
    else if (e.key === 'ArrowLeft' && tourIdx > 0) showTourStep(tourIdx - 1);
  });

  // ---------- Mulai ----------
  renderMasterDatalist();
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

  let onboarded = false;
  try { onboarded = localStorage.getItem(ONBOARD_KEY) === '1'; } catch (_) { /* abaikan */ }
  if (!onboarded) welcomeDialog.showModal();
})();
