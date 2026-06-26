import { $, $$ } from './utils.js'

export function updateListCounts () {
  $$('.list').forEach(list => {
    const visible = $$('.card:not(.search-hidden)', list).length
    const countEl = list.querySelector('.list-count')
    if (countEl) countEl.textContent = String(visible)
  })
}

export function initSearch () {
  const input = $('#search-input')
  if (!input) return

  input.addEventListener('input', () => filterCards(input.value.trim().toLowerCase()))

  document.addEventListener('keydown', e => {
    if (e.key === '/' && !isTyping()) {
      e.preventDefault()
      input.focus()
    }
  })
}

function isTyping () {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

function filterCards (query) {
  $$('.list').forEach(list => {
    let visibleCount = 0
    const cards = $$('.card', list)

    cards.forEach(card => {
      if (!query) {
        card.classList.remove('search-hidden', 'search-dim')
        visibleCount++
        return
      }

      const name = card.querySelector('.card-name')?.textContent.toLowerCase() || ''
      const desc = card.querySelector('.card-description')?.textContent.toLowerCase() || ''
      const matches = name.includes(query) || desc.includes(query)

      card.classList.toggle('search-hidden', !matches)
      card.classList.remove('search-dim')
      if (matches) visibleCount++
    })

    const countEl = list.querySelector('.list-count')
    if (countEl) countEl.textContent = String(visibleCount)

    let emptyMsg = list.querySelector('.list-empty-search')
    if (query && visibleCount === 0) {
      if (!emptyMsg) {
        emptyMsg = document.createElement('div')
        emptyMsg.className = 'list-empty-search'
        list.querySelector('.cards')?.appendChild(emptyMsg)
      }
      emptyMsg.textContent = 'No matching cards'
      emptyMsg.hidden = false
    } else if (emptyMsg) {
      emptyMsg.remove()
    }
  })
}
