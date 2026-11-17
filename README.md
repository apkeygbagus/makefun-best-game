[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/apkeygbagus/makefun-best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/apkeygbagus/makefun-best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# Neon Void — Arena Survival

Bounty: https://make.fun/bounty/best-game-01
Slug: `best-game-01` · Pool $1.000 USDC (1st $400) ·
**Deadline: 2026-11-18 18:00 UTC = 19 Nov 2026 01:00 WIB**

Entri untuk bounty make.fun **"Make the best game"** (`best-game-01`, pool
$1.000 USDC, juara 1 $400; deadline **18 Nov 2026 18:00 UTC = 19 Nov 2026
01:00 WIB**). Status: **siap submit, belum disubmit** — persiapan lokal saja
(tidak login, tidak daftar, tidak bayar, tidak submit).

**Neon Void** adalah arena survival shooter 2D orisinal: pilot pesawat
terakhir di sektor yang runtuh, hancurkan gelombang void swarm, panen core
mereka, dan pasang upgrade di antara gelombang. Selesaikan **wave 10 untuk
menang** ("SECTOR SAVED", lalu endless mode); hull habis = game over. Skor
diperkuat sistem combo multiplier (sampai ×5).

## Cara main

Buka game lewat server statis mana pun (modul ES tidak jalan dari `file://`
di Chrome — ini juga cara kit menilainya):

```bash
node serve.ts            # -> http://127.0.0.1:8080 (opsi: --port 8123)
# atau server statis lain yang menyajikan folder game/
```

Kontrol:

| Aksi | Input |
| --- | --- |
| Bergerak | WASD / tombol panah |
| Membidik | Mouse |
| Menembak | Tahan klik kiri / Space |
| Pilih upgrade | Klik kartu atau tombol 1 / 2 / 3 |
| Pause | P atau Esc |
| Mute | M |
| Restart | R (di layar game over / win) |

Fitur: 10 wave terstruktur + endless, 3 tipe musuh (drone pengejar, dart
dengan dash, brute tank yang pecah jadi 2 drone), 8 upgrade (rapid fire,
heavy rounds, split cannon, piercing, regen, magnet, dll.), core shards
dengan magnet pickup + heal tiap 15 core, partikel ledakan, screen shake,
floating score text, HUD lengkap (hull, skor, combo, wave, hostiles, cores),
best score persisten, dan semua SFX disintesis WebAudio (tanpa file audio).
Menu awal → gameplay → upgrade antar-wave → pause → win/lose → restart:
loop lengkap. 100% offline: semua aset adalah file lokal di `game/`, nol
request jaringan (diverifikasi dengan grep + browser `requestfailed`).

## Format submit (dari brief resmi + kit `best-game-01-kit`)

Brief publik di halaman bounty dan `RULES.txt` kit konsisten; format persis:

- Repo GitHub publik milik akun sendiri (atau source bundle), dibuat
  **setelah** kompetisi dibuka (≥ 2026-11-15T18:00Z), lisensi OSI.
- `main.ts` di root — program Node 22 (stdlib saja) yang dijalankan grader
  2× di sandbox tanpa jaringan (1 CPU, 1 GB, 120 dtk, `/bot` read-only,
  output ke `/output`): menyalin `game/` + `screenshots/` ke output dan
  menulis `dossier.json` via `buildDossier` dari `vendor/makefun-game.ts`.
  Kedua run harus menghasilkan byte yang sama (terverifikasi lokal).
- `vendor/makefun-game.ts` — salinan kit **tanpa perubahan** (sha256
  `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`).
- `game/` — game statis: `index.html` + semua file yang dimuatnya di bawah
  `game/`; tanpa build step, tanpa request jaringan.
- `screenshots/` — 3–4 screenshot PNG/JPEG render asli game sendiri; file
  pertama menurut nama = cover.
- `LICENSE` OSI (repo ini: MIT + baris SPDX).
- Transkrip sesi AI yang membangun entri (bundle via kit CLI saat submit).
- Form submit: `repo_url`, `commit_sha` (40 char), bundle transkrip,
  `entry_message` + `entry_signature` Ed25519 dari wallet akun (berlaku
  10 menit). Kuota: maks 5 submit/hari, 10 total; submit terakhir = final.
- Entry fee: **gratis** — API requirements `entry_fee: null` (terkonfirmasi
  17 Nov 2026).

Gate validasi (4 baris pertama wajib lolos agar entri dinilai juri):

| Cek | Batas | Entri ini |
| --- | --- | --- |
| `game_files` | ≤993 entri & ≤48 MiB di `game/`, `index.html` ≤1 MiB, tanpa symlink | 8 entri, 45.020 byte, index 582 byte, 0 symlink ✓ |
| `references` | semua referensi lokal/`data:`, nol jaringan | hanya `./style.css`, `./src/*.js` relatif ✓ |
| `screenshots` | 3–4 file, ≤256 KiB, sisi panjang ≤1280, sisi pendek ≥480 px | 4 JPEG 1280×720, 44–66 KiB ✓ |
| `dossier_matches` | `dossier.json` byte-for-byte hasil `buildDossier`, ≤1,5 MiB | 344.291 byte, rebuild identik ✓ |

Penilaian: AI judge pairwise (Bradley-Terry) dari contact-sheet screenshot
+ outline source; kriteria berurutan: (1) game lengkap, (2) fun & kedalaman,
(3) feel & polish, (4) tampilan & orisinalitas, (5) struktur. Screenshot
adalah porsi terbesar yang dilihat juri — karena itu screenshot di repo ini
adalah render asli 4 state berbeda (menu, mid-game wave 4, upgrade, game
over), diambil dengan pola resmi kit: game mendukung `?shot=<kind>&seed=<n>`
(lihat `shots.json`), yang membangun state nyata dengan RNG terseed +
autopilot lalu membekukannya.

## Cara submit nanti (belum dijalankan)

1. Push isi folder ini ke repo GitHub publik baru (dibuat setelah
   2026-11-15T18:00Z) — sertakan `main.ts`, `vendor/`, `game/`,
   `screenshots/`, `LICENSE`, `serve.ts`, `shots.json`, README ini.
   Folder `out/` adalah hasil run lokal; boleh dihapus / gitignore.
2. Unduh kit resmi: `curl -sSL "https://make.fun/c/best-game-01/kit" | tar xz`
3. Dari kit: `node cli/makefun.mjs check` / `grade-local` untuk validasi,
   lalu `node cli/makefun.mjs bundle` untuk transkrip sesi, lalu
   `node cli/makefun.mjs submit --keypair <file>` dengan akun/wallet user
   (langkah ini menunggu akun dari user — di luar persiapan lokal ini).

## Struktur file

```
main.ts                  program penyerahan (Node 22, stdlib)
vendor/makefun-game.ts   library kit, byte-identical (JANGAN diubah)
serve.ts                 server statis lokal untuk main/uji
shots.json               daftar screenshot resmi kit
game/
  index.html             halaman game (canvas 960×540)
  style.css              chrome halaman
  src/config.js          tuning: palet, wave, pool upgrade
  src/audio.js           SFX sintesis WebAudio
  src/input.js           keyboard + mouse polling
  src/game.js            state machine, entitas, wave director, render
  src/main.js            bootstrap + loop + staging screenshot
screenshots/             4 JPEG render asli (menu/play/upgrade/game over)
out/                     hasil run lokal main.ts (dossier + salinan)
```

## Hasil tes lokal (17 Nov 2026, Node v24.22.1)

- **Parse**: semua modul JS lolos parse sebagai ES module; `main.ts`,
  `serve.ts`, `vendor/makefun-game.ts` termuat & jalan di Node.
- **Smoke test logika** (shim DOM di Node): 12/12 PASS — menu, staging
  `?shot=play|upgrade|over`, pilih upgrade → wave berikutnya, pause/resume,
  dan **run autopilot penuh sampai MENANG di wave 10** (skor 88.700,
  255 kill, ~6.908 step) — membuktikan loop menang/kalah & balancing waras.
- **Browser asli** (Chrome headless 157 + server statis): 4 screenshot
  terambil, **nol page error, nol request gagal**; uji interaktif (Enter →
  WASD + mouse + tembak 2,5 dtk) mengubah piksel canvas sebagaimana
  mestinya; tombol pause bekerja.
- **Grader lokal**: `MAKEFUN_OUTPUT_DIR=out node main.ts` sukses; dua run
  berturut-turut **byte-identical** (deterministik); `dossier.json` hasil
  rebuild manual identik byte-for-byte.
- **Inspeksi visual** keempat screenshot dilakukan: menu bersih, frame play
  ramai (3 drone + brute + tembakan + partikel), kartu upgrade terbaca,
  layar game over lengkap dengan statistik.

## Asumsi & catatan

- Copyright LICENSE ditulis generik ("Neon Void contributors") — ganti
  dengan nama/handle akun sebelum submit bila diinginkan; gate hanya
  menuntut teks lisensi OSI + baris SPDX.
- `.makefun/owner.json` hanya wajib bila owner repo GitHub ≠ login GitHub
  akun; tambahkan saat repo dibuat: `{"wallet": "<alamat wallet akun>"}`.
- Screenshot diambil dengan Chrome headless-shell di mesin ini (render
  asli kode game via mode `?shot=`, pola yang sama dengan starter kit);
  bukan editan/komposit.
- Transkrip sesi: bundle harus dibuat dari sesi top-level (parent) dengan
  kit CLI saat submit, mencakup sesi subagent ini.
