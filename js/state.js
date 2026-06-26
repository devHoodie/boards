import { $, $$, createListElement, logError } from './utils.js'
import { updateListCounts } from './search.js'

const STORAGE_KEY = 'trelloBoard'
let saveTimeout = null
let onSaveCallbacks = []
let collabPush = null
let isCollabMode = false

export function onSave (fn) {
  onSaveCallbacks.push(fn)
}

export function enableCollabMode (pushFn) {
  isCollabMode = true
  collabPush = pushFn
}

export function isInCollabMode () {
  return isCollabMode
}

export function setSaveStatus (status) {
  const el = $('#save-status')
  if (!el) return
  el.textContent = status
  el.classList.toggle('saving', status === 'Saving…')
}

export function collectBoardState () {
  const boardTitle = $('.board-title')?.textContent || 'My Board'
  const lists = $$('.list')
  const tags = $$('.tag').map(tag => ({
    name: tag.dataset.tagName || tag.textContent.replace(/×/g, ''),
    color: tag.dataset.tagColor || tag.style.backgroundColor
  }))

  return {
    boardTitle,
    tags,
    lists: lists.map(list => ({
      id: list.dataset.listId,
      title: list.querySelector('h2').textContent,
      cards: $$('.card', list).map(card => ({
        text: card.querySelector('.card-name').textContent,
        description: card.querySelector('.card-description').textContent,
        tags: $$('.card-tag', card).map(tag => ({
          name: tag.textContent,
          color: tag.style.backgroundColor
        })),
        checklist: card.dataset.checklist
          ? JSON.parse(card.dataset.checklist)
          : []
      }))
    }))
  }
}

export function saveState () {
  setSaveStatus('Saving…')
  clearTimeout(saveTimeout)

  saveTimeout = setTimeout(() => {
    try {
      const state = collectBoardState()

      if (isCollabMode && collabPush) {
        collabPush(state)
        updateListCounts()
        onSaveCallbacks.forEach(fn => fn(state))
        setSaveStatus('Saved')
        return
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      updateListCounts()
      onSaveCallbacks.forEach(fn => fn(state))
      setSaveStatus('Saved')
    } catch (error) {
      logError(error)
      setSaveStatus('Error')
    }
  }, 300)
}

export function getStoredState () {
  if (isCollabMode) {
    try {
      return collectBoardState()
    } catch {
      return {}
    }
  }
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

export function loadState ({ createTag, createCard, applyTagToCard, updateChecklistBadge }) {
  try {
    const savedState = getStoredState()

    if (savedState.boardTitle) {
      const titleEl = $('.board-title')
      if (titleEl) titleEl.textContent = savedState.boardTitle
    }

    if (savedState.tags?.length) {
      savedState.tags.forEach(tag => createTag(tag.name, tag.color))
    }

    if (savedState.lists?.length) {
      savedState.lists.forEach(list => {
        const listElement = $(`[data-list-id="${list.id}"]`)
        if (!listElement) return

        listElement.querySelector('h2').textContent = list.title
        list.cards.forEach(card => {
          const cardElement = createCard(listElement, card.text, card.description)
          card.tags?.forEach(tag => applyTagToCard(cardElement, tag))
          if (card.checklist?.length) {
            cardElement.dataset.checklist = JSON.stringify(card.checklist)
            updateChecklistBadge(cardElement)
          }
        })
      })
    }

    updateListCounts()
  } catch (error) {
    logError(error)
  }
}

export function applyImportedState (
  state,
  { createTag, clearTags, createCard, applyTagToCard, updateChecklistBadge },
  { persistLocal = !isCollabMode } = {}
) {
  const listsContainer = $('.lists-container')
  listsContainer.innerHTML = ''
  clearTags()

  if (state.boardTitle) {
    $('.board-title').textContent = state.boardTitle
  }

  state.tags?.forEach(tag => createTag(tag.name, tag.color))

  state.lists?.forEach(list => {
    const listElement = createListElement(list)
    listsContainer.appendChild(listElement)

    list.cards.forEach(card => {
      const cardElement = createCard(listElement, card.text, card.description)
      card.tags?.forEach(tag => applyTagToCard(cardElement, tag))
      if (card.checklist?.length) {
        cardElement.dataset.checklist = JSON.stringify(card.checklist)
        updateChecklistBadge(cardElement)
      }
    })
  })

  if (persistLocal) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
  updateListCounts()
}

export function resetBoard () {
  if (isCollabMode) return
  localStorage.removeItem(STORAGE_KEY)
  location.reload()
}
