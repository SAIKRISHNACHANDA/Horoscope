/* =====================================================================
   JyotishVeda — Vedic astronomy engine (sidereal, Lahiri ayanamsa)
   Pure JavaScript, no dependencies. Accuracy: Sun/Moon within a few
   arc-minutes, planets within ~0.1–0.3°, sufficient for sign, house,
   nakshatra and dasha determination.
   ===================================================================== */
(function (global) {
  'use strict';

  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  const norm = (x) => ((x % 360) + 360) % 360;
  const sin = (d) => Math.sin(d * D2R);
  const cos = (d) => Math.cos(d * D2R);

  const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const SIGNS_SANSKRIT = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
  const SIGN_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
  const SIGN_ELEMENT = ['Fire', 'Earth', 'Air', 'Water', 'Fire', 'Earth', 'Air', 'Water', 'Fire', 'Earth', 'Air', 'Water'];
  const SIGN_QUALITY = ['Movable', 'Fixed', 'Dual', 'Movable', 'Fixed', 'Dual', 'Movable', 'Fixed', 'Dual', 'Movable', 'Fixed', 'Dual'];

  const NAKSHATRAS = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
    'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
  ];
  const NAK_LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  const DASHA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
  const DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];

  const PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const EXALTATION = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6, Rahu: 1, Ketu: 7 };
  const DEBILITATION = { Sun: 6, Moon: 7, Mars: 3, Mercury: 11, Jupiter: 9, Venus: 5, Saturn: 0, Rahu: 7, Ketu: 1 };
  const OWN = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10], Rahu: [10], Ketu: [7] };
  const FRIENDS = {
    Sun: ['Moon', 'Mars', 'Jupiter'], Moon: ['Sun', 'Mercury'], Mars: ['Sun', 'Moon', 'Jupiter'],
    Mercury: ['Sun', 'Venus'], Jupiter: ['Sun', 'Moon', 'Mars'], Venus: ['Mercury', 'Saturn'],
    Saturn: ['Mercury', 'Venus'], Rahu: ['Venus', 'Saturn', 'Mercury'], Ketu: ['Mars', 'Jupiter', 'Venus']
  };
  const ENEMIES = {
    Sun: ['Venus', 'Saturn'], Moon: [], Mars: ['Mercury'], Mercury: ['Moon'],
    Jupiter: ['Mercury', 'Venus'], Venus: ['Sun', 'Moon'], Saturn: ['Sun', 'Moon', 'Mars'],
    Rahu: ['Sun', 'Moon', 'Mars'], Ketu: ['Sun', 'Moon']
  };
  const COMBUST_ORB = { Mercury: 12, Venus: 8, Mars: 17, Jupiter: 11, Saturn: 15 };

  /* ---------- time ---------- */
  function julianDay(y, m, d, utHours) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + utHours / 24 + B - 1524.5;
  }
  function jdToDate(jd) {
    const z = Math.floor(jd + 0.5), f = jd + 0.5 - z;
    let A = z;
    if (z >= 2299161) { const a = Math.floor((z - 1867216.25) / 36524.25); A = z + 1 + a - Math.floor(a / 4); }
    const B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
    const day = B - D - Math.floor(30.6001 * E) + f;
    const month = E < 14 ? E - 1 : E - 13;
    const year = month > 2 ? C - 4716 : C - 4715;
    return new Date(Date.UTC(year, month - 1, Math.floor(day), Math.floor((day % 1) * 24)));
  }

  /* ---------- ayanamsa (Lahiri / Chitrapaksha) ---------- */
  function ayanamsa(T) { return 23.85294 + 1.396971 * T + 0.000308 * T * T; }
  function precessionFromJ2000(T) { return 1.396971 * T + 0.000308 * T * T; }

  /* ---------- Sun ---------- */
  function sunLongitude(T) {
    const L0 = norm(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    const M = norm(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
    const omega = 125.04 - 1934.136 * T;
    return norm(L0 + C - 0.00569 - 0.00478 * sin(omega));
  }

  /* ---------- Moon (Meeus ch.47, principal terms) ---------- */
  const MOON_TERMS = [
    [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116],
    [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758],
    [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720], [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528],
    [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
    [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036], [2, 0, 2, 0, 3994],
    [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
    [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048],
    [2, 0, 1, -2, -1773], [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
    [2, 1, 1, 0, -810], [4, -1, -2, 0, 759], [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691],
    [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537], [4, -1, 0, 0, 520], [1, 0, -2, 0, -487]
  ];
  function moonLongitude(T) {
    const Lp = norm(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T * T * T / 538841 - T * T * T * T / 65194000);
    const D = norm(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T * T * T / 545868);
    const M = norm(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T);
    const Mp = norm(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699);
    const F = norm(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T - T * T * T / 3526000);
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    let sum = 0;
    for (const [d, m, mp, f, c] of MOON_TERMS) {
      let coeff = c;
      if (Math.abs(m) === 1) coeff *= E; else if (Math.abs(m) === 2) coeff *= E * E;
      sum += coeff * sin(d * D + m * M + mp * Mp + f * F);
    }
    const A1 = norm(119.75 + 131.849 * T), A2 = norm(53.09 + 479264.290 * T);
    sum += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
    return norm(Lp + sum / 1e6);
  }
  function meanNode(T) {
    return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441);
  }

  /* ---------- Planets: Keplerian elements (JPL approx. 1800–2050) ---------- */
  const ELEMENTS = {
    Mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    Venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
    Earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    Mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    Jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    Saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]
  };
  function helioXYZ(name, T) {
    const e0 = ELEMENTS[name];
    const a = e0[0] + e0[6] * T, e = e0[1] + e0[7] * T, I = e0[2] + e0[8] * T;
    const L = e0[3] + e0[9] * T, w = e0[4] + e0[10] * T, O = e0[5] + e0[11] * T;
    const omega = w - O;
    let M = norm(L - w); if (M > 180) M -= 360;
    let Ecc = M + (e * R2D) * sin(M);
    for (let i = 0; i < 12; i++) {
      const dM = M - (Ecc - e * R2D * sin(Ecc));
      const dE = dM / (1 - e * cos(Ecc));
      Ecc += dE; if (Math.abs(dE) < 1e-7) break;
    }
    const xp = a * (cos(Ecc) - e), yp = a * Math.sqrt(1 - e * e) * sin(Ecc);
    const x = (cos(omega) * cos(O) - sin(omega) * sin(O) * cos(I)) * xp + (-sin(omega) * cos(O) - cos(omega) * sin(O) * cos(I)) * yp;
    const y = (cos(omega) * sin(O) + sin(omega) * cos(O) * cos(I)) * xp + (-sin(omega) * sin(O) + cos(omega) * cos(O) * cos(I)) * yp;
    const z = (sin(omega) * sin(I)) * xp + (cos(omega) * sin(I)) * yp;
    return [x, y, z];
  }
  function planetLongitude(name, T) {
    const p = helioXYZ(name, T), e = helioXYZ('Earth', T);
    const lonJ2000 = norm(Math.atan2(p[1] - e[1], p[0] - e[0]) * R2D);
    return norm(lonJ2000 + precessionFromJ2000(T));
  }

  /* ---------- Ascendant ---------- */
  function ascendant(jd, latDeg, lonEastDeg) {
    const T = (jd - 2451545.0) / 36525;
    const gmst = norm(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000);
    const ramc = norm(gmst + lonEastDeg);
    const eps = 23.439291 - 0.0130042 * T;
    const asc = Math.atan2(cos(ramc), -(sin(ramc) * cos(eps) + Math.tan(latDeg * D2R) * sin(eps))) * R2D;
    return { tropical: norm(asc), ramc, eps };
  }

  /* ---------- helpers ---------- */
  function signOf(lon) { return Math.floor(norm(lon) / 30); }
  function degInSign(lon) { return norm(lon) % 30; }
  function nakshatraOf(lon) {
    const idx = Math.floor(norm(lon) / (360 / 27));
    const pada = Math.floor((norm(lon) % (360 / 27)) / (360 / 108)) + 1;
    return { index: idx, name: NAKSHATRAS[idx], pada, lord: NAK_LORDS[idx % 9], fraction: (norm(lon) % (360 / 27)) / (360 / 27) };
  }
  function fmtDeg(lon) {
    const d = degInSign(lon); const deg = Math.floor(d); const m = Math.floor((d - deg) * 60); const s = Math.round(((d - deg) * 60 - m) * 60);
    return `${deg}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
  }
  function dignity(planet, signIdx) {
    if (EXALTATION[planet] === signIdx) return 'Exalted';
    if (DEBILITATION[planet] === signIdx) return 'Debilitated';
    if (OWN[planet].includes(signIdx)) return 'Own sign';
    const lord = SIGN_LORDS[signIdx];
    if (FRIENDS[planet].includes(lord)) return "Friend's sign";
    if (ENEMIES[planet].includes(lord)) return "Enemy's sign";
    return 'Neutral sign';
  }
  function dignityScore(d) {
    return { 'Exalted': 5, 'Own sign': 4, "Friend's sign": 3, 'Neutral sign': 2, "Enemy's sign": 1, 'Debilitated': 0 }[d];
  }
  function houseFrom(signIdx, fromSign) { return ((signIdx - fromSign + 12) % 12) + 1; }

  /* ---------- Vimshottari Dasha ---------- */
  function vimshottari(moonLon, birthJD) {
    const nak = nakshatraOf(moonLon);
    const startIdx = DASHA_ORDER.indexOf(nak.lord);
    const YEAR = 365.25;
    const balanceYears = (1 - nak.fraction) * DASHA_YEARS[nak.lord];
    const mahadashas = [];
    let jd = birthJD;
    for (let i = 0; i < 9; i++) {
      const lord = DASHA_ORDER[(startIdx + i) % 9];
      const years = i === 0 ? balanceYears : DASHA_YEARS[lord];
      const start = jd, end = jd + years * YEAR;
      // antardashas
      const antars = [];
      const lordIdx = DASHA_ORDER.indexOf(lord);
      const full = DASHA_YEARS[lord];
      let ajd = end - full * YEAR; // antardasha sequence always starts at the notional beginning of the mahadasha
      for (let k = 0; k < 9; k++) {
        const sub = DASHA_ORDER[(lordIdx + k) % 9];
        const len = full * DASHA_YEARS[sub] / 120 * YEAR;
        antars.push({ lord: sub, start: ajd, end: ajd + len });
        ajd += len;
      }
      mahadashas.push({ lord, start, end, years, antardashas: antars.filter(a => a.end > start) });
      jd = end;
    }
    return { nakshatra: nak, balanceYears, mahadashas };
  }

  /* ---------- Yogas ---------- */
  function detectYogas(chart) {
    const P = chart.planets, asc = chart.ascendant.sign, moonSign = P.Moon.sign;
    const yogas = [];
    const kendra = [1, 4, 7, 10], trikona = [1, 5, 9];
    const h = (pl, from) => houseFrom(P[pl].sign, from);
    const conj = (a, b) => P[a].sign === P[b].sign;

    if (kendra.includes(h('Jupiter', moonSign))) yogas.push('Gajakesari');
    if (conj('Sun', 'Mercury') && Math.abs(P.Sun.lon - P.Mercury.lon) < 20) yogas.push('Budhaditya');
    if (conj('Moon', 'Mars')) yogas.push('Chandra-Mangala');
    const nbMoon = ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].some(p => [2, 12].includes(h(p, moonSign)) || P[p].sign === moonSign);
    if (!nbMoon) yogas.push('Kemadruma');
    const mahapurusha = { Mars: 'Ruchaka', Mercury: 'Bhadra', Jupiter: 'Hamsa', Venus: 'Malavya', Saturn: 'Shasha' };
    for (const pl in mahapurusha) {
      if (['Exalted', 'Own sign'].includes(P[pl].dignity) && kendra.includes(P[pl].house)) yogas.push(mahapurusha[pl]);
    }
    // Raja yoga: lords of a kendra and a trikona conjunct or exchanging
    const lordOfHouse = (hn) => SIGN_LORDS[(asc + hn - 1) % 12];
    const kl = kendra.map(lordOfHouse), tl = trikona.map(lordOfHouse);
    let raja = false;
    for (const a of kl) for (const b of tl) if (a !== b && conj(a, b)) raja = true;
    if (raja) yogas.push('Raja Yoga');
    // Dhana: 2nd & 11th lords conjunct or in each other's house / 2nd lord with 5th/9th lord
    const l2 = lordOfHouse(2), l11 = lordOfHouse(11), l5 = lordOfHouse(5), l9 = lordOfHouse(9);
    if (conj(l2, l11) || conj(l2, l5) || conj(l2, l9) || conj(l11, l5) || conj(l11, l9)) yogas.push('Dhana Yoga');
    // Viparita Raja: lords of 6,8,12 placed in 6,8,12
    const dus = [6, 8, 12];
    const vip = dus.filter(hn => dus.includes(P[lordOfHouse(hn)].house));
    if (vip.length >= 2) yogas.push('Viparita Raja Yoga');
    // Neecha Bhanga: a debilitated planet whose dispositor is in kendra from Lagna/Moon
    for (const pl of PLANETS) {
      if (P[pl].dignity === 'Debilitated') {
        const disp = SIGN_LORDS[P[pl].sign];
        if (kendra.includes(P[disp].house) || kendra.includes(h(disp, moonSign)) || P[disp].dignity === 'Exalted') yogas.push('Neecha Bhanga Raja Yoga');
      }
    }
    // Amala: benefic in 10th from Lagna or Moon
    if (['Jupiter', 'Venus', 'Mercury'].some(p => P[p].house === 10 || h(p, moonSign) === 10)) yogas.push('Amala');
    // Saraswati: Jupiter, Venus, Mercury in kendra/trikona/2nd
    const good = [1, 2, 4, 5, 7, 9, 10];
    if (['Jupiter', 'Venus', 'Mercury'].every(p => good.includes(P[p].house))) yogas.push('Saraswati');
    // Mangal dosha
    const mh = P.Mars.house;
    const mangal = [1, 2, 4, 7, 8, 12].includes(mh);
    const mangalMoon = [1, 2, 4, 7, 8, 12].includes(h('Mars', moonSign));
    return { yogas: [...new Set(yogas)], mangalDosha: mangal, mangalDoshaFromMoon: mangalMoon };
  }

  /* ---------- Master computation ---------- */
  function computeChart(input) {
    // input: { year, month, day, hour, minute, tzOffsetHours, lat, lon }
    const localHours = input.hour + input.minute / 60;
    const utHours = localHours - input.tzOffsetHours;
    const jd = julianDay(input.year, input.month, input.day, utHours);
    const T = (jd - 2451545.0) / 36525;
    const ayan = ayanamsa(T);

    const trop = {
      Sun: sunLongitude(T), Moon: moonLongitude(T), Rahu: meanNode(T)
    };
    trop.Ketu = norm(trop.Rahu + 180);
    for (const p of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) trop[p] = planetLongitude(p, T);
    const T1 = T + 1 / 36525;
    const retro = {};
    for (const p of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
      const next = planetLongitude(p, T1);
      let diff = next - trop[p]; if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
      retro[p] = diff < 0;
    }
    retro.Rahu = true; retro.Ketu = true; retro.Sun = false; retro.Moon = false;

    const ascT = ascendant(jd, input.lat, input.lon);
    const ascLon = norm(ascT.tropical - ayan);
    const ascSign = signOf(ascLon);

    const planets = {};
    for (const p of PLANETS) {
      const lon = norm(trop[p] - ayan);
      const sign = signOf(lon);
      const d = dignity(p, sign);
      let sunDist = Math.abs(norm(trop[p]) - norm(trop.Sun)); if (sunDist > 180) sunDist = 360 - sunDist;
      planets[p] = {
        name: p, lon, sign, signName: SIGNS[sign], signSanskrit: SIGNS_SANSKRIT[sign], degree: degInSign(lon), degFmt: fmtDeg(lon),
        house: houseFrom(sign, ascSign), nakshatra: nakshatraOf(lon), dignity: d, dignityScore: dignityScore(d),
        retrograde: retro[p], combust: COMBUST_ORB[p] ? sunDist < COMBUST_ORB[p] : false, lordOf: []
      };
    }
    // which houses each planet rules
    for (let hn = 1; hn <= 12; hn++) {
      const lord = SIGN_LORDS[(ascSign + hn - 1) % 12];
      planets[lord].lordOf.push(hn);
    }
    const houses = [];
    for (let hn = 1; hn <= 12; hn++) {
      const sign = (ascSign + hn - 1) % 12;
      houses.push({ number: hn, sign, signName: SIGNS[sign], lord: SIGN_LORDS[sign], planets: PLANETS.filter(p => planets[p].house === hn) });
    }
    const chart = {
      input, jd, T, ayanamsa: ayan,
      ascendant: { lon: ascLon, sign: ascSign, signName: SIGNS[ascSign], signSanskrit: SIGNS_SANSKRIT[ascSign], degFmt: fmtDeg(ascLon), lord: SIGN_LORDS[ascSign], nakshatra: nakshatraOf(ascLon) },
      planets, houses,
      dasha: vimshottari(planets.Moon.lon, jd)
    };
    Object.assign(chart, detectYogas(chart));

    // Transits now
    const now = new Date();
    const jdNow = julianDay(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), now.getUTCHours() + now.getUTCMinutes() / 60);
    const Tn = (jdNow - 2451545.0) / 36525, ayanNow = ayanamsa(Tn);
    const transit = {};
    for (const p of ['Jupiter', 'Saturn', 'Mars']) transit[p] = signOf(norm(planetLongitude(p, Tn) - ayanNow));
    transit.Rahu = signOf(norm(meanNode(Tn) - ayanNow)); transit.Ketu = (transit.Rahu + 6) % 12;
    chart.transits = { jd: jdNow, signs: transit, fromMoon: {} };
    for (const p in transit) chart.transits.fromMoon[p] = houseFrom(transit[p], planets.Moon.sign);
    chart.transits.fromLagna = {};
    for (const p in transit) chart.transits.fromLagna[p] = houseFrom(transit[p], ascSign);
    // Sade sati
    const satFromMoon = chart.transits.fromMoon.Saturn;
    chart.sadeSati = satFromMoon === 12 ? 'rising' : satFromMoon === 1 ? 'peak' : satFromMoon === 2 ? 'setting' : (satFromMoon === 4 || satFromMoon === 8) ? 'dhaiya' : 'none';

    // Current dasha
    const md = chart.dasha.mahadashas.find(m => jdNow >= m.start && jdNow < m.end) || chart.dasha.mahadashas[chart.dasha.mahadashas.length - 1];
    const ad = md.antardashas.find(a => jdNow >= a.start && jdNow < a.end) || md.antardashas[0];
    chart.currentDasha = { maha: md, antar: ad };
    return chart;
  }

  global.Astro = {
    computeChart, julianDay, jdToDate, SIGNS, SIGNS_SANSKRIT, SIGN_LORDS, SIGN_ELEMENT, SIGN_QUALITY, NAKSHATRAS, PLANETS,
    DASHA_YEARS, houseFrom, fmtDeg
  };
})(typeof window !== 'undefined' ? window : globalThis);
