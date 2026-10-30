/* Shifokor top: small script for the doctor pages — shows the live rating. */
(function () {
  var el = document.getElementById("rating");
  var c = window.ST_CONFIG || {};
  if (!el || !c.supabaseUrl || !window.fetch) return;
  var ru = document.documentElement.lang === "ru";
  var id = el.getAttribute("data-id");
  fetch(String(c.supabaseUrl).replace(/\/+$/, "") + "/rest/v1/ratings?select=avg,n&doctor_id=eq." + encodeURIComponent(id),
    { headers: { apikey: c.supabaseKey, Authorization: "Bearer " + c.supabaseKey } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      var r = rows && rows[0];
      if (r && r.n) {
        var stars = document.createElement("span");
        stars.className = "stars"; stars.style.setProperty("--p", Math.round(r.avg / 5 * 100) + "%"); stars.textContent = "★★★★★";
        el.appendChild(stars);
        el.appendChild(document.createTextNode(" " + Number(r.avg).toFixed(1) + (ru ? " — оценок: " + r.n : " — " + r.n + " ta bemor baho bergan")));
      } else {
        el.textContent = ru ? "Пока нет оценок — оцените первым" : "Hali baho yo'q — birinchi bo'lib baho bering";
        el.className += " muted";
      }
      el.hidden = false;
    })
    .catch(function () {});
})();
