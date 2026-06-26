import { $, $$, logError, dataTransferHasType } from './utils.js'
import { saveState } from './state.js'
import { updateCardBorderColor } from './cards.js'
import { showToast } from './ui/toast.js'

const TAG_MIME = 'application/x-board-tag'
let armedTag = null

export function clearTags () {
  $('.tags-list').innerHTML = ''
  armedTag = null
}

export function getArmedTag () {
  return armedTag
}

export function clearArmedTag () {
  armedTag = null
  document.body.classList.remove('tag-apply-mode')
  $$('.tag').forEach(t => t.classList.remove('tag-armed'))
}

function setArmedTag (tagData) {
  armedTag = tagData
  document.body.classList.add('tag-apply-mode')
  $$('.tag').forEach(t => {
    const isArmed = t.dataset.tagName === tagData.name
    t.classList.toggle('tag-armed', isArmed)
  })
}

export function createTag (name, color) {
  const sanitizedName = name.replace(/×/g, '')
  const tagsList = $('.tags-list')
  if (!tagsList) {
    logError('Tags list element not found')
    return null
  }

  const tag = document.createElement('div')
  tag.className = 'tag'
  tag.dataset.tagName = sanitizedName
  tag.dataset.tagColor = color
  tag.style.backgroundColor = color
  tag.draggable = true

  const label = document.createElement('span')
  label.className = 'tag-label'
  label.textContent = sanitizedName
  tag.appendChild(label)

  const removeButton = document.createElement('button')
  removeButton.type = 'button'
  removeButton.className = 'remove-tag-btn'
  removeButton.textContent = '×'
  removeButton.setAttribute('aria-label', `Remove ${sanitizedName}`)
  removeButton.addEventListener('click', e => {
    e.stopPropagation()
    if (armedTag?.name === sanitizedName) clearArmedTag()
    tag.remove()
    saveState()
  })

  tag.appendChild(removeButton)

  tag.addEventListener('dragstart', e => {
    e.dataTransfer.setData(TAG_MIME, JSON.stringify({ name: sanitizedName, color }))
    e.dataTransfer.effectAllowed = 'copy'
    clearArmedTag()
  })

  tag.addEventListener('click', e => {
    if (e.target.closest('.remove-tag-btn')) return
    if (armedTag?.name === sanitizedName) {
      clearArmedTag()
    } else {
      setArmedTag({ name: sanitizedName, color })
    }
  })

  tagsList.appendChild(tag)
  return tag
}

export function applyTagToCard (card, tagData) {
  const existingTags = [...card.querySelectorAll('.card-tag')]
  if (existingTags.some(tag => tag.textContent === tagData.name)) return false

  const tagElement = document.createElement('div')
  tagElement.className = 'card-tag'
  tagElement.textContent = tagData.name
  tagElement.style.backgroundColor = tagData.color
  tagElement.style.setProperty('--tag-color', tagData.color)

  tagElement.addEventListener('click', e => {
    e.stopPropagation()
    tagElement.remove()
    updateCardBorderColor(card)
    saveState()
  })

  card.querySelector('.card-tags').appendChild(tagElement)
  updateCardBorderColor(card)
  return true
}

export function renderModalTagPicker (card) {
  const container = $('#card-available-tags')
  if (!container) return

  const onCard = new Set([...card.querySelectorAll('.card-tag')].map(t => t.textContent))
  const available = $$('.tag').map(tag => ({
    name: tag.dataset.tagName,
    color: tag.dataset.tagColor || tag.style.backgroundColor
  })).filter(t => t.name && !onCard.has(t.name))

  container.innerHTML = ''
  if (available.length === 0) {
    container.hidden = true
    return
  }

  container.hidden = false
  const label = document.createElement('span')
  label.className = 'field-label'
  label.textContent = 'Add tag'
  container.appendChild(label)

  const chips = document.createElement('div')
  chips.className = 'card-available-tags-list'
  available.forEach(tagData => {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'card-available-tag'
    chip.textContent = tagData.name
    chip.style.backgroundColor = tagData.color
    chip.addEventListener('click', () => {
      if (applyTagToCard(card, tagData)) {
        saveState()
        renderModalTagPicker(card)
        refreshModalTags(card)
      }
    })
    chips.appendChild(chip)
  })
  container.appendChild(chips)
}

export function refreshModalTags (card) {
  const tagsContainer = $('#card-detail-tags')
  if (!tagsContainer) return
  tagsContainer.innerHTML = ''
  card.querySelectorAll('.card-tag').forEach(tag => {
    const tagElement = document.createElement('div')
    tagElement.className = 'card-detail-tag'
    tagElement.textContent = tag.textContent
    tagElement.style.backgroundColor = tag.style.backgroundColor
    tagsContainer.appendChild(tagElement)
  })
}

export function initTags () {
  $('#create-tag-btn')?.addEventListener('click', () => {
    try {
      const tagName = $('#tag-name').value.trim()
      const tagColor = $('#tag-color').value

      if (!tagName || !tagColor) {
        showToast('Enter a tag name and color', 'error')
        return
      }

      createTag(tagName.replace(/×/g, ''), tagColor)
      $('#tag-name').value = ''
      saveState()
      showToast(`Tag "${tagName}" created`)
    } catch (error) {
      logError(error)
      showToast('Failed to create tag', 'error')
    }
  })

  $('#tag-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault()
      $('#create-tag-btn').click()
    }
  })

  const listsContainer = $('.lists-container')

  listsContainer.addEventListener('dragover', e => {
    if (dataTransferHasType(e.dataTransfer, TAG_MIME)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  })

  listsContainer.addEventListener('drop', e => {
    if (!dataTransferHasType(e.dataTransfer, TAG_MIME)) return

    try {
      const card = e.target.closest('.card')
      if (!card) return
      e.preventDefault()
      e.stopPropagation()
      const tagData = JSON.parse(e.dataTransfer.getData(TAG_MIME))
      applyTagToCard(card, tagData)
      saveState()
    } catch (error) {
      logError(error)
    }
  })
}

export { TAG_MIME }
