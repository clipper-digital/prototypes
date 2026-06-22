// BluePrint prototype mocks
// Intercepts the same endpoints the real Spring controller exposes
// and returns canned data so the wizard runs end-to-end with no backend.
(function () {
  if (typeof axios === 'undefined') {
    console.error('[BluePrint Mock] axios not loaded — mocks cannot install')
    return
  }

  const originalGet = axios.get.bind(axios)
  const originalPost = axios.post.bind(axios)

  const cities = [
    { city: 'Clearwater', state: 'FL', lat: 28.045, lon: -82.732 },
    { city: 'Tampa', state: 'FL', lat: 27.951, lon: -82.456 },
    { city: 'St. Petersburg', state: 'FL', lat: 27.767, lon: -82.640 },
    { city: 'Orlando', state: 'FL', lat: 28.538, lon: -81.379 },
    { city: 'Miami', state: 'FL', lat: 25.762, lon: -80.192 },
    { city: 'Atlanta', state: 'GA', lat: 33.749, lon: -84.388 },
    { city: 'Charlotte', state: 'NC', lat: 35.227, lon: -80.843 },
    { city: 'Nashville', state: 'TN', lat: 36.162, lon: -86.781 },
    { city: 'New York', state: 'NY', lat: 40.713, lon: -74.006 },
    { city: 'Chicago', state: 'IL', lat: 41.878, lon: -87.629 }
  ]
  const zips = {
    '33761': { city: 'Clearwater', state: 'FL', lat: 28.045, lon: -82.732 },
    '33756': { city: 'Clearwater', state: 'FL', lat: 27.953, lon: -82.768 },
    '33602': { city: 'Tampa',      state: 'FL', lat: 27.953, lon: -82.457 },
    '10001': { city: 'New York',   state: 'NY', lat: 40.748, lon: -73.997 },
    '60601': { city: 'Chicago',    state: 'IL', lat: 41.886, lon: -87.622 }
  }
  const businesses = [
    { id: 'tony',     name: "Tony's Pizza",              address: "320 Main St, Clearwater, FL 33756",         phone: "(727) 555-1234", website: "tonyspizza.com",      types: ['pizza_restaurant'],   hours: "Mon-Thurs: 11am-11pm\nFri-Sat: 11am-1am\nSun: 11am-11pm" },
    { id: 'sunshine', name: "Sunshine Auto Care",        address: "1450 Gulf-to-Bay Blvd, Clearwater, FL 33755", phone: "(727) 555-2200", website: "sunshineautocare.com", types: ['car_repair'],         hours: "Mon-Fri: 8am-6pm\nSat: 8am-4pm" },
    { id: 'verdant',  name: "Verdant Yoga Studio",       address: "210 Cleveland St, Clearwater, FL 33755",     phone: "(727) 555-3456", website: "verdantyoga.com",      types: ['gym'],                hours: "Mon-Sun: 6am-9pm" },
    { id: 'oakwood',  name: "Oakwood Family Dentistry",  address: "2700 NE Coachman Rd, Clearwater, FL 33765",  phone: "(727) 555-4500", website: "oakwooddentists.com",  types: ['dentist'],            hours: "Mon-Fri: 8am-5pm" },
    { id: 'bluefin',  name: "Bluefin Seafood Grill",     address: "501 S Fort Harrison Ave, Clearwater, FL 33756", phone: "(727) 555-7878", website: "bluefingrill.com",     types: ['seafood_restaurant'], hours: "Lunch & Dinner Daily" },
    { id: 'palms',    name: "Palms Florist",             address: "1230 Court St, Clearwater, FL 33756",        phone: "(727) 555-9090", website: "palmsflorist.com",     types: ['florist'],            hours: "Mon-Sat: 9am-6pm" }
  ]

  function delay(ms, fn) {
    return new Promise(resolve => setTimeout(() => resolve(fn()), ms))
  }
  function parseQuery(url) {
    const q = {}
    const qs = url.split('?')[1]
    if (!qs) return q
    qs.split('&').forEach(kv => {
      const eq = kv.indexOf('=')
      const k = eq < 0 ? kv : kv.slice(0, eq)
      const v = eq < 0 ? '' : kv.slice(eq + 1)
      q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '))
    })
    return q
  }

  axios.get = function (url, ...rest) {
    if (url.includes('/blue-print/api/location-suggest')) {
      const q = parseQuery(url)
      const term = (q.term || '').trim().toLowerCase()
      return delay(180, () => {
        let items = []
        if (/^\d{3,5}$/.test(term)) {
          const z = zips[term]
          if (z) items = [`${z.city}, ${z.state} ${term}`]
        } else if (term) {
          items = cities
            .filter(c => c.city.toLowerCase().startsWith(term))
            .map(c => `${c.city}, ${c.state}`)
        }
        return { data: items }
      })
    }
    if (url.includes('/blue-print/api/geocode')) {
      const q = parseQuery(url)
      const loc = (q.location || '').trim()
      return delay(180, () => {
        const zMatch = loc.match(/\b(\d{5})\b/)
        if (zMatch && zips[zMatch[1]]) {
          const z = zips[zMatch[1]]
          return { data: { lat: z.lat, lon: z.lon, location: `${z.city}, ${z.state} ${zMatch[1]}` } }
        }
        const c = cities.find(c => loc.toLowerCase().includes(c.city.toLowerCase()))
        if (c) return { data: { lat: c.lat, lon: c.lon, location: `${c.city}, ${c.state}` } }
        return { data: { lat: 28.045, lon: -82.732, location: 'Clearwater, FL 33761' } }
      })
    }
    if (url.includes('/blue-print/api/reverse-geocode')) {
      return delay(220, () => ({ data: { location: 'Clearwater, FL 33761' } }))
    }
    if (url.includes('/blue-print/api/autocomplete')) {
      const q = parseQuery(url)
      const term = (q.term || '').trim().toLowerCase()
      return delay(280, () => {
        if (!term) return { data: [] }
        const matches = businesses
          .filter(b => b.name.toLowerCase().includes(term))
          .slice(0, 6)
          .map(b => ({ text: b.name + ' · ' + b.address, value: b.id }))
        return { data: matches }
      })
    }
    if (url.includes('/blue-print/api/place')) {
      const q = parseQuery(url)
      const id = q.placeId
      return delay(250, () => {
        const b = businesses.find(x => x.id === id)
        if (!b) return { data: {} }
        return {
          data: {
            name: b.name,
            formatted_address: b.address,
            formatted_phone_number: b.phone,
            international_phone_number: '+1 ' + b.phone,
            website: 'https://' + b.website,
            types: b.types,
            opening_hours: { weekday_text: b.hours.split('\n') }
          }
        }
      })
    }
    // /blue-vue/api/ads — used by submit() to fetch CP44 template URLs
    if (url.includes('/blue-vue/api/ads')) {
      return delay(400, () => ({
        data: [
          { material: 'CP44', link: 'images/mock-ad-pizza.svg' },
          { material: 'CP44', link: 'images/mock-ad-auto.svg' }
        ]
      }))
    }
    return originalGet(url, ...rest)
  }

  axios.post = function (url, body, ...rest) {
    if (url.includes('/blue-print/api/generate')) {
      const templateUrls = (body && body.templateUrls) || ['images/mock-ad-pizza.svg', 'images/mock-ad-auto.svg']
      return delay(2200, () => ({
        data: {
          proofs: templateUrls.slice(0, 2).map(u => ({
            templateUrl: u,
            html: `<img src="${u}" alt="Sample ad" style="width:100%;display:block;" />`,
            headline: '',
            subheadline: '',
            offerText: '',
            finePrint: ''
          }))
        }
      }))
    }
    if (url.includes('/blue-print/api/save-proof')) {
      return delay(400, () => ({
        data: { url: location.origin + location.pathname + '#proof/demo' }
      }))
    }
    if (url.includes('/blue-print/api/send-email')) {
      return delay(800, () => ({ data: {} }))
    }
    return originalPost(url, body, ...rest)
  }

  console.log('[BluePrint] prototype mocks installed')
})()
