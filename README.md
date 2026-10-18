# Lughati Vokasi

Kamus Digital Arab–Indonesia untuk Siswa SMK · SMK Muhammadiyah Pencongan · Sultan Bagus Permadi

Kosakata Arab per jurusan (RPL, TBKR, Akuntansi, TSM) ditambah kosakata umum, lengkap dengan harakat, transliterasi, contoh kalimat, dan peringatan "Hati-hati, mirip" untuk pasangan kata yang gampang tertukar. Berjalan sepenuhnya di browser, **tanpa server dan tanpa internet** setelah kunjungan pertama.

## Fitur

- Pencarian tanpa harakat: `شجره`, `شجرة`, dan `شَجَرَة` menemukan kata yang sama. Bisa juga lewat arti, transliterasi, atau beberapa kata sekaligus. Jika tidak ada hasil di jurusanmu, pencarian otomatis meluas ke jurusan lain.
- Favorit, riwayat, kata hari ini, dan kata acak per jurusan.
- Bagikan ke Story: kartu PNG 1080×1920 (3 gaya) dibuat di perangkat, lalu dibuka lewat menu bagikan HP atau diunduh.
- Offline dan bisa dipasang di layar utama (PWA). Tombol Back HP menutup sheet, bukan keluar dari situs.
- Tampilan bisa diatur: tema, aksen, font, ukuran, harakat, kepadatan, dan kurangi animasi.
- Aksesibilitas: `<dialog>` bawaan, tautan lewati, `lang`/`dir` pada teks Arab, `aria-pressed`, `prefers-reduced-motion`.

## Jalankan lokal

```bash
npm install
npm run dev         # pengembangan
npm test            # 28 tes: integritas data, pencarian, riwayat Back, alur aplikasi
npm run build       # cek tipe (src + tests) + build produksi + service worker ke dist/
```

Node 22 atau lebih baru (lihat `.nvmrc`).

## Struktur

| Jalur | Isi |
|---|---|
| `public/words.json` | Seluruh kamus (satu berkas, dimuat saat runtime) |
| `src/lib/core.ts` | Penyimpanan tervalidasi, normalisasi Arab, parser data, pencarian |
| `src/lib/nav.ts` | Tombol Back untuk overlay (satu entri riwayat per overlay) |
| `src/lib/share.ts` | Kartu Story dengan Canvas |
| `vite.config.ts` | Build + plugin yang menulis `sw.js` berisi daftar berkas hasil build |
| `tests/` | Vitest (data, logika, jsdom) |

## Data

`public/words.json` memuat satu daftar per jurusan (`RPL`, `TBKR`, `Akuntansi`, `TSM`, `Umum`) dan `Mirip` (pasangan kata mirip).

- Baris kata: `[arab, latin, arti, kategori, contoh_arab, contoh_indonesia]`
- Baris `Mirip`: `[arab1, latin1, arti1, arab2, latin2, arti2, tips, cakupan]`, cakupan `all` atau kunci jurusan huruf kecil (`rpl`, `tbkr`, `akuntansi`, `tsm`).
- **ID favorit = `<jurusan>:<nomor baris>`.** Tambahkan entri baru **hanya di AKHIR** daftar. Menyisipkan, menghapus, atau mengurutkan ulang baris akan menggeser favorit siswa, dan tes `tests/dictionary.test.ts` akan gagal. Setelah rilis yang sengaja menambah baris, perbarui `tests/ids.golden.json` dengan daftar kata terbaru.
- Tes juga memastikan tidak ada baris cacat, tidak ada duplikat, dan setiap pasangan "mirip" benar-benar muncul pada setidaknya satu entri.

## Deploy

Pilih satu target:

- **GitHub Pages:** Settings → Pages → Source: *GitHub Actions*, lalu push ke `main`. Workflow menjalankan tes dan build di setiap push dan pull request, dan hanya job `deploy` yang punya izin menerbitkan.
- **Vercel:** impor repo apa adanya. `vercel.json` memasang CSP ketat (`script-src 'self'`) dan cache `immutable` untuk berkas ber-hash.

Build memakai path relatif (`base: './'`), jadi berfungsi di sub-path maupun domain sendiri. Service worker memakai nama cache dari hash berkas build, sehingga rilis baru otomatis menggantikan yang lama; `words.json` diperbarui di kunjungan berikutnya.

## Privasi

Tidak ada pelacak, akun, atau permintaan ke pihak ketiga. Favorit, riwayat, dan pengaturan hanya tersimpan di `localStorage` perangkat (dengan cadangan di memori bila penyimpanan diblokir).

## Catatan perubahan terbaru
- **Pengaturan > Font teks Indonesia** kini berlaku untuk semua teks Indonesia (menu, tab, tombol, arti kata). Pilihan ditambah: Atkinson Hyperlegible.
- **Atur ulang semua** (tombol di bilah bawah Pengaturan) + **Urungkan**; tombol atur ulang per kelompok nonaktif bila sudah bawaan.
- Preferensi tersimpan divalidasi (`normalizePrefs`), font/angka rusak kembali ke bawaan.
- **Sampul** minimalis, rata tengah: judul Arab لُغَتِي dalam font Riq'ah (Aref Ruqaa, teks asli), judul Latin, nama penyusun, satu tombol.
