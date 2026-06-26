import { $, logError } from './utils.js'
import { saveState } from './state.js'
import { updateCardBorderColor } from './cards.js'
import { showToast } from './ui/toast.js'

const TAG_MIME = 'application/x-board-tag'

export function clearTags () {
  $('.tags-list').innerHTML = ''
}

export function createTag (name, color) {
  const sanitizedName = name.replace(/×/g, '')
  const tagsList = $('.tags-list')

  const tag = document.createElement('div')
  tag.className = 'tag'
  tag.dataset.tagName = sanitizedName
  const label = document.createElement('span')
  label.textContent = sanitizedName
  tag.style.backgroundColor = color
  tag.draggable = true
  tag.appendChild(label)

  const removeButton = document.createElement('button')
  removeButton.type = 'button'
  removeButton.className = 'remove-tag-btn'
  removeButton.textContent = '×'
  removeButton.addEventListener('click', e => {
    e.stopPropagation()
    tag.remove()
    saveState()
  })

  tag.appendChild(removeButton)

  tag.addEventListener('dragstart', e => {
    e.dataTransfer.setData(TAG_MIME, JSON.stringify({ name: sanitizedName, color }))
    e.dataTransfer.effectAllowed = 'copy'
  })

  tagsList.appendChild(tag)
  return tag
}

export function applyTagToCard (card, tagData) {
  const existingTags = [...card.querySelectorAll('.card-tag')]
  if (existingTags.some(tag => tag.textContent === tagData.name)) return

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

  const cardTags = card.querySelector('.card-tags')
  cardTags.appendChild(tagElement)
  updateCardBorderColor(card)
}

export function initTags () {
  $('#create-tag-btn')?.addEventListener('click', () => {
    const tagName = $('#tag-name').value.trim()
    const tagColor = $('#tag-color').value

    if (!tagName || !tagColor) {
      showToast('Enter a tag name and color', 'error')
      return
    }

    createTag(tagName.replace(/×/g, ''), tagColor)
    $('#tag-name').value = ''
    saveState()
  })

  const listsContainer = $('.lists-container')

  listsContainer.addEventListener('dragover', e => {
    if (e.dataTransfer.types.includes(TAG_MIME)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  })

  listsContainer.addEventListener('drop', e => {
    if (!e.dataTransfer.types.includes(TAG_MIME)) return

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
