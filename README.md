# ER-AB

Web sederhana untuk membuat **Rencana Anggaran Biaya (RAB)** bangun rumah atau renovasi.

- Tanpa framework dan tanpa proses build: cuma `index.html`, `style.css`, `app.js`
- Data tersimpan otomatis di browser (localStorage), tidak perlu login
- Mulai dari lembar kosong tanpa data bawaan
- Cetak / simpan PDF, unduh untuk Excel (CSV), simpan & buka file cadangan

## Jalankan di komputer

Buka `index.html` langsung di browser, atau:

```sh
python3 -m http.server 8080
# buka http://localhost:8080
```

## Deploy ke Vercel

1. Push folder ini ke repository GitHub.
2. Buka https://vercel.com/new lalu pilih repository tersebut (**Import**).
3. Framework Preset: **Other**. Build Command dan Output Directory dibiarkan kosong.
4. Klik **Deploy**. Selesai.
