# BluePrint Prototype

A static, click-through HTML prototype of the BluePrint app (formerly AdVantage). Mocks the entire Spring backend so the wizard runs end-to-end without authentication, MongoDB, or Azure OpenAI.

## Run locally

```sh
cd prototype
python3 -m http.server 8000
# open http://localhost:8000
```

> `file://` will work for everything except the `Use Current Location` button — `navigator.geolocation` requires HTTPS or localhost.

## What's mocked

All `/blue-print/api/*` and `/blue-vue/api/*` endpoints are intercepted by `mocks.js`. Canned data lives at the top of that file — swap city / business / ad-image entries to retheme the demo.

The "AI-generated proofs" are two static SVG ad images in `images/`. Replace those files (keep the same filenames) to show category-specific samples.

## Demo path

1. Page loads with location pre-populated to "Clearwater, FL 33761"
2. Type a business name (try `tony`, `sun`, `verdant`, `oakwood`, `bluefin`, `palms`)
3. Pick from the dropdown → business details auto-fill
4. (Optional) add an offer expiration, upload a logo
5. Click **Find My Templates** → 1.4s "finding" animation → 2.2s "generating" animation
6. Two proof cards render with the mock ad images
7. Click a proof → modal opens with print/email/copy actions
8. Pick This Proof → confetti + "Great pick!" screen

## Dark mode

Toggle via the sun/moon icon in the toolbar (right side). Preference persists to `localStorage.bp_theme`. Vuetify's built-in `$vuetify.theme.dark` drives component theming; custom `bp-*` CSS responds via theme-aware CSS variables on `.theme--dark.v-application`.

The proof preview cards, the "Great pick!" card, and the print template are explicitly locked to a light palette in dark mode — they represent the physical printed product, so they always render light-on-white.

## File layout

```
prototype/
├── index.html              ← Vue/Vuetify app shell (no Thymeleaf)
├── blueprint.js            ← Vue instance + wizard logic
├── blueprint.css           ← CSS with theme-aware variables
├── mocks.js                ← Backend mocks (loads before blueprint.js)
├── favicon.svg             ← Blueprint mark
├── valpak-clipp-logo.png   ← Header logo
└── images/
    ├── mock-ad-pizza.svg   ← Category-related ad image (proof A)
    └── mock-ad-auto.svg    ← Category-related ad image (proof B)
```

External dependencies (loaded via CDN): Vue 2.7.16, Vuetify 2.7.2, axios 1.6.7, intro.js 7.2.0, Material Icons, MDI font, Inter / Roboto from Google Fonts.

## Known limitations

- Geolocation works only on HTTPS or localhost (not `file://`)
- Print preview shows real browser print chrome
- The "Email to Client" dialog completes successfully but no email is sent
- Saved share links resolve to `#proof/demo` (no actual proof rendering — would require additional mocking)
