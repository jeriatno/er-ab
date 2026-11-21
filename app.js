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
  const num = (v) => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
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
  const cur = () => db.projects.find((p) => p.id === db.currentId);

  const els = {
    select: $('#projectSelect'),
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
  };

  function itemHTML(it) {
    return `<div class="item" data-iid="${it.id}">
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
        <div class="item-head" aria-hidden="true"><span>Uraian pekerjaan</span><span>Volume</span><span>Satuan</span><span>Harga satuan (Rp)</span><span class="r">Jumlah</span><span></span></div>
        <div class="items">${s.items.map(itemHTML).join('')}</div>
        <button type="button" class="btn btn-ghost add-item" data-act="add-item">+ Tambah item</button>
      </div>
    </article>`;
  }

  function renderProjectSelect() {
    els.select.innerHTML = db.projects
      .map((p) => `<option value="${p.id}"${p.id === db.currentId ? ' selected' : ''}>${esc(p.name || 'Tanpa nama')}</option>`)
      .join('');
  }

  function renderInfo() {
    const p = cur();
    document.querySelectorAll('[data-field]').forEach((el) => { el.value = p[el.dataset.field] ?? ''; });
  }

  function renderSections() {
    const p = cur();
    els.sections.innerHTML = p.sections.length
      ? p.sections.map(sectionHTML).join('')
      : '<div class="empty">Belum ada pekerjaan. Klik tombol di bawah untuk menambah.</div>';
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

    els.grand.textContent = rp(c.total);
    els.mobileTotal.textContent = rp(c.total);
    els.rounded.textContent = c.total > 0 ? terbilang(c.rounded) : 'Mulai isi volume dan harga satuan';

    const area = num(p.area);
    if (area > 0 && c.total > 0) {
      els.perM2.hidden = false;
      els.perM2.textContent = `≈ ${rp(c.total / area)} per m² bangunan`;
    } else {
      els.perM2.hidden = true;
    }

    const row = (label, val, cls = '') => `<div class="recap-row ${cls}"><span title="${esc(label)}">${esc(label)}</span><span>${rp(val)}</span></div>`;
    let html = p.sections.map((s, i) => row(`${letter(i)}. ${s.name || 'Tanpa nama'}`, c.secs[i])).join('');
    html += row('Total pekerjaan', c.subtotal, 'strong');
    if (num(p.contingency)) html += row(`Tak terduga (${num(p.contingency)}%)`, c.cont);
    if (num(p.profit)) html += row(`Jasa kontraktor (${num(p.profit)}%)`, c.profit);
    if (num(p.tax)) html += row(`PPN / Pajak (${num(p.tax)}%)`, c.tax);
    if (c.total !== c.subtotal) html += row('Total anggaran', c.total, 'strong');
    els.recap.innerHTML = html;
  }

  function renderAll() {
    renderProjectSelect();
    renderInfo();
    renderSections();
    renderTotals();
  }

  // ---------- Input uang ----------
  function moneyInput(el) {
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
      p[f] = ['contingency', 'profit', 'tax'].includes(f) ? num(t.value) : t.value;
      if (f === 'name') renderProjectSelect();
      renderTotals();
      save();
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
      else if (f === 'vol') { t.value = t.value.replace(/[^\d.,]/g, ''); it.vol = t.value; }
      else it[f] = t.value;
    }
    renderTotals();
    save();
  });

  // Enter di kolom item → pindah ke kolom berikutnya / tambah baris baru
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key !== 'Enter' || !(t instanceof HTMLInputElement) || !t.dataset.ifield) return;
    e.preventDefault();
    const row = t.closest('.item');
    const inputs = [...row.querySelectorAll('input')];
    const idx = inputs.indexOf(t);
    if (idx < inputs.length - 1) { inputs[idx + 1].focus(); return; }
    const next = row.nextElementSibling;
    if (next) next.querySelector('input').focus();
    else row.closest('.sec').querySelector('[data-act="add-item"]').click();
  });

  // ---------- Event: klik ----------
  document.addEventListener('click', (e) => {
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

  // ---------- Proyek ----------
  els.select.addEventListener('change', () => {
    db.currentId = els.select.value;
    renderAll();
    save();
    window.scrollTo({ top: 0 });
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
    const dec = (v) => String(Math.round(v * 1000) / 1000).replace('.', ',');
    const q = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const L = [
      ['RENCANA ANGGARAN BIAYA (RAB)'],
      ['Proyek', p.name],
      ['Pemilik', p.owner],
      ['Lokasi', p.location],
      ['Tanggal', fmtDate(p.date)],
      [],
      ['No', 'Uraian Pekerjaan', 'Volume', 'Satuan', 'Harga Satuan (Rp)', 'Jumlah (Rp)'],
    ];
    p.sections.forEach((s, i) => {
      L.push([letter(i), s.name || 'Tanpa nama']);
      s.items.forEach((it, j) => {
        L.push([j + 1, it.desc, dec(num(it.vol)), it.unit, Math.round(num(it.price)), Math.round(num(it.vol) * num(it.price))]);
      });
      L.push(['', `Subtotal ${letter(i)}`, '', '', '', Math.round(c.secs[i])]);
    });
    L.push([]);
    L.push(['', 'TOTAL PEKERJAAN', '', '', '', Math.round(c.subtotal)]);
    if (num(p.contingency)) L.push(['', `Biaya tak terduga (${num(p.contingency)}%)`, '', '', '', Math.round(c.cont)]);
    if (num(p.profit)) L.push(['', `Jasa kontraktor (${num(p.profit)}%)`, '', '', '', Math.round(c.profit)]);
    if (num(p.tax)) L.push(['', `PPN / Pajak (${num(p.tax)}%)`, '', '', '', Math.round(c.tax)]);
    L.push(['', 'TOTAL ANGGARAN', '', '', '', Math.round(c.total)]);
    L.push(['', 'DIBULATKAN', '', '', '', c.rounded]);
    L.push(['', 'Terbilang: ' + terbilang(c.rounded)]);
    const csv = '\ufeff' + L.map((r) => r.map(q).join(';')).join('\r\n');
    download(csv, `RAB-${slug(p.name)}.csv`, 'text/csv;charset=utf-8');
    toast('File untuk Excel diunduh');
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
      <h1 class="p-title">RENCANA ANGGARAN BIAYA (RAB)</h1>
      <p class="p-subtitle">${esc(p.name)}</p>
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

  // ---------- Mulai ----------
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
