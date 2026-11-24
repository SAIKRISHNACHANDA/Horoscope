/* =====================================================================
   JyotishVeda — Report composer
   Turns a computed chart into a long-form, section-by-section reading.
   ===================================================================== */
(function (global) {
  'use strict';
  const A = global.Astro, I = global.Interp;
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const ABBR = { Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' };
  const BENEFICS = ['Jupiter', 'Venus', 'Mercury', 'Moon'];
  const fmtDate = (jd) => A.jdToDate(jd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const KENDRA = [1, 4, 7, 10], TRIKONA = [1, 5, 9], UPACHAYA = [3, 6, 10, 11], DUSTHANA = [6, 8, 12];

  const FIELDS = {
    Sun: 'government service, administration, medicine, politics, leadership roles and any position of authority',
    Moon: 'work with the public, hospitality, nursing, food and beverages, real estate, psychology and the care of others',
    Mars: 'engineering, defence and police, surgery, sports, real estate, manufacturing and technical leadership',
    Mercury: 'commerce, writing, information technology, accounting, media, teaching, consulting and trade',
    Jupiter: 'teaching, law, finance and banking, counselling, religion, publishing and advisory work',
    Venus: 'the arts, fashion, entertainment, luxury goods, design, hospitality, beauty and diplomacy',
    Saturn: 'industry, construction, mining, agriculture, labour management, government service, law and long-term institutional work',
    Rahu: 'technology, foreign trade, media, aviation, politics, research and unconventional enterprise',
    Ketu: 'healing, spirituality, research, information technology, astrology and work behind the scenes'
  };

  function strengthScore(p) {
    let s = p.dignityScore * 2; // 0..10
    if (KENDRA.includes(p.house) || TRIKONA.includes(p.house)) s += 2;
    else if (UPACHAYA.includes(p.house)) s += 1;
    else if (DUSTHANA.includes(p.house)) s -= 1;
    if (p.combust) s -= 2;
    if (p.retrograde && !['Rahu', 'Ketu'].includes(p.name)) s += 0; // retrograde treated as intensifying, not weakening
    return Math.max(1, Math.min(12, s + 1));
  }
  function strengthWord(score) {
    if (score >= 10) return 'very strong'; if (score >= 8) return 'strong'; if (score >= 6) return 'moderate'; if (score >= 4) return 'weak'; return 'afflicted';
  }

  function relationText(fromH, toH) {
    const d = ((toH - fromH + 12) % 12) + 1;
    const q = KENDRA.includes(toH) ? 'an angular (kendra) house, which gives the matter stability and prominence' :
      TRIKONA.includes(toH) ? 'a trinal (trikona) house, which blesses the matter with fortune and natural ease' :
        DUSTHANA.includes(toH) ? 'a difficult (dusthana) house, which means this area of life is tested, delayed or transformed through struggle before it rewards you' :
          UPACHAYA.includes(toH) ? 'a growing (upachaya) house, which means the matter improves steadily with time and effort' : 'a supportive house';
    const map = {
      1: 'The lord stays in its own house, which the classics praise: this area of life is self-sustaining, strong and under your own control.',
      2: 'The lord moves to the second house from its own, linking this area to accumulation and resources; what this house promises becomes a source of sustenance.',
      3: 'The lord moves to the third from its own, meaning this area requires your personal effort and courage, and is advanced through communication and initiative.',
      4: 'The lord moves to the fourth from its own, giving this area comfort, stability and emotional satisfaction once it is established.',
      5: 'The lord moves to the fifth from its own, a trinal relationship that brings creativity, intelligence and the fruits of past merit to this area.',
      6: 'The lord moves to the sixth from its own, which means this area is contested: competition, service and obstacles shape it, and victory comes through persistence.',
      7: 'The lord moves to the seventh from its own, meaning this area is expressed through partnership and public dealings; others play a decisive role.',
      8: 'The lord moves to the eighth from its own, a position of obstruction and transformation; this area undergoes deep changes and hidden developments before it settles.',
      9: 'The lord moves to the ninth from its own, a trinal relationship of great fortune; this area is protected by grace and grows through dharma and learning.',
      10: 'The lord moves to the tenth from its own, meaning this area is actualised through action, work and public conduct; you must do, not merely wish.',
      11: 'The lord moves to the eleventh from its own, promising gains and fulfilment from this area, often through networks and friends.',
      12: 'The lord moves to the twelfth from its own, meaning there is some loss, distance, foreign connection or spiritualisation of this area; expenditure here is often an investment in the unseen.'
    };
    return `${map[d]} It also lands in ${q}.`;
  }

  function planetCondition(p, chart) {
    const parts = [];
    parts.push(`${p.name} is in ${p.signName} (${p.signSanskrit}) at ${p.degFmt}, in your ${ord(p.house)} house, in the nakshatra of ${p.nakshatra.name} ruled by ${p.nakshatra.lord}, pada ${p.nakshatra.pada}.`);
    parts.push(I.DIGNITY_TEXT[p.dignity](p.name));
    if (p.retrograde && !['Rahu', 'Ketu'].includes(p.name)) parts.push(`${p.name} is retrograde (vakri), which in Jyotisha intensifies rather than weakens the planet: its themes recur in your life until they are mastered, and they often carry a past-life quality.`);
    if (p.combust) parts.push(`${p.name} is combust, too close to the Sun. Its independent expression is partly consumed by ego, father or authority, and its significations need conscious protection through remedies.`);
    if (p.lordOf.length) parts.push(`In your chart ${p.name} rules the ${p.lordOf.map(ord).join(' and ')} house${p.lordOf.length > 1 ? 's' : ''}, so its condition directly governs ${p.lordOf.map(h => I.HOUSE[h].theme).join(', and ')}.`);
    return parts.join(' ');
  }

  /* ---------- North Indian chart SVG ---------- */
  function chartSVG(chart) {
    const S = 400, c = S / 2;
    // house label positions (north indian): 1 top-centre, then anticlockwise
    const pos = [
      [c, 90], [100, 45], [45, 100], [100, c], [45, 300], [100, 355], [c, 310], [300, 355], [355, 300], [300, c], [355, 100], [300, 45]
    ];
    let planetsHtml = '';
    chart.houses.forEach((h, i) => {
      const [x, y] = pos[i];
      const label = String(h.sign + 1);
      planetsHtml += `<text x="${x}" y="${y - 14}" class="k-sign" text-anchor="middle">${label}</text>`;
      const ps = h.planets.map(p => ABBR[p] + (chart.planets[p].retrograde && !['Rahu', 'Ketu'].includes(p) ? '℞' : ''));
      const rows = []; for (let k = 0; k < ps.length; k += 3) rows.push(ps.slice(k, k + 3).join(' '));
      rows.forEach((r, ri) => { planetsHtml += `<text x="${x}" y="${y + 6 + ri * 15}" class="k-planet" text-anchor="middle">${r}</text>`; });
    });
    return `<svg viewBox="0 0 ${S} ${S}" class="kundli" role="img" aria-label="North Indian style birth chart">
      <rect x="2" y="2" width="${S - 4}" height="${S - 4}" class="k-frame"/>
      <line x1="2" y1="2" x2="${S - 2}" y2="${S - 2}" class="k-line"/><line x1="${S - 2}" y1="2" x2="2" y2="${S - 2}" class="k-line"/>
      <polygon points="${c},2 ${S - 2},${c} ${c},${S - 2} 2,${c}" class="k-line k-diamond"/>
      ${planetsHtml}</svg>`;
  }

  function planetTable(chart) {
    let rows = '';
    for (const name of A.PLANETS) {
      const p = chart.planets[name];
      rows += `<tr><td><strong>${name}</strong><span class="muted"> ${I.PLANET[name].sanskrit}</span></td><td>${p.signName}</td><td>${p.degFmt}</td><td>${p.house}</td><td>${p.nakshatra.name} <span class="muted">(${p.nakshatra.pada})</span></td><td>${p.dignity}${p.retrograde && !['Rahu', 'Ketu'].includes(name) ? ' · Retro' : ''}${p.combust ? ' · Combust' : ''}</td></tr>`;
    }
    return `<table class="ptable"><thead><tr><th>Graha</th><th>Rashi</th><th>Degree</th><th>House</th><th>Nakshatra</th><th>Dignity</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function strengthBars(chart) {
    return `<div class="bars">${A.PLANETS.map(n => { const s = strengthScore(chart.planets[n]); return `<div class="bar"><span class="bar-label">${n}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round(s / 12 * 100)}%"></span></span><span class="bar-val">${strengthWord(s)}</span></div>`; }).join('')}</div>`;
  }

  /* ---------- Section builders ---------- */
  function sec(id, title, kicker, html) {
    return `<section class="rsec" id="${id}"><div class="rsec-head"><span class="kicker">${kicker}</span><h2>${title}</h2></div>${html}</section>`;
  }
  const para = (t) => `<p>${t}</p>`;

  function lifeAreas(chart) {
    const P = chart.planets, H = chart.houses;
    const lord = (h) => H[h - 1].lord;
    const occ = (h) => H[h - 1].planets;
    const occText = (h, what) => occ(h).length ? `The ${ord(h)} house is occupied by ${occ(h).join(', ')}, which colours ${what} with ${occ(h).map(p => I.ANTAR_NATURE[p]).join('; ')}.` : `No planet occupies the ${ord(h)} house, so its results flow mainly through its lord and the aspects it receives, which generally means fewer complications in ${what}.`;
    const cond = (name) => { const p = P[name]; return `${name}, ${strengthWord(strengthScore(p))} in your chart (${p.dignity.toLowerCase()} in ${p.signName}, ${ord(p.house)} house)`; };

    // Career
    const l10 = lord(10), p10 = P[l10];
    const career = [
      `Your 10th house, the house of karma and profession, falls in ${H[9].signName}, a ${A.SIGN_ELEMENT[H[9].sign].toLowerCase()} and ${A.SIGN_QUALITY[H[9].sign].toLowerCase()} sign, ruled by ${l10}. The nature of ${H[9].signName} describes how you work: ${signWorkStyle(H[9].sign)}.`,
      `${cond(l10)}, is the lord of your profession. ${relationText(10, p10.house)} With ${l10} as career lord, the fields that reward you most naturally are ${FIELDS[l10]}.`,
      occText(10, 'your professional life'),
      `${P.Sun.house === 10 || P.Saturn.house === 10 || P.Mars.house === 10 ? 'A planet with directional strength sits in your 10th house, which is a mark of career prominence. ' : ''}The 10th house counted from your Moon falls in ${A.SIGNS[(P.Moon.sign + 9) % 12]}, ruled by ${A.SIGN_LORDS[(P.Moon.sign + 9) % 12]}, which adds ${FIELDS[A.SIGN_LORDS[(P.Moon.sign + 9) % 12]].split(',')[0]} and related work as a second current in your professional life. The dasha periods of ${l10}${A.SIGN_LORDS[(P.Moon.sign + 9) % 12] !== l10 ? ' and ' + A.SIGN_LORDS[(P.Moon.sign + 9) % 12] : ''} are when career matters move most decisively.`
    ];

    // Wealth
    const l2 = lord(2), l11 = lord(11);
    const wealth = [
      `Wealth in Jyotisha is read from the 2nd house (accumulated wealth and savings), the 11th house (income and gains), and from Jupiter, the natural karaka of prosperity. Your 2nd house is ${H[1].signName}, ruled by ${l2}; your 11th house is ${H[10].signName}, ruled by ${l11}.`,
      `${cond(l2)}, governs what you keep. ${relationText(2, P[l2].house)}`,
      `${cond(l11)}, governs what comes in. ${relationText(11, P[l11].house)}`,
      `${cond('Jupiter')} is your indicator of fortune and expansion. ${P.Jupiter.dignityScore >= 3 ? 'A well-placed Jupiter means that wealth tends to grow through honourable means and that you are protected from financial ruin even in difficult years.' : 'Jupiter needs support in your chart, so prosperity is earned rather than gifted; disciplined saving and charitable giving on Thursdays strengthen it.'} ${chart.yogas.includes('Dhana Yoga') ? 'The presence of Dhana Yoga in your chart is a classical indicator of substantial wealth in the dasha periods of the planets forming it.' : ''} ${occText(2, 'your savings and family wealth')} ${occText(11, 'your income')}`
    ];

    // Marriage
    const l7 = lord(7);
    const marriage = [
      `The 7th house governs marriage, the spouse and all one-to-one partnerships. Yours falls in ${H[6].signName}, ruled by ${l7}, and this sign describes the partner you attract: ${spouseBySign(H[6].sign)}.`,
      `${cond(l7)} is the lord of your marriage. ${relationText(7, P[l7].house)}`,
      `${cond('Venus')} is the natural karaka of love and marriage for everyone, and ${cond('Jupiter')} is the karaka of the husband in a woman's chart and of dharma in marriage generally. ${P.Venus.dignityScore >= 3 ? 'Venus is comfortable in your chart, which promises affection, attraction and the capacity for a loving partnership.' : 'Venus is under some strain in your chart, which means love must be learned consciously; the lessons are real but so are the rewards once they are absorbed.'}`,
      occText(7, 'your marriage and partnerships'),
      chart.mangalDosha || chart.mangalDoshaFromMoon ?
        `<strong>Mangal Dosha:</strong> Mars occupies the ${ord(P.Mars.house)} house from your Lagna${chart.mangalDoshaFromMoon ? ` and the ${ord(A.houseFrom(P.Mars.sign, P.Moon.sign))} house from your Moon` : ''}, which constitutes Mangal (Kuja) Dosha. In practice this means your marriage carries heat: passion, independence and the potential for conflict. The dosha is substantially reduced if your partner also has Mangal Dosha, if Mars is in its own or exaltation sign${['Own sign', 'Exalted'].includes(P.Mars.dignity) ? ' (which it is in your chart, a significant cancellation)' : ''}, if Jupiter aspects Mars, or if marriage happens after the age of 28. Matching of charts before marriage is strongly advised, and the remedies for Mars given later in this report apply.` :
        `<strong>Mangal Dosha:</strong> Mars is not in a dosha-forming house from either your Lagna or your Moon, so you do not carry Mangal Dosha. This removes one of the common obstacles to marital harmony.`,
      `Timing: marriage and significant relationships tend to arrive or deepen in the dasha and antardasha periods of ${l7}, Venus${P.Rahu.house === 7 ? ', Rahu' : ''} and the planets occupying your 7th house, and when Jupiter transits your 7th house, your Lagna, or the 7th from your Moon.`
    ];

    // Health
    const lagnaLord = chart.ascendant.lord;
    const malInLagna = occ(1).filter(p => ['Mars', 'Saturn', 'Rahu', 'Ketu', 'Sun'].includes(p));
    const health = [
      `The body is read from the Lagna, its lord, the 6th house (illness), the 8th house (chronic conditions and longevity) and the natural malefics. Your Lagna lord ${cond(lagnaLord)} is the primary indicator of your vitality. ${P[lagnaLord].dignityScore >= 3 ? 'A well-placed Lagna lord gives good recuperative power, a sound constitution and the ability to recover from illness through willpower.' : 'A Lagna lord under pressure means that health must be guarded actively; routine, diet and the remedies for this planet are not optional for you but foundational.'}`,
      `Your rising sign, ${chart.ascendant.signName}, governs ${bodyBySign(chart.ascendant.sign)}, and these are the areas most likely to express stress first. ${malInLagna.length ? `The presence of ${malInLagna.join(' and ')} in your Lagna adds intensity to the constitution: more energy, but also more inflammation, tension or wear, depending on the planet.` : 'No malefic occupies your Lagna, which spares the body from several common afflictions.'}`,
      `${occText(6, 'the pattern of acute illness and recovery')} ${occText(8, 'chronic health and longevity')} The 8th lord ${cond(lord(8))} indicates longevity; ${P[lord(8)].dignityScore >= 2 && !DUSTHANA.includes(P[lord(8)].house) ? 'its placement supports a long life.' : 'its placement asks for caution in the dasha of this planet and in the periods flagged in the transit section.'}`,
      `Practical counsel: ${healthCounsel(chart.ascendant.sign)}`
    ];

    // Education & Children
    const l4 = lord(4), l5 = lord(5);
    const edu = [
      `Formal education is read from the 4th house and its lord, higher education from the 9th, and intelligence from the 5th house, Mercury and Jupiter. Your 4th lord ${cond(l4)} describes your schooling: ${relationText(4, P[l4].house)}`,
      `Your 5th house, the house of intelligence (buddhi), creativity and children, falls in ${H[4].signName}, ruled by ${l5}. ${cond(l5)} is its lord. ${relationText(5, P[l5].house)} ${occText(5, 'your intelligence, creativity and children')}`,
      `${cond('Mercury')} shapes how you learn and speak; ${cond('Jupiter')} shapes wisdom and the blessing of children. ${P.Mercury.dignityScore >= 3 ? 'Mercury is well placed, giving a quick, articulate and analytical mind.' : 'Mercury needs support; writing daily and speaking truthfully strengthen it.'} ${P.Jupiter.house === 5 || P.Jupiter.dignityScore >= 4 ? 'Jupiter strongly favours children and higher wisdom in your chart.' : (['Saturn', 'Rahu', 'Ketu'].some(m => occ(5).includes(m)) ? 'A malefic in the 5th house suggests some delay, anxiety or unconventionality regarding children; it does not deny them, and Jupiter remedies ease the way.' : 'Children are indicated normally; their arrival is likely in the periods of the 5th lord and Jupiter.')}`
    ];

    // Family & Home
    const family = [
      `Home, mother and inner happiness belong to the 4th house (${H[3].signName}, ruled by ${l4}), siblings to the 3rd (${H[2].signName}, ruled by ${lord(3)}) and the 11th, and father to the 9th (${H[8].signName}, ruled by ${lord(9)}) along with the Sun.`,
      `${occText(4, 'your domestic life and relationship with mother')} ${cond('Moon')} is the karaka of mother; ${P.Moon.dignityScore >= 3 ? 'a comfortable Moon speaks of a nurturing mother and the capacity to create emotional security for yourself and others.' : 'the Moon under strain suggests that emotional security was something you had to build rather than inherit, and that caring for your own mind is a lifelong priority.'}`,
      `${cond('Sun')} is the karaka of father. ${P.Sun.dignityScore >= 3 ? 'The Sun is strong, indicating a father of standing and a relationship that, whatever its tensions, gave you a sense of authority.' : 'The Sun is not at full strength, suggesting either distance from the father, his struggles, or a lesson in building your own authority independent of him.'} ${occText(3, 'your relationships with siblings and your personal courage')}`
    ];

    // Spirituality
    const l9 = lord(9), l12 = lord(12);
    const spirit = [
      `Dharma is read from the 9th house (${H[8].signName}, ruled by ${l9}), moksha from the 12th (${H[11].signName}, ruled by ${l12}), and the spiritual temperament from Jupiter and Ketu.`,
      `${cond(l9)} is your lord of fortune and faith. ${relationText(9, P[l9].house)} ${occText(9, 'your luck, your father and your relationship with teachers')}`,
      `${cond('Ketu')} shows where your soul is already detached and where past-life knowledge lives: the ${ord(P.Ketu.house)} house, governing ${I.HOUSE[P.Ketu.house].theme}. ${cond('Rahu')} shows where your soul still hungers for experience in this life: the ${ord(P.Rahu.house)} house, governing ${I.HOUSE[P.Rahu.house].theme}. The axis between these two is the central spiritual tension of your life, and your growth comes from moving toward the Rahu house with the wisdom of the Ketu house.`,
      `${occText(12, 'your spiritual life, foreign connections and expenses')} ${chart.planets.Jupiter.house === 12 || chart.planets.Ketu.house === 12 || chart.planets.Saturn.house === 12 ? 'A moksha-karaka planet in your 12th house marks you as someone for whom liberation is not an abstraction but a genuine pull.' : ''}`
    ];

    return { career, wealth, marriage, health, edu, family, spirit };
  }

  function signWorkStyle(s) {
    return ['with speed, initiative and competitive fire, preferring to lead rather than follow', 'with patience, practicality and an instinct for value, building slowly and securely', 'with versatility, communication and intellectual agility, often juggling several roles', 'with sensitivity to people, protective instinct and emotional intelligence', 'with authority, visibility and a need to be recognised for your contribution', 'with precision, analysis and devotion to service and detail', 'with diplomacy, aesthetics and skill in partnership and negotiation', 'with intensity, strategy and the ability to handle crisis and hidden matters', 'with vision, idealism and a need for growth, freedom and meaning', 'with discipline, ambition and the stamina to climb the long ladder of institutions', 'with originality, systems thinking and a humanitarian or technological orientation', 'with imagination, compassion and intuition, often in service or creative fields'][s];
  }
  function spouseBySign(s) {
    return ['independent, energetic, direct and competitive, with a strong will', 'steady, affectionate, practical and fond of comfort and beauty', 'intelligent, talkative, youthful and versatile, needing mental connection', 'caring, emotional, home-loving and attached to family', 'proud, generous, warm and dignified, with leadership qualities', 'careful, intelligent, modest and service-oriented', 'charming, fair-minded, sociable and attractive', 'intense, loyal, private and powerful in personality', 'philosophical, honest, optimistic and freedom-loving', 'disciplined, responsible, mature and ambitious', 'original, independent, friendly and unconventional', 'gentle, imaginative, compassionate and spiritual'][s];
  }
  function bodyBySign(s) {
    return ['the head, brain, face and eyes', 'the throat, neck, thyroid and voice', 'the shoulders, arms, hands, lungs and nervous system', 'the chest, breasts, stomach and digestive fluids', 'the heart, spine and upper back', 'the intestines, spleen and digestive and nervous systems', 'the kidneys, lower back and skin', 'the reproductive organs, bladder and colon', 'the hips, thighs, liver and arteries', 'the knees, bones, joints, teeth and skin', 'the calves, ankles and circulation', 'the feet, lymphatic system and immunity'][s];
  }
  function healthCounsel(s) {
    return ['cooling foods, enough sleep and vigorous exercise to burn off heat; protect the head and avoid acting in haste.', 'moderation with sweets and rich food, care of the throat in cold weather, and regular use of the voice.', 'breathing practices, fresh air, limits on screen time and a single focus at a time to calm the nerves.', 'eating in calm surroundings, a regular sleep schedule, time near water and avoidance of late heavy meals.', 'early morning sunlight, moderation with rich food, posture care for the spine and attention to blood pressure after forty.', 'simple freshly cooked food at regular times, an unhurried routine and the discipline of not worrying about what is not yet a problem.', 'generous hydration, limited salt and sugar, core strength for the lower back and beautiful, orderly surroundings.', 'regular detoxification, moderate diet, healthy outlets for intensity and attention to urinary and reproductive health.', 'walking and open-air sport, a light diet for the liver, weight management around the hips and avoidance of excess in all things.', 'warm oil massage for the joints, adequate calcium, gentle regular movement and the deliberate scheduling of rest and joy.', 'movement to keep circulation strong, warm oil massage of the legs, time in nature away from screens.', 'warm feet, immune support, careful dosing of medicines, sacred sleep and regular time near water.'][s];
  }

  function remedies(chart) {
    const P = chart.planets;
    const scored = A.PLANETS.map(n => ({ n, s: strengthScore(P[n]) })).sort((a, b) => a.s - b.s);
    const weak = scored.filter(x => x.s <= 5).map(x => x.n).slice(0, 3);
    const dashaLord = chart.currentDasha.maha.lord;
    const lagnaLord = chart.ascendant.lord;
    const picks = [...new Set([...weak, dashaLord])].slice(0, 4);
    let html = para(`Remedies in Jyotisha are not superstition; they are a method of consciously strengthening the planetary energies that are weak in your chart, through disciplined action (mantra), generosity (dana), devotion (upasana) and, where appropriate, gemstones. Below are the remedies indicated for your chart, chosen for the planets that most need support and for your current dasha lord.`);
    html += `<div class="remedy-grid">` + picks.map(n => {
      const r = I.REMEDY[n], p = P[n];
      const why = n === dashaLord ? `your current Mahadasha lord, whose period you are living through now` : `${p.dignity.toLowerCase()} in ${p.signName} in your ${ord(p.house)} house${p.combust ? ', and combust' : ''}`;
      return `<div class="remedy"><h4>${n} <span class="muted">(${I.PLANET[n].sanskrit})</span></h4><p class="muted small">Why: ${why}.</p>
        <ul><li><strong>Mantra:</strong> ${r.mantra}</li><li><strong>Day:</strong> ${r.day}</li><li><strong>Charity:</strong> ${r.charity}</li><li><strong>Practice:</strong> ${r.practice}</li>${['Saturn', 'Rahu', 'Ketu'].includes(n) ? `<li><strong>Gemstone:</strong> ${r.gem}. For this planet a gemstone is only worn after consulting an astrologer in person; the mantra and charity are safe for everyone.</li>` : `<li><strong>Gemstone (optional):</strong> ${r.gem}.</li>`}</ul></div>`;
    }).join('') + `</div>`;
    html += para(`<strong>Your life-stone:</strong> the gemstone of your Lagna lord ${lagnaLord} is ${I.REMEDY[lagnaLord].gem.split(',')[0]}. This is the one stone that is almost always safe and beneficial for a native, because it strengthens the body and the self. Wear it only if it is natural, untreated and of good clarity, and begin on the day and finger indicated.`);
    html += para(`<strong>A universal remedy for your chart:</strong> because your Moon sits in ${P.Moon.signName} in the nakshatra of ${P.Moon.nakshatra.name}, the chanting of its ruling planet ${P.Moon.nakshatra.lord}'s mantra, together with the ${I.LUCKY[P.Moon.nakshatra.lord].day} charity for that planet, steadies the mind in every period of life.`);
    return html;
  }

  function dashaSection(chart) {
    const D = chart.dasha, cur = chart.currentDasha, P = chart.planets;
    const birth = chart.jd;
    let rows = D.mahadashas.map(m => {
      const ageStart = ((m.start - birth) / 365.25).toFixed(1), ageEnd = ((m.end - birth) / 365.25).toFixed(1);
      const isCur = m === cur.maha;
      return `<tr class="${isCur ? 'current' : ''}"><td><strong>${m.lord}</strong>${isCur ? ' <span class="tag">Now</span>' : ''}</td><td>${fmtDate(m.start)}</td><td>${fmtDate(m.end)}</td><td>${ageStart} – ${ageEnd}</td></tr>`;
    }).join('');
    const antRows = cur.maha.antardashas.map(a => `<tr class="${a === cur.antar ? 'current' : ''}"><td>${cur.maha.lord} – ${a.lord}${a === cur.antar ? ' <span class="tag">Now</span>' : ''}</td><td>${fmtDate(Math.max(a.start, cur.maha.start))}</td><td>${fmtDate(a.end)}</td></tr>`).join('');
    const ml = P[cur.maha.lord], al = P[cur.antar.lord];
    let html = para(`The Vimshottari Dasha is the great timing system of Jyotisha, a 120-year cycle of planetary periods beginning from the lord of your Moon's nakshatra. You were born in ${D.nakshatra.name} nakshatra, ruled by ${D.nakshatra.lord}, with ${D.balanceYears.toFixed(1)} years of ${D.nakshatra.lord}'s period remaining at birth. Every Mahadasha (major period) activates the houses that planet rules and occupies in your chart, and the Antardashas (sub-periods) within it modify the flavour month by month.`);
    html += `<h3>Mahadasha timeline</h3><table class="ptable"><thead><tr><th>Mahadasha</th><th>From</th><th>To</th><th>Age</th></tr></thead><tbody>${rows}</tbody></table>`;
    html += `<h3>Your current period: ${cur.maha.lord} Mahadasha, ${cur.antar.lord} Antardasha</h3>`;
    html += para(I.DASHA[cur.maha.lord]);
    html += para(`In your chart specifically, ${cur.maha.lord} is ${strengthWord(strengthScore(ml))}: ${ml.dignity.toLowerCase()} in ${ml.signName}, in your ${ord(ml.house)} house${ml.lordOf.length ? `, ruling your ${ml.lordOf.map(ord).join(' and ')} house${ml.lordOf.length > 1 ? 's' : ''}` : ''}. This Mahadasha therefore activates ${I.HOUSE[ml.house].theme}${ml.lordOf.length ? `, together with ${ml.lordOf.map(h => I.HOUSE[h].theme).join(' and ')}` : ''}. ${ml.dignityScore >= 3 ? 'Because the period lord is well placed, this is a period that builds, and its challenges are the kind that leave you stronger.' : 'Because the period lord is under strain, this period teaches through friction; the remedies for this planet given later in this report are the most important ones for you right now.'}`);
    html += para(`The current Antardasha of ${cur.antar.lord} runs from ${fmtDate(Math.max(cur.antar.start, cur.maha.start))} to ${fmtDate(cur.antar.end)} and brings ${I.ANTAR_NATURE[cur.antar.lord]} into the foreground. ${cur.antar.lord} sits in your ${ord(al.house)} house in ${al.signName} (${al.dignity.toLowerCase()}), so the themes of ${I.HOUSE[al.house].theme} are especially active in these months. ${al.house === ml.house ? 'The Mahadasha and Antardasha lords share the same house, which concentrates the period\'s energy powerfully on that area of life.' : [6, 8, 12].includes(((al.house - ml.house + 12) % 12) + 1) ? 'The Antardasha lord is in a difficult relationship (6th, 8th or 12th) to the Mahadasha lord, which often marks a sub-period of adjustment, delays or hidden developments; patience is advised and decisions should be deliberate.' : [1, 5, 9, 4, 7, 10, 11].includes(((al.house - ml.house + 12) % 12) + 1) ? 'The Antardasha lord stands in a harmonious relationship to the Mahadasha lord, which makes this a productive sub-period in which initiatives taken now tend to bear fruit.' : 'The Antardasha lord stands in a neutral relationship to the Mahadasha lord, giving a mixed but workable sub-period.'}`);
    html += `<h4>Antardashas of the current Mahadasha</h4><table class="ptable compact"><thead><tr><th>Period</th><th>From</th><th>To</th></tr></thead><tbody>${antRows}</tbody></table>`;
    // next mahadasha
    const idx = D.mahadashas.indexOf(cur.maha);
    if (idx >= 0 && idx < D.mahadashas.length - 1) {
      const nx = D.mahadashas[idx + 1], np = P[nx.lord];
      html += para(`<strong>Looking ahead:</strong> your next Mahadasha, of ${nx.lord}, begins on ${fmtDate(nx.start)}. ${nx.lord} is ${strengthWord(strengthScore(np))} in your chart, sitting in your ${ord(np.house)} house, so that period will shift the focus of life toward ${I.HOUSE[np.house].theme}${np.lordOf.length ? ` and ${np.lordOf.map(h => I.HOUSE[h].theme).join(' and ')}` : ''}. ${I.DASHA[nx.lord].split('.').slice(0, 2).join('.')}.`);
    }
    return html;
  }

  function transitSection(chart) {
    const t = chart.transits, P = chart.planets;
    const now = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const satH = t.fromMoon.Saturn, jupH = t.fromMoon.Jupiter, rahH = t.fromMoon.Rahu;
    const satGood = [3, 6, 11].includes(satH), jupGood = [2, 5, 7, 9, 11].includes(jupH);
    let html = para(`Transits (gochara) are read primarily from your Moon sign, ${P.Moon.signName}. As of ${now}, Saturn transits ${A.SIGNS[t.signs.Saturn]}, Jupiter transits ${A.SIGNS[t.signs.Jupiter]}, and the Rahu–Ketu axis lies across ${A.SIGNS[t.signs.Rahu]} and ${A.SIGNS[t.signs.Ketu]}.`);
    // Sade sati
    const ss = {
      rising: `<strong>Sade Sati, first phase.</strong> Saturn is in the 12th house from your Moon, which begins the seven-and-a-half-year passage of Sade Sati. The first phase typically brings increased expenses, disturbed sleep, a sense of endings and the need to let go of what no longer serves. It is a preparation. Reduce commitments, clear debts and begin the Saturn remedies now; those who enter Sade Sati with discipline leave it with authority.`,
      peak: `<strong>Sade Sati, second and most intense phase.</strong> Saturn is transiting over your natal Moon. This is the heart of Sade Sati, a period of two and a half years in which the mind is tested, responsibilities multiply and life asks you to grow up in some fundamental way. Health, mother and emotional stability need care. It is not a period of ruin, as popular fear suggests, but of pressure that forges character; many natives achieve their most durable gains in exactly this phase. Saturday remedies, service to the elderly and the Hanuman Chalisa are your protection.`,
      setting: `<strong>Sade Sati, final phase.</strong> Saturn is in the 2nd house from your Moon, the closing phase of Sade Sati. Financial and family matters are tested, speech must be guarded, but the worst is behind you and the rewards of the past five years begin to appear. Complete what you began and do not start fresh debts. Relief and consolidation follow when Saturn moves on.`,
      dhaiya: `<strong>Shani Dhaiya.</strong> Saturn is in the ${ord(satH)} house from your Moon, a two-and-a-half-year minor Saturn period (Dhaiya or Kantaka Shani). It brings ${satH === 4 ? 'tests to domestic peace, property and mother\'s health, and a sense of restlessness at home' : 'sudden obstacles, health concerns and hidden pressures that demand resilience'}. Saturday remedies are advised.`,
      none: satGood ? `<strong>Saturn is favourable.</strong> Saturn transits the ${ord(satH)} house from your Moon, one of its three auspicious transit positions (3rd, 6th, 11th). This brings steady gains, victory over competitors, growth in income and the quiet consolidation of effort. Use this window to build what you want to last.` : `<strong>Saturn is neutral to mildly testing.</strong> Saturn transits the ${ord(satH)} house from your Moon, which is neither Sade Sati nor one of its favourable positions. Its effect is to slow and discipline the matters of ${I.HOUSE[satH].theme}; patience in that area is rewarded.`
    }[chart.sadeSati];
    html += para(ss);
    html += para(`<strong>Jupiter's transit.</strong> Jupiter moves through the ${ord(jupH)} house from your Moon. ${jupGood ? `This is one of Jupiter's auspicious transit positions, bringing grace to ${I.HOUSE[jupH].theme}: ${jupH === 2 ? 'wealth, family happiness and good speech' : jupH === 5 ? 'children, intelligence, romance and recognition for your creativity' : jupH === 7 ? 'marriage, partnerships and happy travel' : jupH === 9 ? 'fortune, faith, father, higher learning and long journeys' : 'gains, income, friendships and the fulfilment of long-held wishes'}. It also casts its benefic aspect on the ${ord(((jupH + 4) % 12) + 1)}, ${ord(((jupH + 6) % 12) + 1)} and ${ord(((jupH + 8) % 12) + 1)} houses from your Moon, extending protection there.` : `This is not one of Jupiter's classical favourable positions, so its blessings come more through the houses it aspects (the ${ord(((jupH + 4) % 12) + 1)}, ${ord(((jupH + 6) % 12) + 1)} and ${ord(((jupH + 8) % 12) + 1)} from your Moon) than through the house it occupies; in the matter of ${I.HOUSE[jupH].theme} it brings growth that requires effort, and sometimes over-expansion that calls for restraint.`} From your Lagna, Jupiter is in the ${ord(t.fromLagna.Jupiter)} house, which supports ${I.HOUSE[t.fromLagna.Jupiter].theme}.`);
    html += para(`<strong>The Rahu–Ketu axis.</strong> Rahu transits the ${ord(rahH)} house from your Moon and Ketu the ${ord(t.fromMoon.Ketu)}. Rahu amplifies desire and sudden developments in ${I.HOUSE[rahH].theme}, while Ketu brings detachment, endings or spiritual insight into ${I.HOUSE[t.fromMoon.Ketu].theme}. ${[3, 6, 10, 11].includes(rahH) ? 'Rahu in an upachaya house is a growth transit: ambition is rewarded, especially in unconventional or technological ventures.' : [1, 7].includes(rahH) ? 'Rahu on the Moon–7th axis stirs relationships and self-image; avoid impulsive commitments and guard against people who are not what they seem.' : 'Treat the Rahu house as the area where you should act with extra discernment this year, because illusion is strongest there.'}`);
    html += para(`<strong>The year ahead, in summary.</strong> Combining your ${chart.currentDasha.maha.lord}–${chart.currentDasha.antar.lord} dasha period with the current transits, the themes most alive for you in the coming twelve months are ${[I.HOUSE[P[chart.currentDasha.maha.lord].house].theme, I.HOUSE[P[chart.currentDasha.antar.lord].house].theme, I.HOUSE[jupH].theme].filter((v, i, a) => a.indexOf(v) === i).join('; ')}. ${satGood || jupGood ? 'With at least one great planet transiting favourably, this is a year to act with confidence in the areas it blesses.' : 'With neither Saturn nor Jupiter in a classically favourable transit, this is a year to consolidate rather than expand, to complete rather than begin, and to invest in health, relationships and spiritual practice, which repay you in the years that follow.'}`);
    return html;
  }


  /* ---------- Plain-language life story ---------- */
  const PLAIN_PLANET = { Sun: 'confidence, father and recognition', Moon: 'peace of mind, mother and feelings', Mars: 'energy, courage and property', Mercury: 'intelligence, speech, studies and business', Jupiter: 'luck, wisdom, teachers and money', Venus: 'love, comfort, marriage and enjoyment', Saturn: 'hard work, patience and delays', Rahu: 'big ambitions, sudden changes and new paths', Ketu: 'letting go, confusion and inner growth' };
  const PLAIN_HOUSE = [null, 'your health and personality', 'money and family', 'courage, siblings and your own efforts', 'home, mother and studies', 'studies, children, love and creativity', 'work, competition and health', 'relationships, marriage and partnerships', 'sudden changes and hidden problems', 'luck, father and higher learning', 'career and reputation', 'income, friends and gains', 'expenses, far-away places and rest'];
  function saturnNote(jdMid, moonSign) {
    const T = (jdMid - 2451545.0) / 36525;
    // cheap: reuse engine by computing a chart at that instant
    const d = A.jdToDate(jdMid);
    const t = A.computeChart({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: 12, minute: 0, tzOffsetHours: 0, lat: 20, lon: 78 });
    const h = A.houseFrom(t.planets.Saturn.sign, moonSign);
    if ([12, 1, 2].includes(h)) return ' Sade Sati (Saturn passing over your Moon) was also running, so pressure, responsibilities or family worries were higher than usual.';
    if ([4, 8].includes(h)) return ' Saturn was in a testing position, adding obstacles and slowing things down.';
    if ([3, 6, 11].includes(h)) return ' Saturn was in a helpful position, quietly supporting steady gains.';
    return '';
  }
  function plainSection(chart, user) {
    const P = chart.planets, nowJD = chart.transits.jd, birth = chart.jd;
    const age = (jd) => ((jd - birth) / 365.25);
    const ageNow = age(nowJD);
    const good = (n) => strengthScore(P[n]) >= 7;
    const sorted = A.PLANETS.map(n => ({ n, s: strengthScore(P[n]) })).sort((a, b) => b.s - a.s);
    const strong = sorted.filter(x => x.s >= 8).slice(0, 3).map(x => x.n), weak = sorted.filter(x => x.s <= 5).map(x => x.n);
    const first = user.name.split(' ')[0];
    let html = para(`${esc(first)}, this part of your report is written the way a well-wisher would speak to you across a table, without technical words. Astrology works with time periods: each planet gets its turn to run your life for some years, and inside each big period there are smaller ones. By looking at which planet was in charge and where it sits in your chart, we can say what each phase of your life was about, what is happening now, and what is coming.`);

    // who you are
    html += `<h3>Who you are, in simple words</h3>`;
    html += para(`On the outside you come across as ${plainLagna(chart.ascendant.sign)}. Inside, your mind works like ${plainMoon(P.Moon.sign)}. The strongest planets in your chart are ${strong.length ? strong.join(', ') : sorted[0].n}, which means ${strong.length ? strong.map(n => PLAIN_PLANET[n]).join('; ') : PLAIN_PLANET[sorted[0].n]} come naturally to you. ${weak.length ? `The planets that need your attention are ${weak.join(' and ')}, so ${weak.map(n => PLAIN_PLANET[n]).join(' and ')} are the areas where life asks you to put in conscious effort.` : 'No planet in your chart is seriously weak, which is a real blessing.'}`);

    html += `<h3>Your good points</h3><ul>`;
    for (const n of (strong.length ? strong : [sorted[0].n]).slice(0, 4)) html += `<li><strong>${n} is strong</strong> (in ${P[n].signName}, ${ord(P[n].house)} house): ${plainStrong(n, P[n].house)}</li>`;
    if (chart.yogas.length) html += `<li><strong>Special combinations:</strong> ${chart.yogas.map(y => plainYoga(y)).join(' ')}</li>`;
    if (!chart.mangalDosha && !chart.mangalDoshaFromMoon) html += `<li><strong>No Mangal Dosha:</strong> there is no Mars-related obstacle to marriage in your chart.</li>`;
    html += `</ul><h3>Things to be careful about</h3><ul>`;
    for (const n of weak.slice(0, 3)) html += `<li><strong>${n} needs support</strong> (in ${P[n].signName}, ${ord(P[n].house)} house): ${plainWeak(n, P[n].house)}</li>`;
    if (chart.mangalDosha || chart.mangalDoshaFromMoon) html += `<li><strong>Mangal Dosha is present:</strong> marriage needs a patient, compatible partner; matching charts before marriage is wise.</li>`;
    if (!weak.length) html += `<li>Nothing major. Your main risk is over-confidence, so keep listening to honest advice.</li>`;
    html += `</ul>`;

    // life so far
    html += `<h3>Your life so far, period by period</h3>`;
    html += para(`You were born in the period of ${chart.dasha.nakshatra.lord}. Here is what each phase of your life was about. Think back and you will find these match the broad pattern of what happened, even if the details differ.`);
    html += `<div class="timeline">`;
    let childEnd = null;
    for (const m of chart.dasha.mahadashas) {
      if (m.start > nowJD) break;
      for (const a of m.antardashas) {
        const s = Math.max(a.start, m.start); if (s > nowJD) break;
        const e = a.end; const a0 = age(s), a1 = age(Math.min(e, nowJD));
        if (a1 <= 5) { childEnd = e; continue; }
        if (childEnd !== null) {
          html += `<div class="tl-item"><div class="tl-when">${fmtDate(birth)} – ${fmtDate(childEnd)}<span>age 0–${Math.ceil(age(childEnd))}</span></div><div class="tl-text">Early childhood, in the period of ${chart.dasha.nakshatra.lord}. These years reflect mainly on your parents and home: ${PLAIN_HOUSE[P[chart.dasha.nakshatra.lord].house]} were in focus for the family${[12, 1, 2].includes(A.houseFrom(chart.planets.Saturn.sign, P.Moon.sign)) ? '' : ''}.${saturnNote((birth + childEnd) / 2, P.Moon.sign)}</div></div>`;
          childEnd = null;
        }
        if (a1 - a0 < 0.25 && e < nowJD) continue;
        const lord = a.lord, lp = P[lord], isNow = e >= nowJD;
        let txt = `${m.lord}–${lord} time, about ${PLAIN_PLANET[lord]}. The focus ${isNow ? 'is' : 'was'} on ${PLAIN_HOUSE[lp.house]}. `;
        if (lord === 'Ketu') txt += isNow ? 'Ketu periods bring endings, doubt and a search for meaning even when Ketu is well placed; something that was not meant to last is leaving, and this clears the way for what comes next.' : 'Something ended or lost its meaning in this phase, and you grew wiser for it.';
        else if (lord === 'Rahu') txt += isNow ? 'Rahu periods bring big ambitions, sudden changes and some confusion; keep your feet on the ground and avoid shortcuts.' : 'This phase brought sudden changes, big ambitions and probably some confusion about direction.';
        else txt += good(lord) ? (isNow ? 'This phase should mostly go well and bring growth.' : 'This phase mostly went well and brought growth.') : strengthScore(lp) <= 4 ? (isNow ? 'This phase tests you; things do not come easily and patience is needed.' : 'This was a phase that tested you; things did not come easily and you had to learn patience.') : (isNow ? 'This is a mixed phase with both progress and effort.' : 'This was a mixed phase with both progress and effort.');
        if (lord === m.lord) txt += ' Because the big period and the small period had the same planet, its effects were felt strongly.';
        if (!['Rahu', 'Ketu'].includes(lord) && [6, 8, 12].includes(((lp.house - P[m.lord].house + 12) % 12) + 1)) txt += isNow ? ' A change of direction or a setback is likely in this phase; it will make sense later.' : ' There was likely a change of direction, a loss or a setback in this phase that later made sense.';
        let sn = saturnNote((s + Math.min(e, nowJD)) / 2, P.Moon.sign); if (isNow) sn = sn.replace('was also running', 'is also running').replace('were higher', 'are higher').replace('was in', 'is in');
        txt += sn;
        if (isNow) txt = '<strong>This is the phase you are in now.</strong> ' + txt;
        html += `<div class="tl-item"><div class="tl-when">${fmtDate(s)} – ${fmtDate(e)}<span>age ${Math.floor(a0)}–${Math.ceil(age(e))}</span></div><div class="tl-text">${txt}</div></div>`;
      }
    }
    html += `</div>`;

    // now
    const cm = chart.currentDasha.maha, ca = chart.currentDasha.antar, ml = P[cm.lord], al = P[ca.lord];
    html += `<h3>Where you are right now</h3>`;
    html += para(`You are ${Math.floor(ageNow)} years old and living in the big period of ${cm.lord} (${fmtDate(cm.start)} to ${fmtDate(cm.end)}) and the smaller period of ${ca.lord} (until ${fmtDate(ca.end)}). In plain words, ${cm.lord} is about ${PLAIN_PLANET[cm.lord]} and in your chart it is sitting in the area of ${PLAIN_HOUSE[ml.house]}. ${ca.lord} is about ${PLAIN_PLANET[ca.lord]} and sits in the area of ${PLAIN_HOUSE[al.house]}. So right now life is mostly about ${PLAIN_HOUSE[ml.house]} and ${PLAIN_HOUSE[al.house]}.`);
    const ss = { rising: 'Saturn has just begun its seven-and-a-half-year passage over your Moon (Sade Sati). The first part brings extra expenses and the feeling that something is ending. Do not panic; reduce commitments and clear debts.', peak: 'You are in the middle, most intense part of Sade Sati. Life feels heavier, responsibilities are more, and results come slowly. This is not bad luck; it is a training period. People who keep working honestly through it come out much stronger.', setting: 'You are in the last part of Sade Sati. The hardest part is behind you. Finish what you started and avoid new loans; relief is close.', dhaiya: 'Saturn is in a testing position from your Moon for about two and a half years. Expect delays, some health or home worries and a feeling of being stuck. It passes.', none: [3, 6, 11].includes(chart.transits.fromMoon.Saturn) ? 'Saturn is in a helpful position right now, which quietly supports steady progress and wins over competitors.' : 'Saturn is in a neutral position, neither blocking nor pushing you.' }[chart.sadeSati];
    const jh = chart.transits.fromMoon.Jupiter;
    html += para(`${ss} Jupiter, the planet of luck, is ${[2, 5, 7, 9, 11].includes(jh) ? `in a lucky position for you this year, helping with ${PLAIN_HOUSE[jh]}` : `not in one of its best positions this year, so luck in ${PLAIN_HOUSE[jh]} needs effort rather than arriving on its own`}. ${ca.lord === 'Ketu' ? `Ketu's small period is a clearing-out time: expect some confusion about direction and the ending of something that no longer fits. It is temporary and ends on ${fmtDate(ca.end)}, and what follows is a fresh start.` : ca.lord === 'Rahu' ? `Rahu's small period pushes ambition and brings sudden changes; stay grounded and avoid shortcuts. It ends on ${fmtDate(ca.end)}.` : good(ca.lord) ? `Because ${ca.lord} is strong in your chart, this small period should feel better than the one before it.` : `Because ${ca.lord} is not strong in your chart, this small period can feel confusing or slow; it is temporary and ends on ${fmtDate(ca.end)}.`}`);

    // future
    html += `<h3>What is coming</h3><div class="timeline">`;
    let count = 0;
    for (const m of chart.dasha.mahadashas) {
      if (m.end <= nowJD) continue;
      for (const a of m.antardashas) {
        if (a.end <= nowJD || a === chart.currentDasha.antar) continue;
        if (count++ >= 7) break;
        const s = Math.max(a.start, m.start, nowJD), lp = P[a.lord];
        const isNewMaha = m.start > nowJD && a === m.antardashas[0];
        let txt = `${m.lord}–${a.lord} time. ${isNewMaha ? `<strong>A new big period of ${m.lord} begins.</strong> ${plainMahaStart(m.lord, P[m.lord].house)} ` : ''}Focus shifts to ${PLAIN_HOUSE[lp.house]}. ${good(a.lord) ? 'Expect progress and good news in these matters.' : 'Go slowly and carefully in these matters; avoid big risks.'}`;
        txt += saturnNote((s + a.end) / 2, P.Moon.sign).replace('was', 'will be').replace('were', 'will be');
        html += `<div class="tl-item"><div class="tl-when">${fmtDate(s)} – ${fmtDate(a.end)}<span>age ${Math.floor(age(s))}–${Math.ceil(age(a.end))}</span></div><div class="tl-text">${txt}</div></div>`;
      }
      if (count >= 7) break;
    }
    html += `</div>`;
    const nextGood = sorted.filter(x => x.s >= 8 && !['Rahu', 'Ketu'].includes(x.n)).slice(0, 3).map(x => x.n);
    const upcoming = chart.dasha.mahadashas.filter(m => m.start > nowJD).slice(0, 3);
    html += para(`<strong>The bigger picture:</strong> ${upcoming.map(m => `your ${m.lord} period (${fmtDate(m.start).slice(-4)} to ${fmtDate(m.end).slice(-4)}, age ${Math.floor(age(m.start))} to ${Math.floor(age(m.end))}) will be ${good(m.lord) ? 'a strong, rewarding time' : 'a time of learning and effort'} centred on ${PLAIN_HOUSE[P[m.lord].house]}`).join('; ')}. ${nextGood.length ? `The periods of ${nextGood.join(' and ')} are the ones in which your biggest achievements are likely.` : ''}`);

    // simple help
    const picks = [...new Set([...weak, cm.lord])].slice(0, 3);
    html += `<h3>Simple things that help you</h3><ul>`;
    for (const n of picks) html += `<li><strong>For ${n}:</strong> ${I.REMEDY[n].practice}. ${I.REMEDY[n].charity}.</li>`;
    html += `<li><strong>Every day:</strong> ${plainDaily(chart.ascendant.sign)}</li></ul>`;
    html += para(`Remember: a chart shows the weather, not the destination. Good periods reward effort many times over, and difficult periods are shorter and lighter for those who stay disciplined, honest and kind. You have more good in this chart than you may realise.`);
    return html;
  }
  function plainLagna(s) { return ['someone active, quick and brave who likes to lead', 'someone calm, steady and reliable who values comfort and loyalty', 'someone talkative, clever and curious who adapts easily', 'someone caring, sensitive and family-minded', 'someone confident, warm and dignified who likes respect', 'someone careful, practical and helpful who notices details', 'someone charming, fair and sociable who dislikes conflict', 'someone intense, private and determined', 'someone honest, optimistic and freedom-loving', 'someone serious, hardworking and responsible', 'someone original, friendly and independent-minded', 'someone gentle, imaginative and kind-hearted'][s]; }
  function plainMoon(s) { return ['a quick fire: you feel strongly and act fast, and you forgive fast', 'a steady river: you feel deeply, slowly, and you do not easily let go', 'a busy mind: you think about feelings more than you feel them, and you need conversation', 'a tide: moods come and go, memory is long, and family means everything', 'a king\'s heart: proud, generous, warm, and hurt by disrespect', 'a careful planner: you worry, you help, and you expect a lot of yourself', 'a balance: you want peace and fairness and feel incomplete without a close partner', 'deep water: you feel everything intensely, trust slowly and never forget', 'an open sky: hopeful, honest and in need of freedom', 'a mountain: controlled, dutiful and slow to show feelings', 'a wide view: you care about people in general and need friendship more than romance', 'an ocean: you absorb everyone\'s feelings and need quiet to recover'][s]; }
  function plainStrong(n, h) {
    const base = { Sun: 'you have natural confidence and people see you as a leader; your father or an authority figure plays a strong role.', Moon: 'your mind is stable and people like you; your mother is a blessing in your life.', Mars: 'you have energy, courage and the ability to fight for what you want; property comes to you.', Mercury: 'you are intelligent, good with words, numbers and business, and you learn fast.', Jupiter: 'luck protects you, teachers help you, and money and wisdom grow with age.', Venus: 'love, comfort, good taste and a happy married life are well supported.', Saturn: 'you can work harder and longer than others, and what you build lasts.', Rahu: 'you have big ambitions and can succeed in new, modern or foreign fields.', Ketu: 'you have natural intuition and can let go of what does not matter.' }[n];
    return base + ` This strength shows up most in ${PLAIN_HOUSE[h]}.`;
  }
  function plainWeak(n, h) {
    const base = { Sun: 'confidence may come and go, and your relationship with father or bosses may need work; respect yourself first.', Moon: 'peace of mind needs protecting; avoid over-thinking and keep a regular sleep routine.', Mars: 'energy and courage need to be built; avoid anger and hasty decisions.', Mercury: 'be extra careful with paperwork, speech and business decisions; think before you speak.', Jupiter: 'luck has to be earned and good advisors must be chosen carefully; respect teachers and give on Thursdays.', Venus: 'love and relationships need patience and honesty; avoid excess spending and indulgence.', Saturn: 'delays and hard work are part of your story; patience is the only way through.', Rahu: 'beware of shortcuts, illusions and people who promise too much.', Ketu: 'confusion about direction can appear; meditation and a mentor help.' }[n];
    return base + ` This shows up mainly in ${PLAIN_HOUSE[h]}.`;
  }
  function plainYoga(y) {
    return { 'Gajakesari': 'Jupiter and Moon are well placed together, which gives respect, intelligence and protection in life.', 'Budhaditya': 'Sun and Mercury together give a sharp mind and skill with words.', 'Chandra-Mangala': 'Moon and Mars together give the ability to earn through courage and enterprise.', 'Kemadruma': 'The Moon stands alone, which can bring loneliness at times; building close friendships is important.', 'Ruchaka': 'Mars is exceptionally strong, giving courage and leadership.', 'Bhadra': 'Mercury is exceptionally strong, giving intelligence, communication skill and business sense.', 'Hamsa': 'Jupiter is exceptionally strong, giving wisdom, luck and respect.', 'Malavya': 'Venus is exceptionally strong, giving charm, comfort and a happy love life.', 'Shasha': 'Saturn is exceptionally strong, giving authority and lasting success through discipline.', 'Raja Yoga': 'A royal combination promises rise in status and authority.', 'Dhana Yoga': 'A wealth combination promises money through more than one source.', 'Viparita Raja Yoga': 'You gain from situations where others lose; crises turn into opportunities.', 'Neecha Bhanga Raja Yoga': 'A weakness in your chart turns into a strength after early struggle.', 'Amala': 'Your reputation stays clean and respected.', 'Saraswati': 'A learning combination gives excellent intelligence and skill in knowledge fields.' }[y] || '';
  }
  function plainMahaStart(n, h) {
    return { Sun: 'For six years life asks you to stand up, be seen and take responsibility. Career, recognition and your father\'s matters come forward.', Moon: 'For ten years life becomes more emotional and more public: home, mother, travel and popularity come forward.', Mars: 'For seven years energy rises: property, competition, courage and some conflicts come forward.', Mercury: 'For seventeen years intelligence, business, communication and learning lead the way.', Jupiter: 'For sixteen years wisdom, children, money and good fortune expand; this is usually a golden stretch.', Venus: 'For twenty years love, marriage, comfort and enjoyment lead the way.', Saturn: 'For nineteen years hard work and patience are the theme; slow but permanent results.', Rahu: 'For eighteen years ambition and big changes lead; great success is possible but keep your feet on the ground.', Ketu: 'For seven years life simplifies; what is not needed falls away and inner growth begins.' }[n] + ` In your chart this planet sits in the area of ${PLAIN_HOUSE[h]}, so that is where the action will be.`;
  }
  function plainDaily(s) { return ['Take three breaths before reacting; exercise daily.', 'Walk daily and keep sweets in check.', 'Sleep on time and keep your phone away for an hour each day.', 'Eat on time in a calm place; spend time near water.', 'Get early morning sunlight and keep your back straight.', 'Eat simple fresh food and stop worrying about problems that have not come.', 'Drink enough water and keep your room tidy.', 'Find a healthy outlet for your intensity: sport, art or prayer.', 'Walk in the open air and avoid excess in food and promises.', 'Oil your joints, rest deliberately and smile more.', 'Move your body daily and spend time in nature.', 'Keep your feet warm, protect your sleep and set clear limits with people.'][s]; }

  /* ---------- Main ---------- */
  function build(chart, user) {
    const P = chart.planets, asc = chart.ascendant, moon = P.Moon;
    const lagna = I.LAGNA[asc.signName];
    const nak = I.NAKSHATRA[moon.nakshatra.name];
    const la = lifeAreas(chart);
    const birthStr = `${String(chart.input.day).padStart(2, '0')}/${String(chart.input.month).padStart(2, '0')}/${chart.input.year} at ${String(chart.input.hour).padStart(2, '0')}:${String(chart.input.minute).padStart(2, '0')}, ${esc(user.place)}`;
    const sunNak = I.NAKSHATRA[P.Sun.nakshatra.name];

    const sections = [];

    // Cover
    sections.push(`<section class="rsec cover" id="cover">
      <span class="kicker">Janma Kundli · Complete Vedic Analysis</span>
      <h1>${esc(user.name)}</h1>
      <p class="cover-sub">Born ${birthStr}</p>
      <div class="cover-grid">
        <div><span>Lagna (Ascendant)</span><strong>${asc.signName} <em>${asc.signSanskrit}</em></strong><small>${asc.degFmt} · lord ${asc.lord}</small></div>
        <div><span>Rashi (Moon sign)</span><strong>${moon.signName} <em>${moon.signSanskrit}</em></strong><small>${moon.degFmt}</small></div>
        <div><span>Janma Nakshatra</span><strong>${moon.nakshatra.name}</strong><small>Pada ${moon.nakshatra.pada} · lord ${moon.nakshatra.lord}</small></div>
        <div><span>Sun sign (sidereal)</span><strong>${P.Sun.signName}</strong><small>${P.Sun.nakshatra.name} nakshatra</small></div>
        <div><span>Current Dasha</span><strong>${chart.currentDasha.maha.lord} – ${chart.currentDasha.antar.lord}</strong><small>until ${fmtDate(chart.currentDasha.antar.end)}</small></div>
        <div><span>Ayanamsa</span><strong>Lahiri</strong><small>${chart.ayanamsa.toFixed(3)}°</small></div>
      </div>
      <p class="cover-note">Prepared in the Parashari tradition using sidereal (Nirayana) positions, whole-sign houses and the Vimshottari dasha system. Read this slowly, over several sittings; a horoscope is a map of tendencies, and you are the traveller.</p>
    </section>`);

    // Chart
    sections.push(sec('chart', 'Your Birth Chart', 'Janma Kundli',
      `<div class="chart-wrap">${chartSVG(chart)}<div><p>This is your Rashi chart in the North Indian style. The top-centre house is your Lagna, the 1st house, with the number of its sign (1 = Aries … 12 = Pisces). Houses proceed anticlockwise. The planets are shown by their abbreviations; ℞ marks a retrograde planet.</p>${planetTable(chart)}<h4>Planetary strength at a glance</h4>${strengthBars(chart)}<p class="muted small">Strength here combines zodiacal dignity, house placement and combustion. It is a guide to which planets carry you and which need support.</p></div></div>`));

    // Lagna
    sections.push(sec('lagna', `${asc.signName} Lagna: ${lagna.essence}`, 'Your Self, Body and Life Path',
      lagna.body.map(para).join('') +
      para(`Your Lagna rises at ${asc.degFmt} of ${asc.signName}, in the nakshatra of ${asc.nakshatra.name}. ${asc.degFmt.startsWith('0°') || asc.degFmt.startsWith('1°') || asc.degFmt.startsWith('28°') || asc.degFmt.startsWith('29°') ? 'Because the Lagna is very close to a sign boundary, the qualities of the neighbouring sign also colour your personality, and an exact birth time matters a great deal for fine judgements.' : 'The Lagna degree is comfortably within the sign, so the qualities described above apply fully.'} Your Lagna lord ${asc.lord} is placed in your ${ord(P[asc.lord].house)} house in ${P[asc.lord].signName}, ${P[asc.lord].dignity.toLowerCase()}. ${relationText(1, P[asc.lord].house)} This single placement tells us where your life energy naturally flows: toward ${I.HOUSE[P[asc.lord].house].theme}.`) +
      (chart.houses[0].planets.length ? para(`Planets in your Lagna shape your personality directly. ${chart.houses[0].planets.map(p => I.PLANET_HOUSE[p][1]).join(' ')}`) : para('No planet occupies your Lagna, which means your personality is expressed cleanly through the sign itself and through the Lagna lord, without the colouring that occupant planets would add. People meet the sign first and the deeper planets later.'))));

    // Plain-language life story
    sections.push(sec('story', 'Your Life Story in Simple Words', 'Past · Present · Future, for everyone', plainSection(chart, user)));

    // Moon & mind
    sections.push(sec('moon', `The Mind: Moon in ${moon.signName}, ${moon.nakshatra.name} Nakshatra`, 'Chandra and Janma Nakshatra',
      para(`In Jyotisha the Moon is the mind (manas), and its sign and nakshatra are often more revealing of the inner person than the Sun sign of Western popular astrology. Your Moon is at ${moon.degFmt} ${moon.signName}, in your ${ord(moon.house)} house.`) +
      para(I.MOON_SIGN[moon.signName]) +
      para(`<strong>${moon.nakshatra.name}, pada ${moon.nakshatra.pada}.</strong> Deity: ${nak.deity}. Symbol: ${nak.symbol}. Ruling planet: ${moon.nakshatra.lord}. ${nak.text}`) +
      para(`The Moon's position in your ${ord(moon.house)} house means that your emotional life is most engaged with ${I.HOUSE[moon.house].theme}. ${I.PLANET_HOUSE.Moon[moon.house]}`) +
      para(`Your Sun, the soul (atma), is in ${P.Sun.signName} in the nakshatra of ${P.Sun.nakshatra.name}, whose deity is ${sunNak.deity}. ${sunNak.text.split('.').slice(0, 2).join('.')}. Where the Moon shows how you feel, the Sun shows what you are here to become, and the relationship between them, ${P.Sun.sign === moon.sign ? 'conjoined in the same sign (an Amavasya-type birth), gives a unified but intense inner life that benefits from outward expression' : `with the Moon ${ord(A.houseFrom(moon.sign, P.Sun.sign))} from the Sun, ` + ([1, 5, 9, 7, 3, 11].includes(A.houseFrom(moon.sign, P.Sun.sign)) ? 'is harmonious: heart and purpose pull in the same direction' : 'contains a creative tension: what you feel and what you must do are not always the same thing, and integrating them is a life task')}.`)));

    // Planets
    let planetsHtml = '';
    for (const name of A.PLANETS) {
      const p = P[name];
      planetsHtml += `<div class="planet-block"><h3>${name} <span class="muted">${I.PLANET[name].sanskrit} · karaka of ${I.PLANET[name].karaka}</span></h3>
        ${para(I.PLANET[name].nature)}
        ${para(planetCondition(p, chart))}
        ${para(I.PLANET_HOUSE[name][p.house])}
        ${para(`<em>Nakshatra influence:</em> ${name} in ${p.nakshatra.name} brings the quality of ${I.NAKSHATRA[p.nakshatra.name].symbol.toLowerCase()} and the deity ${I.NAKSHATRA[p.nakshatra.name].deity} into its expression. ${I.NAKSHATRA[p.nakshatra.name].text.split('.')[0]}.`)}
      </div>`;
    }
    sections.push(sec('planets', 'The Nine Grahas in Your Chart', 'Planet-by-Planet Analysis',
      para('Each planet is examined by its sign (dignity), its house (field of action), its nakshatra (inner quality) and its condition (retrograde, combust). Together these tell us not only what a planet promises, but how reliably and in which period it will deliver.') + planetsHtml));

    // Houses
    let housesHtml = '';
    chart.houses.forEach(h => {
      const lp = P[h.lord];
      housesHtml += `<div class="house-block"><h3>${ord(h.number)} House · ${I.HOUSE[h.number].name} <span class="muted">${h.signName}, lord ${h.lord}</span></h3>
        ${para(`This house governs ${I.HOUSE[h.number].keys}. In your chart it falls in ${h.signName}, a ${A.SIGN_ELEMENT[h.sign].toLowerCase()} sign, so these matters are approached ${signWorkStyle(h.sign)}.`)}
        ${para(`The lord, ${h.lord}, is placed in your ${ord(lp.house)} house in ${lp.signName} (${lp.dignity.toLowerCase()}). ${relationText(h.number, lp.house)}`)}
        ${h.planets.length ? para(`Occupants: ${h.planets.join(', ')}. ${h.planets.map(p => (BENEFICS.includes(p) ? `${p}, a natural benefic, generally protects and enriches this house.` : `${p}, a natural malefic, brings intensity and tests to this house, which can also mean drive and eventual mastery.`)).join(' ')}`) : para('No planet occupies this house. Its results come through the lord and through aspects; an empty house is not a weak house, merely a quieter one.')}
      </div>`;
    });
    sections.push(sec('houses', 'The Twelve Bhavas', 'House-by-House Reading', housesHtml));

    // Life areas
    const area = (title, kicker, arr) => `<div class="area"><h3>${title}</h3><span class="kicker">${kicker}</span>${arr.map(para).join('')}</div>`;
    sections.push(sec('life', 'Life Areas in Depth', 'Career · Wealth · Marriage · Health · Education · Family · Spirit',
      area('Career and Profession', 'Karma Bhava', la.career) +
      area('Wealth and Finances', 'Dhana and Labha Bhava', la.wealth) +
      area('Marriage and Relationships', 'Kalatra Bhava', la.marriage) +
      area('Health and Vitality', 'Tanu, Ripu and Ayur Bhava', la.health) +
      area('Education, Intelligence and Children', 'Vidya and Putra Bhava', la.edu) +
      area('Family, Home and Parents', 'Sukha, Sahaja and Pitru Bhava', la.family) +
      area('Dharma, Spirituality and the Soul\'s Direction', 'Dharma and Moksha Bhava', la.spirit)));

    // Yogas
    let yogaHtml = '';
    if (chart.yogas.length) {
      yogaHtml = chart.yogas.map(y => `<div class="yoga"><h3>${I.YOGA[y].title}</h3>${para(I.YOGA[y].text)}</div>`).join('');
    } else {
      yogaHtml = para('Your chart does not form any of the major named yogas in their strict classical definition. This is common and is not a weakness: the strength of your chart lies in the individual placements described above, and in the dasha periods that activate your well-placed planets.');
    }
    sections.push(sec('yogas', 'Yogas and Doshas', 'Special Planetary Combinations',
      para('Yogas are specific combinations of planets that the classical texts single out as producing distinctive results. They operate most strongly during the dasha periods of the planets that form them.') + yogaHtml));

    // Dasha
    sections.push(sec('dasha', 'Vimshottari Dasha: The Timing of Your Life', 'Planetary Periods', dashaSection(chart)));

    // Transits
    sections.push(sec('transits', 'Transits and the Year Ahead', 'Gochara', transitSection(chart)));

    // Remedies
    sections.push(sec('remedies', 'Remedies and Strengthening Measures', 'Upaya', remedies(chart)));

    // Lucky
    const ll = I.LUCKY[asc.lord], lm = I.LUCKY[moon.nakshatra.lord];
    sections.push(sec('lucky', 'Auspicious Factors', 'Colours, Numbers, Days and Directions',
      `<div class="lucky-grid">
        <div><span>Lucky colours</span><strong>${ll.colors}</strong><small>from your Lagna lord ${asc.lord}</small></div>
        <div><span>Lucky numbers</span><strong>${ll.numbers} · ${lm.numbers}</strong><small>Lagna lord and nakshatra lord</small></div>
        <div><span>Favourable days</span><strong>${ll.day}${lm.day !== ll.day ? ' and ' + lm.day : ''}</strong><small>begin important work on these</small></div>
        <div><span>Favourable direction</span><strong>${ll.direction}</strong><small>face this way for study and prayer</small></div>
        <div><span>Metal</span><strong>${ll.metal}</strong><small>for rings and vessels</small></div>
        <div><span>Ishta Devata hint</span><strong>${ishtaHint(chart)}</strong><small>from the strongest benefic influence</small></div>
      </div>`));

    // Closing
    sections.push(`<section class="rsec closing" id="closing">
      <span class="kicker">A Closing Word</span>
      <h2>Blessings on your path</h2>
      ${para(`${esc(user.name)}, your chart shows a ${asc.signName} soul with a ${moon.signName} heart, born under the star of ${moon.nakshatra.name}. ${A.PLANETS.map(n => ({ n, s: strengthScore(P[n]) })).sort((a, b) => b.s - a.s)[0].n} is the planet that carries you, and ${A.PLANETS.map(n => ({ n, s: strengthScore(P[n]) })).sort((a, b) => a.s - b.s)[0].n} is the planet that teaches you. Honour the first with gratitude and the second with discipline, and the map laid out above becomes a path rather than a prediction.`)}
      ${para('The planets incline; they do not compel. Every indication in this reading describes a tendency that free will, effort and grace can shape. Use the favourable periods to build, the testing periods to deepen, and the remedies to steady yourself in between. May the Navagrahas be kind to you.')}
      <p class="muted small">This report is generated from the birth details you supplied using classical Parashari principles and astronomical calculation. It is offered for guidance and self-reflection and is not a substitute for medical, legal or financial advice. Accuracy depends on the accuracy of the birth time; a difference of a few minutes can shift the Lagna when it is near a sign boundary.</p>
    </section>`);

    return sections.join('');
  }

  function ishtaHint(chart) {
    const P = chart.planets;
    const best = ['Jupiter', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu'].map(n => ({ n, s: strengthScore(P[n]) })).sort((a, b) => b.s - a.s)[0].n;
    return { Sun: 'Surya / Rama', Moon: 'Shiva / Parvati', Mars: 'Hanuman / Subrahmanya', Mercury: 'Vishnu / Krishna', Jupiter: 'Dakshinamurthy / Vishnu', Venus: 'Lakshmi / Durga', Saturn: 'Shani / Hanuman', Rahu: 'Durga / Bhairava', Ketu: 'Ganesha' }[best];
  }

  global.Report = { build, strengthScore };
})(typeof window !== 'undefined' ? window : globalThis);
