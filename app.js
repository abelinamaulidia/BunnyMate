/* ============================================================
   BunnyMate – aplikasi utama
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Konstanta & akun demo ---------- */
  var KEY = "bunnymate-v1";
  var SESSION = "bunnymate-session";
  var DAY = 86400000;

  /* Akun demo. Ini hanya pembatas tampilan di browser, bukan keamanan server. */
  var USERS = {
    owner: { password: "owner123", role: "Owner" },
    karyawan: { password: "karyawan123", role: "Karyawan" }
  };

  /* ---------- Util tanggal & teks ---------- */
  function iso(d) {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function today() {
    return iso(new Date());
  }

  function addDays(s, n) {
    var d = new Date(s + "T00:00:00");
    d.setDate(d.getDate() + n);
    return iso(d);
  }

  function diffDays(a, b) {
    return Math.round((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / DAY);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmt(n, d) {
    return Number(n).toFixed(d === undefined ? 2 : d).replace(".", ",");
  }

  function tgl(s) {
    var d = new Date(s + "T00:00:00");
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  /* ---------- Data awal & penyimpanan ---------- */
  function seed() {
    var t = today();
    return {
      rabbits: [
        { id: "K-01", nama: "Oreo", jk: "Jantan", lahir: addDays(t, -180), berat: 3, kondisi: "Sehat", lastKawin: addDays(t, -30) },
        { id: "K-02", nama: "Mimi", jk: "Betina", lahir: addDays(t, -165), berat: 2.5, kondisi: "Sehat", lastKawin: addDays(t, -25) },
        { id: "K-03", nama: "Coco", jk: "Betina", lahir: addDays(t, -210), berat: 3, kondisi: "Sehat", lastKawin: addDays(t, -15) }
      ],
      plans: [],
      seq: 3,
      pseq: 0
    };
  }

  var S;
  try {
    S = JSON.parse(localStorage.getItem(KEY));
  } catch (e) {
    S = null;
  }
  if (!S || !S.rabbits) S = seed();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {}
  }

  var role = null;
  var tab = "kelinci";
  var lastResult = null;
  var currentUser = "";

  /* ---------- Jembatan ke fuzzy.js ---------- */
  function umur(r) {
    return diffDays(today(), r.lahir) / 30;
  }

  function istirahat(r) {
    return r.lastKawin ? diffDays(today(), r.lastKawin) : 999;
  }

  function fuzzy(r) {
    return hitungFuzzy(umur(r), Number(r.berat), istirahat(r));
  }

  /* ---------- UI helpers ---------- */
  function toast(t) {
    var e = document.createElement("div");
    e.className = "toast";
    e.textContent = t;
    document.body.appendChild(e);
    setTimeout(function () {
      e.remove();
    }, 2200);
  }

  function $(s) {
    return document.querySelector(s);
  }

  function ask(title, body, onOk) {
    $("#dlgTitle").textContent = title;
    $("#dlgBody").innerHTML = body;
    var dlg = $("#dlg");
    dlg.onclose = function () {
      if (dlg.returnValue === "ok") onOk($("#dlgBody"));
    };
    dlg.returnValue = "";
    dlg.showModal();
  }

  function ownerOnly() {
    return role === "Owner";
  }

  /* ---------- Login & sesi ---------- */
  function cekLogin(r, u, p) {
    var a = USERS[u];
    return !!(a && a.role === r && a.password === p);
  }

  function bacaSession() {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION) || "null");
      if (s && USERS[s.user] && USERS[s.user].role === s.role) return s;
    } catch (e) {}
    return null;
  }

  function tulisSession(s) {
    try {
      sessionStorage.setItem(SESSION, JSON.stringify(s));
    } catch (e) {}
  }

  function hapusSession() {
    try {
      sessionStorage.removeItem(SESSION);
    } catch (e) {}
  }

  function tampilLogin() {
    $("#app").hidden = true;
    $("#login").hidden = false;
    $("#loginError").textContent = "";
  }

  function tampilApp() {
    $("#login").hidden = true;
    $("#app").hidden = false;
    render();
  }

  /* ---------- Views ---------- */
  function viewKelinci() {
    var rows = S.rabbits.map(function (r) {
      var del = ownerOnly()
        ? " <button class='btn bad' data-del-rabbit='" + r.id + "'>Hapus</button>"
        : "";
      return "<tr><td>" + r.id + "</td><td>" + esc(r.nama) + "</td><td>" + r.jk +
        "</td><td>" + fmt(umur(r), 1) + " bln</td><td>" + fmt(r.berat, 1) +
        " kg</td><td>" + (r.lastKawin ? istirahat(r) + " hari" : "belum pernah") +
        "</td><td class='" + (r.kondisi === "Sehat" ? "ok" : "bad") + "'>" + r.kondisi +
        "</td><td><button class='btn alt' data-growth='" + r.id + "'>Catat pertumbuhan</button>" +
        del + "</td></tr>";
    }).join("");

    var clear = ownerOnly() && S.rabbits.length
      ? "<div class='row'><button class='btn bad' id='clearRabbits'>Hapus semua kelinci</button></div>"
      : "";
    var akses = ownerOnly()
      ? ""
      : "<p class='hint'>Hanya Owner yang dapat menghapus data kelinci.</p>";

    return "<div class='card'><h2>Data kelinci</h2>" +
      "<p class='hint'>Usia dihitung dari tanggal lahir (1 bulan = 30 hari), masa istirahat dari tanggal kawin terakhir.</p>" +
      akses +
      "<div class='scroll'><table><thead><tr><th>ID</th><th>Nama</th><th>Kelamin</th><th>Usia</th><th>Berat</th><th>Istirahat</th><th>Kondisi</th><th>Aksi</th></tr></thead><tbody>" +
      rows +
      "</tbody></table></div>" +
      clear +
      "</div>" +
      "<div class='card'><h2>Tambah kelinci</h2><div class='grid' style='margin-top:10px'>" +
      "<label>Nama<input id='nNama' placeholder='mis. Snowy'></label>" +
      "<label>Jenis kelamin<select id='nJk'><option>Jantan</option><option>Betina</option></select></label>" +
      "<label>Tanggal lahir<input id='nLahir' type='date'></label>" +
      "<label>Berat (kg)<input id='nBerat' type='number' step='0.1' min='0.1' value='2.5'></label>" +
      "<label>Kawin terakhir (opsional)<input id='nKawin' type='date'></label></div>" +
      "<div class='row'><button class='btn' id='addRabbit'>Simpan kelinci</button></div></div>";
  }

  function opts(jk) {
    return S.rabbits
      .filter(function (r) {
        return r.jk === jk && r.kondisi === "Sehat";
      })
      .map(function (r) {
        return "<option value='" + r.id + "'>" + r.id + " · " + esc(r.nama) + "</option>";
      })
      .join("");
  }

  function rabbitCard(r, f) {
    var rl = f.rules.map(function (x) {
      return "<tr><td>" + x.k + "</td><td>" + x.cond + "</td><td>" + x.out +
        "</td><td>" + fmt(x.a) + "</td><td>" + fmt(x.z) + "</td></tr>";
    }).join("");
    var m = f.m;

    return "<div class='card'><h3>" + esc(r.nama) + " <span class='mute'>(" + r.jk + ")</span></h3>" +
      "<p class='hint'>U = " + fmt(f.U, 1) + " bln · B = " + fmt(f.B, 1) + " kg · I = " +
      (f.I === 999 ? "belum pernah kawin" : f.I + " hari") + "</p>" +
      "<p><b>Fuzzifikasi</b><br>Usia: Ideal " + fmt(m.uIdeal) + ", Muda " + fmt(m.uMuda) +
      "<br>Berat: Ideal " + fmt(m.bIdeal) + ", Kurang " + fmt(m.bKurang) +
      "<br>Istirahat: Siap " + fmt(m.iSiap) + ", Belum " + fmt(m.iBelum) + "</p>" +
      "<div class='scroll'><table><thead><tr><th>Aturan</th><th>Kondisi</th><th>Output</th><th>α</th><th>z</th></tr></thead><tbody>" +
      rl +
      "</tbody></table></div>" +
      "<p><b>Z* = " + fmt(f.Z) + "</b> <span class='hint'>(Σα·z / Σα" +
      (f.den === 0 ? ", Σα = 0 sehingga Z* = 25" : "") +
      ")</span></p></div>";
  }

  function viewPrediksi() {
    var j = opts("Jantan");
    var b = opts("Betina");
    var out = "";

    if (lastResult) {
      var J = S.rabbits.find(function (r) {
        return r.id === lastResult.j;
      });
      var B = S.rabbits.find(function (r) {
        return r.id === lastResult.b;
      });

      if (J && B) {
        var fj = fuzzy(J);
        var fb = fuzzy(B);
        var skor = (fj.Z + fb.Z) / 2;
        var jd = jadwal(skor);
        var tg = addDays(today(), jd.hari);

        lastResult.skor = skor;
        lastResult.tgl = tg;
        lastResult.label = jd.label;

        out = "<div class='card'><div class='score " + jd.cls + "'>" + fmt(skor) + "</div>" +
          "<p><span class='pill " + jd.cls + "'>" + jd.label +
          "</span> Skor pasangan = (Z jantan + Z betina) / 2 = (" + fmt(fj.Z) + " + " + fmt(fb.Z) + ") / 2</p>" +
          "<p>Rekomendasi jadwal kawin: <b>" + tgl(tg) + "</b> (H+" + jd.hari + ")</p>" +
          "<div class='row'><button class='btn' id='ajukan'>Ajukan rencana kawin</button></div></div><div class='two'>" +
          rabbitCard(J, fj) + rabbitCard(B, fb) + "</div>";
      }
    }

    return "<div class='card'><h2>Prediksi kecocokan</h2><p class='hint'>Hanya kelinci berkondisi sehat yang bisa dipilih.</p><div class='grid' style='margin-top:10px'>" +
      "<label>Jantan<select id='pj'>" + j + "</select></label><label>Betina<select id='pb'>" + b + "</select></label></div>" +
      "<div class='row'><button class='btn' id='hitung'" + (j && b ? "" : " disabled") + ">Hitung kelayakan</button></div>" +
      (j && b ? "" : "<p class='hint bad'>Belum ada pasangan jantan dan betina yang sehat.</p>") +
      "</div>" + out;
  }

  function statusCls(s) {
    return {
      "Menunggu": "warn",
      "Disetujui": "ok",
      "Selesai": "ok",
      "Dibatalkan": "bad",
      "Dijadwalkan ulang": "warn"
    }[s] || "mute";
  }

  function viewRencana() {
    var head = "<div class='card'><h2>Rencana kawin</h2>" +
      (ownerOnly() && S.plans.length
        ? "<div class='row'><button class='btn bad' id='clearPlans'>Hapus semua rencana</button></div>"
        : "") +
      (ownerOnly()
        ? ""
        : "<p class='hint'>Hanya Owner yang dapat menghapus rencana kawin.</p>") +
      "</div>";

    if (!S.plans.length) {
      return head + "<div class='card'><p>Belum ada rencana. Hitung kelayakan di tab Prediksi, lalu ajukan rencana kawin.</p></div>";
    }

    var name = function (id) {
      var r = S.rabbits.find(function (x) {
        return x.id === id;
      });
      return r ? esc(r.nama) : id;
    };

    return head + S.plans.slice().reverse().map(function (p) {
      var acts = "";
      if (ownerOnly()) {
        if (p.status === "Menunggu" || p.status === "Dijadwalkan ulang") {
          acts += "<button class='btn' data-act='ok' data-id='" + p.id + "'>Setujui</button> ";
        }
        if (p.status === "Menunggu" || p.status === "Dijadwalkan ulang" || p.status === "Disetujui") {
          acts += "<button class='btn alt' data-act='re' data-id='" + p.id + "'>Jadwal ulang</button> " +
            "<button class='btn bad' data-act='no' data-id='" + p.id + "'>Batalkan</button> ";
        }
        if (p.status === "Disetujui") {
          acts += "<button class='btn' data-act='done' data-id='" + p.id + "'>Tandai sudah kawin</button>";
        }
        acts += "<button class='btn bad' data-del-plan='" + p.id + "'>Hapus</button>";
      }

      return "<div class='card'><h3>" + name(p.j) + " × " + name(p.b) +
        " <span class='pill " + statusCls(p.status) + "'>" + p.status + "</span></h3>" +
        "<p>Skor " + fmt(p.skor) + " (" + p.label + ") · Rencana kawin: <b>" + tgl(p.tgl) + "</b></p>" +
        (p.ket ? "<p class='mute'>Keterangan: " + esc(p.ket) + "</p>" : "") +
        (acts ? "<div class='row'>" + acts + "</div>" : "") + "</div>";
    }).join("");
  }

  function render() {
    var v = $("#view");
    v.innerHTML = tab === "kelinci" ? viewKelinci() : tab === "prediksi" ? viewPrediksi() : viewRencana();
    document.querySelectorAll("nav button").forEach(function (b) {
      b.setAttribute("aria-selected", b.dataset.tab === tab);
    });
    $("#userLabel").textContent = role + " · " + currentUser;
    if (lastResult && tab === "prediksi") {
      var a = $("#pj");
      var c = $("#pb");
      if (a) a.value = lastResult.j;
      if (c) c.value = lastResult.b;
    }
  }

  /* ---------- Events ---------- */
  document.querySelector("nav").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) {
      tab = b.dataset.tab;
      render();
    }
  });

  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var r = $("#loginRole").value;
    var u = $("#loginUser").value.trim().toLowerCase();
    var p = $("#loginPass").value;

    if (!cekLogin(r, u, p)) {
      $("#loginError").textContent = "Peran, username, atau password salah.";
      return;
    }

    role = r;
    currentUser = u;
    tulisSession({ role: r, user: u });
    $("#loginPass").value = "";
    tampilApp();
  });

  $("#logout").addEventListener("click", function () {
    hapusSession();
    role = null;
    currentUser = "";
    lastResult = null;
    tab = "kelinci";
    $("#loginUser").value = "";
    $("#loginPass").value = "";
    tampilLogin();
  });

  $("#view").addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;

    if (t.id === "addRabbit") {
      var nama = $("#nNama").value.trim();
      var lahir = $("#nLahir").value;
      var berat = parseFloat($("#nBerat").value);

      if (!nama || !lahir || !(berat > 0)) {
        toast("Isi nama, tanggal lahir, dan berat dulu ya");
        return;
      }

      S.seq++;
      S.rabbits.push({
        id: "K-" + String(S.seq).padStart(2, "0"),
        nama: nama,
        jk: $("#nJk").value,
        lahir: lahir,
        berat: berat,
        kondisi: "Sehat",
        lastKawin: $("#nKawin").value || ""
      });
      save();
      toast("Kelinci tersimpan");
      render();
      return;
    }

    if (t.id === "clearRabbits") {
      if (!ownerOnly()) return;
      ask(
        "Hapus semua kelinci",
        "<p>Yakin hapus <b>seluruh data kelinci</b> dan semua rencana kawin? Data kelinci akan kosong.</p><p class='hint'>Tambah kelinci baru untuk bisa menghitung lagi.</p>",
        function () {
          S.rabbits = [];
          S.plans = [];
          S.seq = 0;
          S.pseq = 0;
          lastResult = null;
          save();
          toast("Semua kelinci dan rencana dihapus");
          render();
        }
      );
      return;
    }

    if (t.dataset.delRabbit) {
      if (!ownerOnly()) return;
      var id = t.dataset.delRabbit;
      var r = S.rabbits.find(function (x) {
        return x.id === id;
      });
      if (!r) return;
      var linked = S.plans.filter(function (p) {
        return p.j === id || p.b === id;
      }).length;

      ask(
        "Hapus kelinci",
        "<p>Yakin hapus <b>" + esc(r.nama) + "</b> (" + id + ")?" +
          (linked ? "<br>Rencana kawin terkait (" + linked + ") juga akan ikut dihapus." : "") + "</p>",
        function () {
          S.rabbits = S.rabbits.filter(function (x) {
            return x.id !== id;
          });
          if (linked) {
            S.plans = S.plans.filter(function (p) {
              return p.j !== id && p.b !== id;
            });
          }
          if (lastResult && (lastResult.j === id || lastResult.b === id)) lastResult = null;
          save();
          toast("Kelinci dihapus" + (linked ? " beserta rencana terkait" : ""));
          render();
        }
      );
      return;
    }

    if (t.id === "clearPlans") {
      if (!ownerOnly()) return;
      ask(
        "Hapus semua rencana",
        "<p>Yakin hapus <b>seluruh rencana kawin</b>? Data kelinci tidak berubah.</p>",
        function () {
          S.plans = [];
          S.pseq = 0;
          save();
          toast("Semua rencana dihapus");
          render();
        }
      );
      return;
    }

    if (t.dataset.delPlan) {
      if (!ownerOnly()) return;
      var pid = t.dataset.delPlan;
      ask(
        "Hapus rencana",
        "<p>Yakin hapus rencana <b>" + pid + "</b>?</p>",
        function () {
          S.plans = S.plans.filter(function (p) {
            return p.id !== pid;
          });
          save();
          toast("Rencana dihapus");
          render();
        }
      );
      return;
    }

    if (t.dataset.growth) {
      var r = S.rabbits.find(function (x) {
        return x.id === t.dataset.growth;
      });
      ask(
        "Pertumbuhan " + r.nama,
        "<label>Berat badan (kg)<input id='gB' type='number' step='0.1' min='0.1' value='" + r.berat + "'></label>" +
          "<label style='margin-top:8px'>Kondisi kesehatan<select id='gK'>" +
          "<option" + (r.kondisi === "Sehat" ? " selected" : "") + ">Sehat</option>" +
          "<option" + (r.kondisi === "Sakit" ? " selected" : "") + ">Sakit</option>" +
          "</select></label>",
        function (b) {
          var w = parseFloat(b.querySelector("#gB").value);
          if (!(w > 0)) {
            toast("Berat tidak valid");
            return;
          }
          r.berat = w;
          r.kondisi = b.querySelector("#gK").value;
          save();
          toast("Pertumbuhan dicatat");
          render();
        }
      );
      return;
    }

    if (t.id === "hitung") {
      lastResult = { j: $("#pj").value, b: $("#pb").value };
      render();
      return;
    }

    if (t.id === "ajukan") {
      S.pseq++;
      S.plans.push({
        id: "P-" + S.pseq,
        j: lastResult.j,
        b: lastResult.b,
        skor: lastResult.skor,
        label: lastResult.label,
        tgl: lastResult.tgl,
        status: "Menunggu",
        ket: ""
      });
      save();
      toast("Rencana diajukan, menunggu Owner");
      tab = "rencana";
      render();
      return;
    }

    if (t.dataset.act) {
      var p = S.plans.find(function (x) {
        return x.id === t.dataset.id;
      });
      var a = t.dataset.act;

      if (a === "ok") {
        p.status = "Disetujui";
        save();
        toast("Rencana disetujui");
        render();
      } else if (a === "done") {
        [p.j, p.b].forEach(function (id) {
          var r = S.rabbits.find(function (x) {
            return x.id === id;
          });
          if (r) r.lastKawin = today();
        });
        p.status = "Selesai";
        save();
        toast("Perkawinan tercatat");
        render();
      } else if (a === "no") {
        ask(
          "Batalkan rencana",
          "<label>Keterangan<textarea id='kt' rows='3' placeholder='mis. Betina sakit diare saat hari H'></textarea></label>",
          function (b) {
            var k = b.querySelector("#kt").value.trim();
            if (!k) {
              toast("Keterangan wajib diisi");
              return;
            }
            p.status = "Dibatalkan";
            p.ket = k;
            save();
            toast("Rencana dibatalkan");
            render();
          }
        );
      } else if (a === "re") {
        ask(
          "Jadwalkan ulang",
          "<label>Tanggal baru<input id='tb' type='date' value='" + addDays(p.tgl, 3) + "'></label>" +
            "<label style='margin-top:8px'>Keterangan<input id='kt' placeholder='Alasan perubahan jadwal'></label>",
          function (b) {
            var d = b.querySelector("#tb").value;
            if (!d) {
              toast("Pilih tanggal baru");
              return;
            }
            p.tgl = d;
            p.status = "Dijadwalkan ulang";
            p.ket = b.querySelector("#kt").value.trim();
            save();
            toast("Jadwal diperbarui");
            render();
          }
        );
      }
    }
  });

  /* ---------- Start ---------- */
  var ses = bacaSession();
  if (ses) {
    role = ses.role;
    currentUser = ses.user;
    tampilApp();
  } else {
    tampilLogin();
  }
})();
