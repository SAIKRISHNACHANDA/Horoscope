# JyotishVeda — Vedic Horoscope Generator Landing Page (₹499)

A complete, dependency-free static site that sells a deep, personalised Vedic horoscope report for ₹499.
Everything runs in the visitor's browser: planetary positions are computed with built-in astronomical
algorithms, and a 13-section report is composed in the voice of a senior Jyotishi.

## Features

- **Astronomy engine** (`js/astro.js`): Sun, Moon, Mercury–Saturn, Rahu/Ketu (mean node), Lagna, Lahiri ayanamsa,
  whole-sign houses, nakshatra + pada, dignity (exalted/own/friend/neutral/enemy/debilitated), retrograde,
  combustion, Vimshottari Mahadasha + Antardasha, current transits, Sade Sati / Dhaiya, and yoga detection
  (Gajakesari, Budhaditya, Chandra-Mangala, Kemadruma, Pancha Mahapurusha, Raja, Dhana, Viparita Raja,
  Neecha Bhanga, Amala, Saraswati, Mangal Dosha).
- **Interpretation library** (`js/interpretations.js`): 12 Lagna essays, 12 Moon signs, 27 Nakshatras,
  108 planet-in-house readings, 12 houses, 9 Dasha periods, yogas, remedies, lucky factors.
- **Report composer** (`js/report.js`): cover, North-Indian chart SVG, planetary table and strength bars,
  Lagna, Moon/Nakshatra, planet-by-planet, house-by-house, 7 life areas (career, wealth, marriage with
  Mangal Dosha, health, education/children, family, spirituality), yogas, Dasha timeline with current
  period analysis, transits and year ahead, remedies, auspicious factors, closing. Print-friendly.
- **Landing page** (`index.html`): hero with form, features, how-it-works, sample excerpt, pricing,
  testimonials, FAQ, free preview paywall, payment modal.
- **City database** (`js/cities.js`): 150+ Indian and world cities with coordinates and UTC offsets,
  plus manual coordinate entry.

## Go-live checklist

Edit `js/config.js`:

| Key | What to do |
| --- | --- |
| `razorpayKeyId` | Paste your Razorpay Key ID to enable card/UPI/netbanking checkout. Payment success unlocks the report instantly. |
| `upiId` | Your UPI VPA. Used as a fallback: a deep link opens the user's UPI app with ₹499 pre-filled, and the user enters the UTR to unlock. |
| `whatsapp` | Support number with country code (e.g. `919876543210`). |
| `demoUnlock` | **Set to `false` before launch.** When `true`, a "Continue in test mode" button bypasses payment. |
| `price` / `originalPrice` | Shown everywhere on the page. |

> The UPI fallback trusts the user's entered reference (there is no server to verify it). For verified
> payments use Razorpay, or add a small backend that checks the payment ID before unlocking.

## Run locally

Any static server works:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Deploy to GitHub Pages, Netlify, Vercel or any static host by uploading the folder.

## Accuracy notes

Positions use Meeus-style series for the Sun and Moon and JPL approximate Keplerian elements for the
planets, giving a few arc-minutes for Sun/Moon and roughly 0.1–0.3° for planets. Ayanamsa is Lahiri.
This is sufficient for sign, house, nakshatra and dasha determination; for research-grade work use a
Swiss Ephemeris backend.
