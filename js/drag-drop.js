import { dataTransferHasType } from './utils.js'
import { TAG_MIME } from './tags.js'

let draggedCard = null
let dropIndicator = null

function getDropIndicator () {
  if (!dropIndicator) {
    dropIndicator = document.createElement('div')
    dropIndicator.className = 'drop-indicator'
  }
  return dropIndicator
}

function getListAtPoint (x, y) {
  const elements = document.elementsFromPoint(x, y)
  for (const el of elements) {
    const list = el.closest?.('.list')
    if (list) return list
  }
  return null
}

function getInsertPosition (cardsContainer, y) {
  const cards = [...cardsContainer.querySelectorAll('.card:not(.dragging)')]

  for (const card of cards) {
    const box = card.getBoundingClientRect()
    const midpoint = box.top + box.height / 2
    if (y < midpoint) {
      return { before: card }
    }
  }

  return { append: true }
}

function clearDragState () {
  document.querySelectorAll('.list.drag-over').forEach(l => l.classList.remove('drag-over'))
  dropIndicator?.remove()
}

function placeIndicator (cardsContainer, position) {
  const indicator = getDropIndicator()
  if (position.before) {
    cardsContainer.insertBefore(indicator, position.before)
  } else {
    cardsContainer.appendChild(indicator)
  }
}

function moveCardToPosition (card, cardsContainer, position) {
  if (position.before) {
    cardsContainer.insertBefore(card, position.before)
  } else {
    cardsContainer.appendChild(card)
  }
}

export function initDragDrop (listsContainer, onDrop) {
  listsContainer.addEventListener('dragstart', e => {
    const card = e.target.closest('.card')
    if (!card || dataTransferHasType(e.dataTransfer, TAG_MIME)) return

    draggedCard = card
    card.classList.add('dragging')
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', card.dataset.cardId || 'card')
  })

  listsContainer.addEventListener('dragend', e => {
    const card = e.target.closest('.card')
    if (!card) return

    card.classList.remove('dragging')
    clearDragState()
    draggedCard = null
    onDrop?.()
  })

  listsContainer.addEventListener('dragover', e => {
    if (!draggedCard || dataTransferHasType(e.dataTransfer, TAG_MIME)) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const list = getListAtPoint(e.clientX, e.clientY)
    document.querySelectorAll('.list.drag-over').forEach(l => {
      if (l !== list) l.classList.remove('drag-over')
    })

    if (!list) {
      dropIndicator?.remove()
      return
    }

    list.classList.add('drag-over')
    const cardsContainer = list.querySelector('.cards')
    const position = getInsertPosition(cardsContainer, e.clientY)

    dropIndicator?.remove()
    placeIndicator(cardsContainer, position)
    moveCardToPosition(draggedCard, cardsContainer, position)
  })

  listsContainer.addEventListener('drop', e => {
    if (!draggedCard || dataTransferHasType(e.dataTransfer, TAG_MIME)) return
    e.preventDefault()
    clearDragState()
  })
}
