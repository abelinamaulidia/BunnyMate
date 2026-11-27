/* =====================================================
   fuzzy.js : otak BunnyMate (Fuzzy Tsukamoto)
   Tidak ada training data. Semua angka di bawah adalah
   ATURAN yang ditentukan manusia (sesuai proposal).
   ===================================================== */

// Menjaga nilai tetap di rentang 0 sampai 1
function clamp(v){ return Math.max(0, Math.min(1, v)); }

// Kurva NAIK: nilai 0 sampai a, naik lurus, nilai 1 mulai b
// (rumus proposal: (x - a) / (b - a), dibatasi 0..1)
function up(x, a, b){ return clamp((x - a) / (b - a)); }

/*
  U = usia (bulan), B = berat (kg), I = masa istirahat kawin (hari)
  Mengembalikan skor Z* (0-100) untuk SATU kelinci.
*/
function hitungFuzzy(U, B, I){

  // LANGKAH 1: FUZZIFIKASI (angka asli -> derajat keanggotaan 0..1)
  var uIdeal = up(U, 5, 6);   // usia: transisi 5 sampai 6 bulan
  var bIdeal = up(B, 2, 3);   // berat: transisi 2 sampai 3 kg
  var iSiap  = up(I, 20, 30); // istirahat: transisi 20 sampai 30 hari
  var m = {
    uIdeal: uIdeal, uMuda: 1 - uIdeal,
    bIdeal: bIdeal, bKurang: 1 - bIdeal,
    iSiap: iSiap,   iBelum: 1 - iSiap
  };

  // LANGKAH 2: INFERENSI (4 aturan JIKA-MAKA)
  var defs = [
    ["R1", "Layak",       [m.uIdeal, m.bIdeal,  m.iSiap],  "Usia Ideal, Berat Ideal, Istirahat Siap"],
    ["R2", "Tidak Layak", [m.uMuda,  m.bIdeal,  m.iSiap],  "Usia Muda, Berat Ideal, Istirahat Siap"],
    ["R3", "Tidak Layak", [m.uIdeal, m.bKurang, m.iSiap],  "Usia Ideal, Berat Kurang, Istirahat Siap"],
    ["R4", "Tidak Layak", [m.uIdeal, m.bIdeal,  m.iBelum], "Usia Ideal, Berat Ideal, Istirahat Belum Siap"]
  ];

  var pembilang = 0, penyebut = 0;
  var rules = defs.map(function(d){
    var a = Math.min.apply(null, d[2]);                       // alpha = nilai terkecil (operator DAN)
    var z = d[1] === "Layak" ? 50 + 50 * a : 100 - 50 * a;    // Tsukamoto: z dari fungsi monoton
    pembilang += a * z;
    penyebut  += a;
    return { k: d[0], out: d[1], cond: d[3], a: a, z: z };
  });

  // LANGKAH 3: DEFUZZIFIKASI (rata-rata terbobot)
  var Z = penyebut === 0 ? 25 : pembilang / penyebut;

  return { U: U, B: B, I: I, m: m, rules: rules, Z: Z, den: penyebut };
}

// Skor pasangan -> label + berapa hari lagi jadwal kawin
function jadwal(skor){
  if (skor >= 75) return { label: "Sangat Layak",    cls: "ok",   hari: 1 };
  if (skor >= 60) return { label: "Layak Bersyarat", cls: "warn", hari: 3 };
  return                 { label: "Tidak Layak",     cls: "bad",  hari: 7 };
}
