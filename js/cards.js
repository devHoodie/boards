import { $, DESCRIPTION_PLACEHOLDER } from './utils.js'
import { saveState } from './state.js'
import { openModal } from './ui/modal.js'
import { renderModalTagPicker, refreshModalTags } from './tags.js'

export function updateChecklistBadge (card) {
  let badge = card.querySelector('.checklist-badge')
  const checklist = card.dataset.checklist ? JSON.parse(card.dataset.checklist) : []
  const total = checklist.length
  const done = checklist.filter(i => i.checked).length

  if (total === 0) {
    badge?.remove()
    return
  }

  if (!badge) {
    badge = document.createElement('span')
    badge.className = 'checklist-badge'
    const meta = card.querySelector('.card-meta') || createCardMeta(card)
    meta.prepend(badge)
  }

  badge.textContent = `${done}/${total}`
  badge.classList.toggle('complete', done === total && total > 0)
}

function createCardMeta (card) {
  let meta = card.querySelector('.card-meta')
  if (!meta) {
    meta = document.createElement('div')
    meta.className = 'card-meta'
    const footer = card.querySelector('.card-footer')
    footer?.appendChild(meta)
  }
  return meta
}

export function createCard (listElement, text, description = '', meta = {}) {
  const card = document.createElement('div')
  card.className = 'card'
  card.draggable = true
  card.dataset.cardId = meta.id || crypto.randomUUID()
  card.dataset.checklist = JSON.stringify(meta.checklist || [])

  const deleteButton = document.createElement('button')
  deleteButton.type = 'button'
  deleteButton.className = 'delete-card-btn'
  deleteButton.textContent = '×'
  deleteButton.setAttribute('aria-label', 'Delete card')
  card.appendChild(deleteButton)

  const body = document.createElement('div')
  body.className = 'card-body'

  const cardName = document.createElement('div')
  cardName.className = 'card-name'
  cardName.textContent = text
  body.appendChild(cardName)

  const descriptionElement = document.createElement('div')
  descriptionElement.className = 'card-description'
  const desc = description || DESCRIPTION_PLACEHOLDER
  descriptionElement.textContent = desc
  if (!description || description === DESCRIPTION_PLACEHOLDER) {
    descriptionElement.classList.add('is-placeholder')
  }
  body.appendChild(descriptionElement)

  card.appendChild(body)

  const footer = document.createElement('div')
  footer.className = 'card-footer'

  const cardTags = document.createElement('div')
  cardTags.className = 'card-tags'
  footer.appendChild(cardTags)

  const meta = document.createElement('div')
  meta.className = 'card-meta'
  footer.appendChild(meta)

  card.appendChild(footer)

  listElement.querySelector('.cards').appendChild(card)
  return card
}

export function updateCardBorderColor (card) {
  const firstTag = card.querySelector('.card-tag')
  card.style.borderLeftColor = firstTag
    ? firstTag.style.backgroundColor
    : 'transparent'
}

let currentCard = null

export function getCurrentCard () {
  return currentCard
}

export function saveCurrentCardState () {
  if (!currentCard) return

  const cardName = $('#card-detail-name')?.textContent
  const cardDescription = $('#card-detail-description')?.textContent

  currentCard.querySelector('.card-name').textContent = cardName
  const descEl = currentCard.querySelector('.card-description')
  descEl.textContent = cardDescription
  descEl.classList.toggle('is-placeholder', !cardDescription.trim() || cardDescription === DESCRIPTION_PLACEHOLDER)

  const checklistItems = [...document.querySelectorAll('.checklist-item')].map(item => ({
    text: item.querySelector('input[type="text"]').value,
    checked: item.querySelector('input[type="checkbox"]').checked
  }))
  currentCard.dataset.checklist = JSON.stringify(checklistItems)
  updateChecklistBadge(currentCard)
  saveState()
}

export function showCardDetail (card) {
  if (currentCard) saveCurrentCardState()

  currentCard = card

  const cardName = card.querySelector('.card-name').textContent
  const cardDescription = card.querySelector('.card-description').textContent

  $('#card-detail-name').textContent = cardName
  const descField = $('#card-detail-description')
  descField.textContent = cardDescription === DESCRIPTION_PLACEHOLDER ? '' : cardDescription

  const tagsContainer = $('#card-detail-tags')
  tagsContainer.innerHTML = ''
  refreshModalTags(card)
  renderModalTagPicker(card)

  const checklistItems = card.dataset.checklist ? JSON.parse(card.dataset.checklist) : []
  const checklistContainer = $('#checklist-items')
  checklistContainer.innerHTML = ''
  checklistItems.forEach(item => addChecklistItem(checklistContainer, item.text, item.checked))

  openModal('card-modal', {
    onClose: () => {
      saveCurrentCardState()
      currentCard = null
    }
  })
}

export function addChecklistItem (container, text = '', checked = false) {
  const checklistItem = document.createElement('div')
  checklistItem.className = 'checklist-item'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = checked

  const textInput = document.createElement('input')
  textInput.type = 'text'
  textInput.value = text
  textInput.placeholder = 'Enter checklist item…'
  textInput.classList.toggle('checked', checked)

  checkbox.addEventListener('change', () => {
    textInput.classList.toggle('checked', checkbox.checked)
    saveCurrentCardState()
  })
  textInput.addEventListener('input', () => saveCurrentCardState())

  const removeButton = document.createElement('button')
  removeButton.type = 'button'
  removeButton.className = 'remove-checklist-btn'
  removeButton.textContent = '×'
  removeButton.addEventListener('click', () => {
    checklistItem.remove()
    saveCurrentCardState()
  })

  checklistItem.appendChild(checkbox)
  checklistItem.appendChild(textInput)
  checklistItem.appendChild(removeButton)
  container.appendChild(checklistItem)
}
