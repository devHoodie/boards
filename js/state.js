import { $, $$, createListElement, logError, DESCRIPTION_PLACEHOLDER, generateId } from './utils.js'
import { updateListCounts } from './search.js'
import { normalizeState } from './merge.js'

const STORAGE_KEY = 'trelloBoard'
let saveTimeout = null
let onSaveCallbacks = []
let collabPush = null
let isCollabMode = false
let lastCollectedState = null
const tombstones = new Map()

function defaultRevision (ts = Date.now()) {
  return {
    text: ts,
    description: ts,
    listId: ts,
    tags: ts,
    checklist: ts
  }
}

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

export function setLastCollectedState (state) {
  lastCollectedState = state ? JSON.parse(JSON.stringify(state)) : null
}

export function markCardDeleted (cardId) {
  if (cardId) tombstones.set(cardId, Date.now())
}

function normalizeDescription (desc) {
  if (!desc || desc === DESCRIPTION_PLACEHOLDER) return ''
  return desc
}

function deepEqual (a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function getCardRevision (cardId) {
  if (!lastCollectedState?.lists || !cardId) return defaultRevision()
  for (const list of lastCollectedState.lists) {
    const card = (list.cards || []).find(c => c.id === cardId)
    if (card?.revision) return { ...card.revision }
  }
  return defaultRevision()
}

function bumpRevisions (newState, prevState) {
  const prevCards = new Map()
  if (prevState?.lists) {
    for (const list of prevState.lists) {
      for (const card of list.cards || []) {
        if (card.id) prevCards.set(card.id, { ...card, listId: card.listId || list.id })
      }
    }
  }

  const lists = (newState.lists || []).map(list => ({
    ...list,
    cards: (list.cards || []).map(card => {
      const id = card.id || generateId()
      const listId = list.id
      const prev = prevCards.get(id)
      const ts = Date.now()
      let revision

      if (!prev) {
        revision = defaultRevision(ts)
      } else {
        revision = { ...prev.revision }
        if (card.text !== prev.text) revision.text = ts
        if (normalizeDescription(card.description) !== normalizeDescription(prev.description)) {
          revision.description = ts
        }
        if (listId !== prev.listId) revision.listId = ts
        if (!deepEqual(card.tags, prev.tags)) revision.tags = ts
        if (!deepEqual(card.checklist, prev.checklist)) revision.checklist = ts
      }

      return {
        id,
        text: card.text,
        description: normalizeDescription(card.description),
        listId,
        tags: card.tags || [],
        checklist: card.checklist || [],
        revision
      }
    })
  }))

  const result = {
    version: 2,
    boardTitle: newState.boardTitle,
    tags: newState.tags || [],
    lists,
    tombstones: Object.fromEntries(tombstones)
  }

  return result
}

function finalizeState () {
  const raw = collectBoardState()
  if (!isCollabMode) return raw
  const finalized = bumpRevisions(raw, lastCollectedState)
  lastCollectedState = JSON.parse(JSON.stringify(finalized))
  return finalized
}

export function flushCollabState () {
  if (!isCollabMode) return collectBoardState()
  const state = finalizeState()
  if (collabPush) collabPush(state)
  updateListCounts()
  onSaveCallbacks.forEach(fn => fn(state))
  return state
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

  const state = {
    boardTitle,
    tags,
    lists: lists.map(list => ({
      id: list.dataset.listId,
      title: list.querySelector('h2').textContent,
      cards: $$('.card', list).map(card => {
        const cardData = {
          text: card.querySelector('.card-name').textContent,
          description: card.querySelector('.card-description').textContent,
          tags: $$('.card-tag', card).map(tag => ({
            name: tag.textContent,
            color: tag.style.backgroundColor
          })),
          checklist: card.dataset.checklist
            ? JSON.parse(card.dataset.checklist)
            : []
        }

        if (isCollabMode) {
          const cardId = card.dataset.cardId || generateId()
          if (!card.dataset.cardId) card.dataset.cardId = cardId
          cardData.id = cardId
          cardData.listId = list.dataset.listId
          cardData.revision = getCardRevision(cardId)
        }

        return cardData
      })
    }))
  }

  if (isCollabMode && tombstones.size > 0) {
    state.tombstones = Object.fromEntries(tombstones)
    state.version = 2
  }

  return state
}

export function saveState () {
  setSaveStatus('Saving…')
  clearTimeout(saveTimeout)

  saveTimeout = setTimeout(() => {
    try {
      if (isCollabMode && collabPush) {
        const state = finalizeState()
        collabPush(state)
        updateListCounts()
        onSaveCallbacks.forEach(fn => fn(state))
        setSaveStatus('Synced')
        return
      }

      const state = collectBoardState()
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
      return lastCollectedState || collectBoardState()
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

function loadCardIntoList (listElement, card, { createCard, applyTagToCard, updateChecklistBadge }) {
  const meta = isCollabMode
    ? { id: card.id, revision: card.revision, checklist: card.checklist }
    : {}
  const cardElement = createCard(listElement, card.text, card.description, meta)
  card.tags?.forEach(tag => applyTagToCard(cardElement, tag))
  if (card.checklist?.length) {
    cardElement.dataset.checklist = JSON.stringify(card.checklist)
    updateChecklistBadge(cardElement)
  }
  return cardElement
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
        ;(list.cards || []).forEach(card => {
          loadCardIntoList(listElement, card, { createCard, applyTagToCard, updateChecklistBadge })
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
  const normalized = isCollabMode ? normalizeState(state) : state
  const listsContainer = $('.lists-container')
  listsContainer.innerHTML = ''
  clearTags()

  if (normalized.tombstones) {
    tombstones.clear()
    for (const [id, deletedAt] of Object.entries(normalized.tombstones)) {
      tombstones.set(id, deletedAt)
    }
  }

  if (normalized.boardTitle) {
    $('.board-title').textContent = normalized.boardTitle
  }

  normalized.tags?.forEach(tag => createTag(tag.name, tag.color))

  normalized.lists?.forEach(list => {
    const listElement = createListElement(list)
    listsContainer.appendChild(listElement)

    list.cards?.forEach(card => {
      loadCardIntoList(listElement, card, { createCard, applyTagToCard, updateChecklistBadge })
    })
  })

  if (isCollabMode) {
    setLastCollectedState(normalized)
  }

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
