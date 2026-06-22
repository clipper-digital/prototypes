var vm = new Vue({
  el: '#app',
  vuetify: new Vuetify({ theme: { dark: localStorage.getItem('bp_theme') === 'dark' } }),
  data: () => ({
    authUser: authUser,
    defaultWarmCopy: "I created this with your business in mind — and I think it could be a great fit. I'd love to walk you through it, answer any questions, and help get your first mailing on the calendar. No pressure at all.",
    snackbar: false,
    genError: false,
    lat: 28.045,
    lon: -82.732,
    userLocation: 'Clearwater, FL 33761',
    locationItems: ['Clearwater, FL 33761'],
    locationQuery: '',
    locationTimer: null,
    geoLoading: false,
    geoFail: false,
    geoTimer: null,
    detailsUnlocked: false,
    step: 'form',
    form: { businessName: '', address: '', phone: '', website: '', offer: '', hours: '', category: '' },
    query: '',
    selectedPlace: null,
    suggestions: [],
    searching: false,
    searchTerm: '',
    findingItems: [],
    proofs: [],
    selected: null,
    dialogOpen: false,
    dialogProof: null,
    emailDialog: false,
    clientEmail: '',
    emailSending: false,
    emailSent: false,
    confetti: [],
    searchTimer: null,
    logo: null,
    logoName: '',
    repNameEdit: '',
    repEmailEdit: '',
    warmCopyEdit: '',
    printDialog: false,
    profileSaved: false,
    copyLinkLabel: 'Copy Link',
    copyLinkPending: false,
    linkCopied: false
  }),
  mounted() {
    // Prototype: location is pre-populated; skip the auto-geolocation prompt on page load.
    // The "Use Current Location" button still works for users who want to grant permission.
    const saved = JSON.parse(localStorage.getItem('bp_rep_profile') || '{}')
    if (saved.repName)   this.repNameEdit  = saved.repName
    if (saved.repEmail)  this.repEmailEdit = saved.repEmail
    if (saved.warmCopy)  this.warmCopyEdit = saved.warmCopy
    if (!this.repNameEdit)  this.repNameEdit  = this.repName
    if (!this.repEmailEdit) this.repEmailEdit = this.authUser ? (this.authUser.emailAddr || '') : ''
  },
  computed: {
    inputBg() { return this.$vuetify.theme.dark ? '#1B2E4D' : 'white' },
    iconText() { return this.$vuetify.theme.dark ? '#CBD5E1' : '#475569' },
    iconMuted() { return this.$vuetify.theme.dark ? '#94A3B8' : '#64748B' },
    iconFaint() { return this.$vuetify.theme.dark ? '#64748B' : '#94A3B8' },
    locationSet() {
      return !!(this.userLocation && this.userLocation.trim().length > 0)
    },
    readyForDetails() {
      return this.locationSet && !!this.form.businessName
    },
    offerRules() {
      return [
        v => !v || /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/.test(v) || 'Use mm/dd/yyyy format',
        v => {
          if (!v || !/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return true
          const [m, d, y] = v.split('/').map(Number)
          const date = new Date(y, m - 1, d)
          if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return 'Not a real date'
          const tomorrow = new Date()
          tomorrow.setHours(0, 0, 0, 0)
          tomorrow.setDate(tomorrow.getDate() + 1)
          return date >= tomorrow || 'Expiration must be at least one day in the future'
        }
      ]
    },
    offerValid() {
      return this.offerRules.every(rule => rule(this.form.offer) === true)
    },
    repName() {
      if (!this.authUser) return ''
      if (this.authUser.fullName) return this.authUser.fullName
      const local = (this.authUser.emailAddr || '').split('@')[0]
      return local.split(/[._]/).map(p => p ? p[0].toUpperCase() + p.slice(1) : '').join(' ')
    },
    greeting() {
      const h = new Date().getHours()
      const period = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
      return `Good ${period}, ${this.repName.split(' ')[0]}`
    },
    greetingIcon() {
      const h = new Date().getHours()
      return h < 12 ? 'wb_twilight' : h < 18 ? 'wb_sunny' : 'bedtime'
    },
    mailto() {
      const name = this.form.businessName
      const proof = this.selected
      const repName = this.repName
      const sub = encodeURIComponent(`Spec Art Proof for ${name}`)
      const body = encodeURIComponent(
        `Hi,\n\nI put together a personalized Valpak Clipp ad proof for ${name}. Take a look and let me know what you think!\n\n` +
        (proof ? `Headline: ${proof.headline}\nOffer: ${proof.offerText}\n\n` : '') +
        `Ready to get started? Reply to this email or give me a call.\n\n${repName}`
      )
      return `mailto:?subject=${sub}&body=${body}`
    }
  },
  watch: {
    readyForDetails(val) {
      if (val) this.detailsUnlocked = true
    },
    userLocation(val, oldVal) {
      if (oldVal && val !== oldVal) {
        this.selectedPlace = null
        this.query = ''
        Object.assign(this.form, { businessName: '', address: '', phone: '', website: '', offer: '', hours: '', category: '' })
      }
    },
    locationQuery(val) {
      if (!val || val === this.userLocation) return
      clearTimeout(this.locationTimer)
      if (val.length >= 2) {
        this.locationTimer = setTimeout(() => this.locationSuggest(val), 300)
      }
    },
    selectedPlace(item) {
      if (item) {
        this.selectPlace(item)
      } else {
        this.form.businessName = ''
        this.form.category = ''
      }
    },
    query(val) {
      if (this.selectedPlace && val === this.selectedPlace.text) return
      this.form.category = ''
      this.searchTerm = val
      this.autocomplete(val)
    }
  },
  methods: {
    toggleTheme() {
      this.$vuetify.theme.dark = !this.$vuetify.theme.dark
      localStorage.setItem('bp_theme', this.$vuetify.theme.dark ? 'dark' : 'light')
    },
    autocomplete(val) {
      clearTimeout(this.searchTimer)
      if (!val || val.length < 3) {
        this.suggestions = []
        return
      }
      this.searching = true
      this.searchTimer = setTimeout(() => {
        axios.get(`/blue-print/api/autocomplete?term=${encodeURIComponent(val)}&lat=${this.lat}&lon=${this.lon}`)
          .then(({ data }) => {
            this.suggestions = data || []
          })
          .catch(() => { this.suggestions = [] })
          .finally(() => { this.searching = false })
      }, 300)
    },
    selectPlace(item) {
      if (!item) return
      const placeId = item.value || item
      axios.get(`/blue-print/api/place?placeId=${encodeURIComponent(placeId)}`)
        .then(({ data }) => {
          this.form.businessName = data.name || ''
          this.form.address = data.formatted_address || ''
          this.form.phone = this.formatPhone(data.international_phone_number || data.formatted_phone_number || '')
          this.form.website = (data.website || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
          this.form.category = this.categoryFromTypes(data.types || [])
          const weekdayText = data.opening_hours && data.opening_hours.weekday_text
          this.form.hours = weekdayText ? weekdayText.join('\n') : ''
        })
        .catch(err => {
          console.error('[BluePrint] place fetch error:', err.response?.status, err.message)
        })
    },
    formatPhone(raw) {
      const d = (raw || '').replace(/\D/g, '')
      if (d.length === 11 && d[0] === '1') return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
      if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
      return raw
    },
    categoryFromTypes(types) {
      const map = {
        // Dining / Food / Beverage
        restaurant: 'Sit Down Restaurants', food: 'Sit Down Restaurants',
        pizza_restaurant: 'Pizza Restaurants',
        cafe: 'Coffee & Tea Shops', coffee_shop: 'Coffee & Tea Shops',
        bakery: 'Bakeries',
        bar: 'Pubs / Bars', night_club: 'Pubs / Bars',
        meal_takeaway: 'Quick Serve', meal_delivery: 'Quick Serve', fast_food_restaurant: 'Quick Serve',
        hamburger_restaurant: 'Hamburger Restaurants',
        ice_cream_shop: 'Ice Cream / Yogurt Shops',
        grocery_or_supermarket: 'Grocery Stores', supermarket: 'Grocery Stores',
        convenience_store: 'Convenience Stores',
        liquor_store: 'Beer, Wine, Liquor',
        seafood_restaurant: 'Seafood Restaurants',
        mexican_restaurant: 'Mexican Restaurants',
        asian_restaurant: 'Asian Restaurants', chinese_restaurant: 'Asian Restaurants',
        japanese_restaurant: 'Asian Restaurants', thai_restaurant: 'Asian Restaurants',
        italian_restaurant: 'Italian Restaurants',
        steak_house: 'Steak Restaurants',
        barbecue_restaurant: 'Barbecue Restaurants',
        sandwich_shop: 'Sub Shops / Deli', deli: 'Sub Shops / Deli',
        smoothie_bar: 'Smoothie / Juice Bars', juice_bar: 'Smoothie / Juice Bars',
        market: 'Markets',
        // Auto / Transportation
        car_repair: 'Auto Repair',
        car_wash: 'Car Wash and Detail',
        car_dealer: 'Auto Dealers - Sales', used_car_dealer: 'Auto Dealers - Pre-owned',
        auto_parts_store: 'Auto Parts / Accessories',
        gas_station: 'Gas Stations',
        taxi_service: 'Bus / Limo / Taxi',
        car_rental: 'Auto Rental / Leasing',
        towing_service: 'Towing',
        parking: 'Parking Lots / Garages',
        tire_shop: 'Tire Dealers',
        // Health / Beauty / Fitness
        hair_care: 'Hair Salons', barber_shop: 'Hair Salons',
        beauty_salon: 'Other Beauty',
        gym: 'Fitness Centers', fitness_center: 'Fitness Centers',
        spa: 'Spas / Day Spas',
        nail_salon: 'Nail Salons',
        massage: 'Massage',
        tanning_salon: 'Tanning Salons',
        // Home / Garden
        plumber: 'Plumbing',
        electrician: 'Electricians',
        roofing_contractor: 'Roofing and Siding',
        contractor: 'Home Remodeling / Construction', general_contractor: 'Home Remodeling / Construction',
        flooring_store: 'Carpets and Flooring-Retail',
        moving_company: 'Movers',
        storage: 'Self Storage / Storage',
        landscaping: 'Lawn And Garden Maintenance', lawn_care: 'Lawn And Garden Maintenance',
        pest_control: 'Pest Control',
        heating_contractor: 'Heating / Air Conditioning', air_conditioning_contractor: 'Heating / Air Conditioning',
        cleaning_service: 'Maid Services / Commercial Cleaning',
        painter: 'Painting And Wallcovering Service',
        window_installation: 'Window / Glass / Door',
        locksmith: 'Handyman Services', handyman: 'Handyman Services',
        home_goods_store: 'Hardware Stores', hardware_store: 'Hardware Stores',
        pool_service: 'Pool / Spa Installation / Service',
        solar_energy: 'Solar Electric Power',
        carpet_cleaning: 'Carpet, Tile, and Upholstery Cleaning',
        // Medical
        dentist: 'Dentists', orthodontist: 'Dentists',
        doctor: 'Doctors, Hospitals And Medical Centers',
        hospital: 'Doctors, Hospitals And Medical Centers',
        medical_center: 'Doctors, Hospitals And Medical Centers',
        optician: 'Optical Stores / Optometrists', optometrist: 'Optical Stores / Optometrists',
        chiropractor: 'Chiropractors',
        pharmacy: 'Pharmacy / Drug Store',
        physiotherapist: 'Specialty Care',
        // General Services
        dry_cleaning: 'Dry Cleaners / Laundry', laundry: 'Dry Cleaners / Laundry',
        insurance_agency: 'Insurance',
        real_estate_agency: 'Realtors',
        bank: 'Banks / Credit Unions',
        accounting: 'Accountants / Tax Preparers',
        veterinary_care: 'Pet Care',
        pet_store: 'Pet Stores',
        lawyer: 'Legal Service',
        school: 'Schools-Public and Private',
        university: 'Universities And Colleges',
        child_care: 'Child Care',
        post_office: 'Mailing and Shipping',
        // Entertainment / Recreation
        golf_course: 'Golf',
        movie_theater: 'Movie Theaters',
        hotel: 'Lodging', lodging: 'Lodging',
        museum: 'Arts / Museums',
        martial_arts_school: 'Martial Arts',
        amusement_park: 'Entertainment',
        bowling_alley: 'Recreation',
        // Retail
        furniture_store: 'Furniture & Furnishings',
        shoe_store: 'Shoe Stores',
        jewelry_store: 'Jewelers',
        clothing_store: 'Clothing Sales',
        sporting_goods_store: 'Sporting Goods Stores',
        electronics_store: 'Appliance / Electronic Repair / Sales',
        book_store: 'Books / News / Print',
        toy_store: 'Toy Stores',
        florist: 'Florists',
        music_store: 'Music Stores and Lessons',
        photography_studio: 'Photography / Camera / Art',
        office_supply_store: 'Office Supply Stores',
      }
      for (const t of types) {
        if (map[t]) return map[t]
      }
      return ''
    },
    useCurrentLocation() {
      if (!navigator.geolocation) {
        this.geoFail = true
        return
      }
      this.geoLoading = true
      this.geoFail = false
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.lat = pos.coords.latitude
          this.lon = pos.coords.longitude
          this.reverseGeocode()
        },
        err => {
          console.error('[BluePrint] geolocation error:', err.code, err.message)
          this.geoLoading = false
          this.geoFail = true
        },
        { maximumAge: 60000, timeout: 10000 }
      )
    },
    locationSuggest(val) {
      axios.get(`/blue-print/api/location-suggest?term=${encodeURIComponent(val)}`)
        .then(({ data }) => { this.locationItems = data || [] })
        .catch(() => {})
    },
    geocodeLocation() {
      const loc = (this.userLocation || '').trim()
      if (loc.length < 2) return
      clearTimeout(this.geoTimer)
      this.geoTimer = setTimeout(() => {
        axios.get(`/blue-print/api/geocode?location=${encodeURIComponent(loc)}`)
          .then(({ data }) => {
            if (data.lat) this.lat = data.lat
            if (data.lon) this.lon = data.lon
            if (data.location) {
              this.userLocation = data.location
              if (!this.locationItems.includes(data.location)) {
                this.locationItems = [data.location, ...this.locationItems]
              }
            }
          })
          .catch(() => {})
      }, 400)
    },
    reverseGeocode() {
      axios.get(`/blue-print/api/reverse-geocode?lat=${this.lat}&lon=${this.lon}`)
        .then(({ data }) => {
          if (data.location) {
            this.userLocation = data.location
            this.locationItems = [data.location]
          } else {
            this.geoFail = true
          }
        })
        .catch(err => {
          console.error('[BluePrint] reverse-geocode error:', err.message)
          this.geoFail = true
        })
        .finally(() => { this.geoLoading = false })
    },
    submit() {
      if (!this.form.businessName) return
      this.step = 'finding'
      const category = this.form.category
      const adsTerm = category || this.searchTerm || this.form.businessName
      this.findingItems = [
        { label: category ? `Business type identified: ${category}` : `Searching by: ${adsTerm}`, done: false },
        { label: 'Searching 50,000+ Valpak Clipp templates...', done: false },
        { label: `Selected 2 best matches for ${this.form.businessName}`, done: false }
      ]
      setTimeout(() => { this.findingItems[0].done = true }, 400)
      setTimeout(() => { this.findingItems[1].done = true }, 1000)
      let templateUrls = []
      let apiDone = false
      axios.get(`/blue-vue/api/ads?term=${encodeURIComponent(adsTerm)}&searchType=fuzzy&offset=99999`)
        .then(({ data }) => {
          const cp44 = (data || []).filter(ad => ad.material === 'CP44' && ad.link)
          templateUrls = cp44.slice(0, 2).map(ad => ad.link)
        })
        .catch(() => {})
        .finally(() => {
          apiDone = true
        })
      setTimeout(() => {
        const finish = () => {
          this.findingItems[2].done = true
          setTimeout(() => {
            this.step = 'generating'
            window.scrollTo({ top: 0, behavior: 'smooth' })
            this.generate(templateUrls)
          }, 600)
        }
        if (apiDone) {
          finish()
        } else {
          const wait = setInterval(() => {
            if (apiDone) { clearInterval(wait); finish() }
          }, 100)
        }
      }, 1400)
    },
    generate(templateUrls) {
      const payload = {
        businessName: this.form.businessName,
        address: this.form.address,
        phone: this.form.phone,
        website: this.form.website,
        offer: this.form.offer,
        hours: this.form.hours,
        category: this.form.category || this.searchTerm || 'General',
        templateUrls: templateUrls.filter(u => u)
      }
      axios.post('/blue-print/api/generate', payload)
        .then(({ data }) => {
          let proofs = []
          if (data && Array.isArray(data.proofs)) {
            proofs = data.proofs
          } else if (typeof data === 'string') {
            const cleaned = data.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'').trim()
            try { proofs = JSON.parse(cleaned).proofs || [] } catch (e) { proofs = [] }
          }
          if (!proofs.length) {
            this.step = 'form'
            this.genError = true
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return
          }
          this.proofs = proofs.map((p, i) => ({ ...p, templateUrl: templateUrls[i] || '' }))
          this.step = 'proofs'
          window.scrollTo({ top: 0, behavior: 'smooth' })
        })
        .catch(() => {
          this.step = 'form'
          this.genError = true
          window.scrollTo({ top: 0, behavior: 'smooth' })
        })
    },
    openDialog(proof) {
      this.dialogProof = proof
      this.dialogOpen = true
    },
    pickProof(proof) {
      this.dialogOpen = false
      this.selected = proof
      this.step = 'selected'
      const colors = ['#F59E0B', '#003087', '#EA580C', '#10B981', '#0066CC']
      this.confetti = Array.from({ length: 30 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        dur: 2 + Math.random() * 1.5,
        color: colors[i % colors.length],
        size: 6 + Math.random() * 8,
        round: Math.random() > 0.5
      }))
    },
    reset() {
      this.step = 'form'
      this.form = { businessName: '', address: '', phone: '', website: '', offer: '', hours: '', category: '' }
      this.query = ''
      this.searchTerm = ''
      this.selectedPlace = null
      this.suggestions = []
      this.proofs = []
      this.selected = null
      this.dialogOpen = false
      this.dialogProof = null
      this.emailDialog = false
      this.clientEmail = ''
      this.emailSending = false
      this.emailSent = false
      this.confetti = []
      this.findingItems = []
      this.logo = null
      this.logoName = ''
      if (this.$refs.logoInput) this.$refs.logoInput.value = ''
    },
    copyLink() {
      if (!this.selected || this.copyLinkPending) return
      this.copyLinkPending = true
      const proof = this.selected
      const repName  = this.repNameEdit  || this.repName
      const repEmail = this.repEmailEdit || (this.authUser ? this.authUser.emailAddr : '')
      axios.post('/blue-print/api/save-proof', {
        businessName: this.form.businessName,
        headline:     proof.headline    || '',
        offerText:    proof.offerText   || '',
        finePrint:    proof.finePrint   || '',
        templateUrl:  proof.templateUrl || '',
        address:      this.form.address  || '',
        phone:        this.form.phone    || '',
        website:      this.form.website  || '',
        repName,
        repEmail,
        logoDataUrl:  this.logo || '',
        warmCopy:     this.warmCopyEdit || this.defaultWarmCopy
      })
        .then(({ data }) => {
          const url = data.url || ''
          if (navigator.clipboard && url) {
            navigator.clipboard.writeText(url).catch(() => {})
          }
          this.copyLinkLabel = 'Link Copied!'
          this.linkCopied = true
          setTimeout(() => {
            this.copyLinkLabel = 'Copy Link'
            this.copyLinkPending = false
          }, 2000)
        })
        .catch(() => {
          this.copyLinkPending = false
          this.genError = true
        })
    },
    openEmailDialog() {
      if (!this.warmCopyEdit) this.warmCopyEdit = this.defaultWarmCopy
      this.emailDialog = true
    },
    openPrintDialog() {
      if (!this.warmCopyEdit) this.warmCopyEdit = this.defaultWarmCopy
      this.printDialog = true
    },
    saveRepProfile() {
      localStorage.setItem('bp_rep_profile', JSON.stringify({
        repName:  this.repNameEdit,
        repEmail: this.repEmailEdit,
        warmCopy: this.warmCopyEdit
      }))
      this.profileSaved = true
    },
    confirmPrint() {
      this.printDialog = false
      this.$nextTick(() => window.print())
    },
    sendEmail() {
      if (!this.clientEmail || this.emailSending) return
      this.emailSending = true
      const proof = this.selected
      const repName  = this.repNameEdit  || this.repName
      const repEmail = this.repEmailEdit || (this.authUser ? this.authUser.emailAddr : '')
      axios.post('/blue-print/api/send-email', {
        clientEmail: this.clientEmail,
        repName, repEmail,
        businessName: this.form.businessName,
        address: this.form.address,
        phone: this.form.phone,
        website: this.form.website,
        headline: proof.headline || '',
        offerText: proof.offerText || '',
        finePrint: proof.finePrint || '',
        templateUrl: proof.templateUrl || '',
        logoDataUrl: this.logo || '',
        warmCopy: this.warmCopyEdit || this.defaultWarmCopy
      })
        .then(() => {
          this.emailSent = true
          this.emailDialog = false
          this.clientEmail = ''
        })
        .catch(() => { this.genError = true })
        .finally(() => { this.emailSending = false })
    },
    handleLogo(event) {
      const file = event.target.files[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        this.genError = true
        return
      }
      const reader = new FileReader()
      reader.onload = e => {
        this.logo = e.target.result
        this.logoName = file.name
      }
      reader.readAsDataURL(file)
    },
    clearLogo() {
      this.logo = null
      this.logoName = ''
      this.$refs.logoInput.value = ''
    },
    tour() {
      if (this.step !== 'form') return
      introJs().setOptions({
        steps: [
          {
            title: '✨ Welcome to BluePrint',
            intro: '<p>BluePrint constructs customized print ad mockups on the fly. This tour walks you through the 3-step process.</p>'
          },
          {
            title: 'Step 1 — Your Location',
            intro: '<p>Enter your location or tap <strong>Use Current Location</strong> to auto-detect it. This biases the business search toward your area.</p>',
            element: document.getElementById('bpLocationCard')
          },
          {
            title: 'Find the Business',
            intro: "<p>Search for your client's Google Business listing. Contact details auto-fill from Google Places.</p>",
            element: document.getElementById('bpBusinessSearch')
          },
          {
            title: 'Review Contact Details',
            intro: '<p>Confirm or adjust the pre-filled address, phone, and website. These appear on the proof.</p>',
            element: document.getElementById('bpContactFields')
          },
          {
            title: 'Upload a Logo (optional)',
            intro: "<p>Drag and drop or click to upload the client's logo. It appears on the proof and in the email.</p>",
            element: document.getElementById('bpLogoUpload')
          },
          {
            title: "Offer Expiration Date",
            intro: '<p>Enter the offer expiration date. This appears in the fine print and offer callout on the proof.</p>',
            element: document.getElementById('bpOfferField')
          },
          {
            title: 'Generate Your Proofs',
            intro: "<p>Click to let BluePrint find matching templates and write personalized copy. You'll get two proof options to choose from.</p>",
            element: document.getElementById('bpGenerateBtn')
          }
        ]
      }).start()
    },
    print() {
      window.print()
    }
  }
})
