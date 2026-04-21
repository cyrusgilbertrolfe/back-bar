/* Choose Six box builder — mfc.london/products/boxset
 * Vanilla JS widget. Fetches drink list + presets from this Next.js app,
 * renders the picker, and adds the £20 boxset to cart with
 * line-item properties Drink 1 ... Drink 6 describing the customer's pick.
 *
 * Mount point (added in the Shopify theme):
 *   <div id="mfc-c6-root"
 *        data-variant-id="1318197166091"
 *        data-price-pence="2000"
 *        data-data-url="https://mfc-batch-calculator.vercel.app/api/choose-six/drinks"></div>
 */
(function () {
  'use strict'

  var ROOT_ID = 'mfc-c6-root'
  var SLOT_COUNT = 6
  var FALLBACK_DATA_URL = 'https://mfc-batch-calculator.vercel.app/api/choose-six/drinks'

  document.addEventListener('DOMContentLoaded', init)

  function init() {
    var root = document.getElementById(ROOT_ID)
    if (!root) return

    var variantId = root.dataset.variantId
    var pricePence = parseInt(root.dataset.pricePence || '2000', 10)
    var dataUrl = root.dataset.dataUrl || FALLBACK_DATA_URL

    document.body.classList.add('mfc-c6-active')

    var state = {
      drinks: [],
      byHandle: {},
      presets: [],
      slots: new Array(SLOT_COUNT).fill(null), // array of handles (string) or null
      activeSlot: null,
      activePresetId: null,
      variantId: variantId,
      pricePence: pricePence,
      submitting: false,
    }

    render(root, state) // initial skeleton

    fetch(dataUrl, { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then(function (data) {
        state.drinks = data.drinks || []
        state.presets = data.presets || []
        state.byHandle = {}
        state.drinks.forEach(function (d) { state.byHandle[d.handle] = d })
        render(root, state)
      })
      .catch(function (err) {
        console.error('[choose-six]', err)
        root.innerHTML = '<div class="mfc-c6"><div class="mfc-c6__error">We couldn’t load the drinks picker. Please refresh the page, or drop us a note at cocktails@myattsfields.london.</div></div>'
      })

    // Event delegation on the root — rebuilt on every render, so rebind each time.
    function onClick(e) {
      var t = e.target
      var presetBtn = t.closest ? t.closest('[data-preset]') : null
      if (presetBtn) { applyPreset(state, presetBtn.getAttribute('data-preset')); render(root, state); return }
      var slotBtn = t.closest ? t.closest('[data-slot]') : null
      var removeBtn = t.closest ? t.closest('[data-slot-remove]') : null
      if (removeBtn) {
        e.stopPropagation()
        var idx = parseInt(removeBtn.getAttribute('data-slot-remove'), 10)
        state.slots[idx] = null
        state.activePresetId = null
        render(root, state)
        return
      }
      if (slotBtn) {
        openPicker(state, parseInt(slotBtn.getAttribute('data-slot'), 10))
        render(root, state)
        return
      }
      var cardBtn = t.closest ? t.closest('[data-drink]') : null
      if (cardBtn) {
        pickDrink(state, cardBtn.getAttribute('data-drink'))
        render(root, state)
        return
      }
      var clearBtn = t.closest ? t.closest('[data-clear]') : null
      if (clearBtn) {
        state.slots = new Array(SLOT_COUNT).fill(null)
        state.activePresetId = null
        render(root, state)
        return
      }
      var ctaBtn = t.closest ? t.closest('[data-add-to-cart]') : null
      if (ctaBtn) { addToCart(state, root); return }
      var closeBtn = t.closest ? t.closest('[data-close-picker]') : null
      var backdrop = t.closest ? t.closest('[data-picker-backdrop]') : null
      if (closeBtn || (backdrop && t === backdrop)) {
        state.activeSlot = null
        render(root, state)
        return
      }
    }

    root.addEventListener('click', onClick)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.activeSlot !== null) {
        state.activeSlot = null
        render(root, state)
      }
    })
  }

  function applyPreset(state, id) {
    var preset = state.presets.find(function (p) { return p.id === id })
    if (!preset) return
    state.slots = preset.drinks.slice(0, SLOT_COUNT)
    state.activePresetId = id
    state.activeSlot = null
  }

  function openPicker(state, idx) {
    state.activeSlot = idx
  }

  function pickDrink(state, handle) {
    var idx = state.activeSlot
    if (idx === null || idx === undefined) return
    state.slots[idx] = handle
    state.activePresetId = null
    // advance to next empty
    var next = -1
    for (var i = 1; i <= SLOT_COUNT; i++) {
      var j = (idx + i) % SLOT_COUNT
      if (!state.slots[j]) { next = j; break }
    }
    state.activeSlot = next >= 0 ? next : null
  }

  function addToCart(state, root) {
    if (state.slots.filter(Boolean).length !== SLOT_COUNT || state.submitting) return
    state.submitting = true
    render(root, state)

    var properties = {}
    state.slots.forEach(function (handle, i) {
      var drink = state.byHandle[handle]
      properties['Drink ' + (i + 1)] = drink ? drink.name : handle
    })

    // Gift-card line-item properties — only attach if the customer actually
    // picked a card (the mfc-gc widget always seeds `_Gift card=Yes` at load
    // but leaves the design empty until a choice is made).
    if (state.parentForm) {
      var design = state.parentForm.querySelector('input[name="properties[_Gift card design]"]')
      if (design && design.value) {
        properties['_Gift card'] = 'Yes'
        properties['_Gift card design'] = design.value
        var message = state.parentForm.querySelector('input[name="properties[_Gift card message]"]')
        if (message && message.value) {
          properties['_Gift card message'] = message.value
        }
      }
    }

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        items: [{
          id: parseInt(state.variantId, 10),
          quantity: 1,
          properties: properties,
        }],
      }),
    })
      .then(function (r) { if (!r.ok) return r.json().then(function (e) { throw e }); return r.json() })
      .then(function () {
        // If the theme exposes a cart-drawer open hook, use it; otherwise go to /cart.
        if (typeof window.routes !== 'undefined' && typeof window.openCartDrawer === 'function') {
          window.openCartDrawer()
        } else {
          // Fire a PUB-SUB event some Dawn-based themes listen on, then navigate.
          try { document.dispatchEvent(new CustomEvent('cart:refresh')) } catch (e) {}
          window.location.href = '/cart'
        }
      })
      .catch(function (err) {
        console.error('[choose-six] add to cart failed', err)
        state.submitting = false
        state.errorMessage = (err && (err.description || err.message)) || 'Something went wrong. Please try again.'
        render(root, state)
      })
  }

  /* -------- RENDERING -------- */

  function render(root, state) {
    var chosen = state.slots.filter(Boolean).length
    var ready = chosen === SLOT_COUNT

    var html = ''
    html += '<div class="mfc-c6">'
    html += renderIntro()
    html += renderPresets(state)
    html += renderProgress(chosen)
    html += renderSlots(state)
    html += renderCta(state, ready)
    html += renderModal(state)
    if (state.errorMessage) html += '<div class="mfc-c6__error" style="margin-top:1rem;">' + escape(state.errorMessage) + '</div>'
    html += '</div>'

    root.innerHTML = html
    relocateGiftCard(state, root)
  }

  // Move the theme's gift-card widget (rendered inside the now-hidden product
  // form on the boxset page) into our slot so customers can add a card
  // alongside Choose Six. The theme script binds handlers by element ID, so
  // re-parenting doesn't break its behaviour; we re-run after every render
  // because the outer innerHTML rewrite orphans the slot on each pass.
  function relocateGiftCard(state, root) {
    var slot = root.querySelector('.mfc-c6__giftcard-slot')
    if (!slot) return
    if (!state.giftCardWrap) {
      var wrap = document.querySelector('.mfc-gc-wrap')
      if (wrap) {
        state.giftCardWrap = wrap
        state.parentForm = wrap.closest('form')
      }
    }
    if (state.giftCardWrap && state.giftCardWrap.parentElement !== slot) {
      slot.appendChild(state.giftCardWrap)
    }
  }

  function renderIntro() {
    return (
      '<header class="mfc-c6__intro">' +
      '<p class="mfc-c6__eyebrow">The Choose Six box</p>' +
      '<h1 class="mfc-c6__title">Build a box of six</h1>' +
      '<p class="mfc-c6__lede">Six 50ml minis, any mix, £20. Start with a set we’ve curated, or build your own from the range.</p>' +
      '</header>'
    )
  }

  function renderPresets(state) {
    if (!state.presets.length) return ''
    var html = '<div class="mfc-c6__presets">'
    state.presets.forEach(function (p) {
      var active = state.activePresetId === p.id ? 'true' : 'false'
      html +=
        '<button type="button" class="mfc-c6__preset" data-preset="' + escape(p.id) + '" data-active="' + active + '">' +
        '<span class="mfc-c6__preset-label">' + escape(p.label) + '</span>' +
        '<span class="mfc-c6__preset-tagline">' + escape(p.tagline) + '</span>' +
        '</button>'
    })
    html +=
      '<button type="button" class="mfc-c6__preset" data-clear>' +
      '<span class="mfc-c6__preset-label">Build your own</span>' +
      '<span class="mfc-c6__preset-tagline">Pick six yourself.</span>' +
      '</button>'
    html += '</div>'
    return html
  }

  function renderProgress(chosen) {
    return (
      '<div class="mfc-c6__progress">' +
      '<p class="mfc-c6__progress-title">Your six</p>' +
      '<p class="mfc-c6__progress-count"><strong>' + chosen + '</strong> of 6 chosen</p>' +
      '</div>'
    )
  }

  function renderSlots(state) {
    var html = '<div class="mfc-c6__slots">'
    for (var i = 0; i < SLOT_COUNT; i++) {
      var handle = state.slots[i]
      var drink = handle ? state.byHandle[handle] : null
      var filled = drink ? 'true' : 'false'
      var active = state.activeSlot === i ? 'true' : 'false'
      html +=
        '<button type="button" class="mfc-c6__slot" data-slot="' + i + '" data-filled="' + filled + '" data-active="' + active + '">' +
        '<span class="mfc-c6__slot-number">' + pad(i + 1) + '</span>'
      if (drink) {
        html +=
          '<span class="mfc-c6__slot-image"><img src="' + escape(drink.image) + '" alt="" loading="lazy"></span>' +
          '<span class="mfc-c6__slot-name">' + escape(drink.name) + '</span>' +
          '<button type="button" class="mfc-c6__slot-remove" data-slot-remove="' + i + '" aria-label="Remove">×</button>'
      } else {
        html +=
          '<span class="mfc-c6__slot-image"><span class="mfc-c6__slot-empty">Pick one</span></span>' +
          '<span class="mfc-c6__slot-name" style="color:var(--mfc-c6-muted);">Slot ' + (i + 1) + '</span>'
      }
      html += '</button>'
    }
    html += '</div>'
    return html
  }

  function renderCta(state, ready) {
    var pricePounds = (state.pricePence / 100).toFixed(2)
    var label = state.submitting ? 'Adding…' :
                ready ? 'Add six minis to cart — £' + pricePounds :
                'Choose ' + (SLOT_COUNT - state.slots.filter(Boolean).length) + ' more to continue'
    var disabled = ready && !state.submitting ? '' : 'disabled'
    return (
      '<div class="mfc-c6__giftcard-slot"></div>' +
      '<div class="mfc-c6__cta-row">' +
      '<button type="button" class="mfc-c6__cta" data-add-to-cart ' + disabled + '>' + escape(label) + '</button>' +
      '<button type="button" class="mfc-c6__clear" data-clear>Clear</button>' +
      '</div>'
    )
  }

  function renderModal(state) {
    if (state.activeSlot === null || state.activeSlot === undefined) return ''
    var slotNum = state.activeSlot + 1
    var html =
      '<div class="mfc-c6-modal" data-open="true" data-picker-backdrop>' +
      '<div class="mfc-c6-modal__panel" role="dialog" aria-label="Pick a drink">' +
      '<div class="mfc-c6-modal__head">' +
      '<div><span class="mfc-c6-modal__title">Slot ' + slotNum + '</span><span class="mfc-c6-modal__sub">Choose a mini</span></div>' +
      '<button type="button" class="mfc-c6-modal__close" data-close-picker aria-label="Close">×</button>' +
      '</div>' +
      '<div class="mfc-c6-modal__grid">'
    state.drinks.forEach(function (d) {
      html +=
        '<button type="button" class="mfc-c6-card" data-drink="' + escape(d.handle) + '">' +
        '<span class="mfc-c6-card__image"><img src="' + escape(d.image) + '" alt="" loading="lazy"></span>' +
        '<span class="mfc-c6-card__body">' +
        '<h3 class="mfc-c6-card__name">' + escape(d.name) + '</h3>' +
        '<p class="mfc-c6-card__tagline">' + escape(d.tagline) + '</p>' +
        '</span>' +
        '</button>'
    })
    html += '</div></div></div>'
    return html
  }

  function pad(n) { return n < 10 ? '0' + n : String(n) }
  function escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
})()
