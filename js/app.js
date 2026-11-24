/* =====================================================================
   JyotishVeda — Landing page + generator UI
   ===================================================================== */
(function () {
  'use strict';
  const C = window.JV_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- price everywhere ---------- */
  $$('[data-price]').forEach(el => el.textContent = '₹' + C.price);
  $$('[data-oprice]').forEach(el => el.textContent = '₹' + C.originalPrice);
  $$('[data-brand]').forEach(el => el.textContent = C.brand);
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  /* ---------- nav ---------- */
  const nav = $('.nav');
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20), { passive: true });
  $('.nav-toggle').addEventListener('click', () => nav.classList.toggle('open'));
  $$('.nav a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

  /* ---------- FAQ ---------- */
  $$('.faq-item button').forEach(b => b.addEventListener('click', () => {
    const item = b.parentElement; const open = item.classList.contains('open');
    $$('.faq-item').forEach(i => i.classList.remove('open'));
    if (!open) item.classList.add('open');
  }));

  /* ---------- stars background ---------- */
  (function stars() {
    const cv = $('#stars'); if (!cv) return; const ctx = cv.getContext('2d');
    let w, h, pts = [];
    function resize() { w = cv.width = innerWidth; h = cv.height = Math.min(innerHeight * 1.2, 1200); pts = Array.from({ length: Math.floor(w * h / 9000) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.2, a: Math.random(), s: Math.random() * 0.02 + 0.005 })); }
    function draw() { ctx.clearRect(0, 0, w, h); for (const p of pts) { p.a += p.s; const al = 0.35 + 0.35 * Math.sin(p.a * 6); ctx.fillStyle = `rgba(255,236,200,${al})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } requestAnimationFrame(draw); }
    resize(); window.addEventListener('resize', resize); draw();
  })();

  /* ---------- city picker ---------- */
  const cityInput = $('#place'), cityList = $('#city-list'), latEl = $('#lat'), lonEl = $('#lon'), tzEl = $('#tz'), manual = $('#manual-loc');
  let chosen = null;
  function renderCities(q) {
    cityList.innerHTML = '';
    if (!q || q.length < 2) { cityList.classList.remove('show'); return; }
    const ql = q.toLowerCase();
    const hits = window.CITIES.filter(c => c[0].toLowerCase().includes(ql) || c[1].toLowerCase().includes(ql)).slice(0, 8);
    if (!hits.length) { cityList.innerHTML = `<li class="none">Not found. Tick "Enter coordinates manually" below.</li>`; cityList.classList.add('show'); return; }
    for (const c of hits) {
      const li = document.createElement('li'); li.innerHTML = `<strong>${c[0]}</strong><span>${c[1]}</span>`;
      li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(c); });
      cityList.appendChild(li);
    }
    cityList.classList.add('show');
  }
  function pick(c) { chosen = c; cityInput.value = `${c[0]}, ${c[1]}`; latEl.value = c[2]; lonEl.value = c[3]; tzEl.value = c[4]; cityList.classList.remove('show'); cityInput.classList.remove('err'); }
  cityInput.addEventListener('input', () => { chosen = null; renderCities(cityInput.value); });
  cityInput.addEventListener('focus', () => renderCities(cityInput.value));
  cityInput.addEventListener('blur', () => setTimeout(() => cityList.classList.remove('show'), 150));
  manual.addEventListener('change', () => $('#manual-fields').classList.toggle('show', manual.checked));

  /* ---------- date/time defaults ---------- */
  const yearSel = $('#year'); const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= 1920; y--) { const o = document.createElement('option'); o.value = y; o.textContent = y; yearSel.appendChild(o); }
  yearSel.value = 1995;
  const daySel = $('#day'); for (let d = 1; d <= 31; d++) { const o = document.createElement('option'); o.value = d; o.textContent = d; daySel.appendChild(o); }
  const hourSel = $('#hour'); for (let h = 0; h < 24; h++) { const o = document.createElement('option'); o.value = h; o.textContent = String(h).padStart(2, '0'); hourSel.appendChild(o); }
  const minSel = $('#minute'); for (let m = 0; m < 60; m++) { const o = document.createElement('option'); o.value = m; o.textContent = String(m).padStart(2, '0'); minSel.appendChild(o); }
  hourSel.value = 10; minSel.value = 30;

  /* restore saved form */
  try { const saved = JSON.parse(localStorage.getItem('jv_form') || 'null'); if (saved) { for (const k in saved) { const el = $('#' + k); if (el && el.type !== 'checkbox') el.value = saved[k]; } if (saved.lat) chosen = ['', '', saved.lat, saved.lon, saved.tz]; } } catch (e) { }

  /* ---------- generate ---------- */
  let currentChart = null, currentUser = null, unlocked = false;
  const paywallEl = $('#report-paywall');
  $('#kundli-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#name').value.trim();
    if (!name) { $('#name').classList.add('err'); $('#name').focus(); return; }
    $('#name').classList.remove('err');
    let lat, lon, tz;
    if (manual.checked) { lat = parseFloat($('#mlat').value); lon = parseFloat($('#mlon').value); tz = parseFloat($('#mtz').value); }
    else { lat = parseFloat(latEl.value); lon = parseFloat(lonEl.value); tz = parseFloat(tzEl.value); }
    if (isNaN(lat) || isNaN(lon) || isNaN(tz)) { cityInput.classList.add('err'); cityInput.focus(); renderCities(cityInput.value); return; }
    const input = { year: +yearSel.value, month: +$('#month').value, day: +daySel.value, hour: +hourSel.value, minute: +minSel.value, tzOffsetHours: tz, lat, lon };
    const dt = new Date(input.year, input.month - 1, input.day); if (dt.getDate() !== input.day) { alert('That date does not exist in the chosen month. Please check the day.'); return; }
    currentUser = { name, place: cityInput.value || `${lat.toFixed(2)}, ${lon.toFixed(2)}`, gender: $('#gender').value };
    try { localStorage.setItem('jv_form', JSON.stringify({ name, place: cityInput.value, year: input.year, month: input.month, day: input.day, hour: input.hour, minute: input.minute, lat, lon, tz, gender: currentUser.gender })); } catch (err) { }

    const btn = $('#generate-btn'); btn.disabled = true; btn.textContent = 'Calculating planetary positions…';
    setTimeout(() => {
      currentChart = window.Astro.computeChart(input);
      unlocked = false;
      renderReport();
      btn.disabled = false; btn.innerHTML = 'Generate My Horoscope <span>→</span>';
    }, 500);
  });

  function renderReport() {
    const html = window.Report.build(currentChart, currentUser);
    const view = $('#report-view'); const body = $('#report-body');
    $('.report-paper').appendChild(paywallEl); // detach paywall before re-render so it survives innerHTML replacement
    body.innerHTML = html;
    view.classList.toggle('locked', !unlocked);
    document.body.classList.toggle('unlocked', unlocked);
    paywallEl.style.display = unlocked ? 'none' : '';
    if (!unlocked) body.querySelector('#lagna').after(paywallEl);
    $('#print-btn').style.display = unlocked ? '' : 'none';
    document.body.classList.add('report-open');
    view.scrollTop = 0; window.scrollTo(0, 0);
    buildTOC();
  }
  function buildTOC() {
    const toc = $('#report-toc'); toc.innerHTML = '';
    $$('#report-body .rsec').forEach(s => { const h = s.querySelector('h2, h1'); if (!h) return; const a = document.createElement('a'); a.href = '#' + s.id; a.textContent = h.textContent.replace(/:.*$/, ''); a.addEventListener('click', (e) => { e.preventDefault(); if (!unlocked && !['cover', 'chart', 'lagna'].includes(s.id)) { $('#report-paywall').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; } s.scrollIntoView({ behavior: 'smooth' }); }); toc.appendChild(a); });
  }
  $('#close-report').addEventListener('click', () => { document.body.classList.remove('report-open'); });
  $('#print-btn').addEventListener('click', () => window.print());
  $('#new-report').addEventListener('click', () => { document.body.classList.remove('report-open'); $('#generate').scrollIntoView({ behavior: 'smooth' }); });

  /* ---------- payment ---------- */
  const modal = $('#pay-modal');
  function openModal() { modal.classList.add('show'); document.body.style.overflow = 'hidden'; }
  function closeModal() { modal.classList.remove('show'); document.body.style.overflow = ''; }
  $$('[data-close-modal]').forEach(b => b.addEventListener('click', closeModal));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  function unlock(ref) {
    unlocked = true;
    renderReport();
    closeModal();
    const toast = $('#toast'); toast.textContent = ref ? `Payment received (${ref}). Your complete horoscope is unlocked.` : 'Your complete horoscope is unlocked.'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 5000);
  }

  function startPayment() {
    if (!currentChart) { $('#generate').scrollIntoView({ behavior: 'smooth' }); return; }
    if (C.razorpayKeyId && window.Razorpay) {
      const rzp = new window.Razorpay({
        key: C.razorpayKeyId, amount: C.price * 100, currency: C.currency, name: C.brand,
        description: 'Complete Vedic Horoscope Report', prefill: { name: currentUser.name },
        notes: { place: currentUser.place }, theme: { color: '#c9a227' },
        handler: (resp) => unlock(resp.razorpay_payment_id)
      });
      rzp.on('payment.failed', () => { $('#pay-error').textContent = 'Payment did not go through. You can retry or use the UPI option.'; openModal(); });
      rzp.open();
      return;
    }
    // UPI / manual fallback
    const upiBox = $('#upi-box');
    if (C.upiId) {
      const link = `upi://pay?pa=${encodeURIComponent(C.upiId)}&pn=${encodeURIComponent(C.payeeName)}&am=${C.price}&cu=INR&tn=${encodeURIComponent('Horoscope report for ' + currentUser.name)}`;
      upiBox.innerHTML = `<p>Pay <strong>₹${C.price}</strong> to UPI ID <code>${C.upiId}</code>, then enter the UPI transaction reference below.</p><a class="btn btn-gold" href="${link}">Open UPI app to pay</a>`;
      upiBox.style.display = '';
    } else { upiBox.style.display = 'none'; }
    $('#demo-box').style.display = C.demoUnlock ? '' : 'none';
    $('#wa-box').style.display = C.whatsapp ? '' : 'none';
    if (C.whatsapp) $('#wa-link').href = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent('Hi, I want to purchase the ₹' + C.price + ' horoscope report for ' + currentUser.name)}`;
    $('#pay-error').textContent = '';
    openModal();
  }
  $$('[data-pay]').forEach(b => b.addEventListener('click', startPayment));
  $('#upi-confirm').addEventListener('click', () => {
    const ref = $('#upi-ref').value.trim();
    if (ref.length < 6) { $('#pay-error').textContent = 'Please enter the 12-digit UPI transaction reference from your payment app.'; return; }
    unlock(ref);
  });
  $('#demo-unlock').addEventListener('click', () => unlock(''));

  /* sample report on landing page */
  $('#sample-btn').addEventListener('click', () => {
    currentUser = { name: 'Sample Native', place: 'Hyderabad, Telangana, India', gender: '' };
    currentChart = window.Astro.computeChart({ year: 1992, month: 8, day: 14, hour: 6, minute: 45, tzOffsetHours: 5.5, lat: 17.385, lon: 78.4867 });
    unlocked = false; renderReport();
  });
})();
