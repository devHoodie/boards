import { $, DESCRIPTION_PLACEHOLDER, placeCaretAtEnd, logError } from './utils.js'
import { saveState, loadState, applyImportedState, resetBoard, getStoredState } from './state.js'
import {
  createCard,
  updateChecklistBadge,
  showCardDetail,
  saveCurrentCardState,
  addChecklistItem
} from './cards.js'
import { createTag, clearTags, applyTagToCard, initTags } from './tags.js'
import { initDragDrop } from './drag-drop.js'
import { initSearch } from './search.js'
import { initModals, closeModal } from './ui/modal.js'
import { initDrawer } from './ui/drawer.js'
import { showToast } from './ui/toast.js'
import { initGoogleDrive, ensureGoogleButton } from './google-drive.js'

const boardHelpers = {
  createTag,
  createCard,
  applyTagToCard,
  updateChecklistBadge
}

function initBoardMenu () {
  const menuBtn = $('#board-menu-btn')
  const menu = $('#board-menu')

  menuBtn?.addEventListener('click', e => {
    e.stopPropagation()
    const open = !menu.hidden
    menu.hidden = open
    menuBtn.setAttribute('aria-expanded', String(!open))
    if (!open) ensureGoogleButton()
  })

  document.addEventListener('click', e => {
    if (!e.target.closest('.popover-wrap')) {
      menu.hidden = true
      menuBtn?.setAttribute('aria-expanded', 'false')
    }
  })
}

function initErrorConsole () {
  const toggle = $('#error-console-toggle')
  const wrap = $('.error-log-wrap')

  toggle?.addEventListener('click', () => {
    const hidden = wrap.hidden
    wrap.hidden = !hidden
  })
}

function initAddCard () {
  const listsContainer = $('.lists-container')

  listsContainer.addEventListener('click', e => {
    const toggle = e.target.closest('.add-card-toggle')
    if (toggle) {
      const area = toggle.closest('.add-card-area')
      toggle.hidden = true
      const form = area.querySelector('.add-card-form')
      form.hidden = false
      form.querySelector('.add-card-input').focus()
      return
    }

    if (e.target.classList.contains('add-card-cancel')) {
      closeAddForm(e.target.closest('.add-card-area'))
      return
    }

    if (e.target.classList.contains('add-card-btn')) {
      const area = e.target.closest('.add-card-area')
      const listElement = area.closest('.list')
      const input = area.querySelector('.add-card-input')
      const text = input.value.trim()
      if (text) {
        createCard(listElement, text)
        input.value = ''
        closeAddForm(area)
        saveState()
      }
    }
  })

  listsContainer.addEventListener('keydown', e => {
    if (!e.target.classList.contains('add-card-input')) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const area = e.target.closest('.add-card-area')
      const listElement = area.closest('.list')
      const text = e.target.value.trim()
      if (text) {
        createCard(listElement, text)
        e.target.value = ''
        closeAddForm(area)
        saveState()
      }
    }

    if (e.key === 'Escape') {
      closeAddForm(e.target.closest('.add-card-area'))
    }
  })
}

function closeAddForm (area) {
  area.querySelector('.add-card-form').hidden = true
  area.querySelector('.add-card-toggle').hidden = false
  area.querySelector('.add-card-input').value = ''
}

function initListEvents () {
  const listsContainer = $('.lists-container')

  listsContainer.addEventListener('keypress', e => {
    if (e.target.tagName === 'H2' && e.key === 'Enter') {
      e.preventDefault()
      e.target.blur()
      saveState()
    }
  })

  listsContainer.addEventListener('blur', e => {
    if (e.target.tagName === 'H2') saveState()
  }, true)

  listsContainer.addEventListener('click', e => {
    if (e.target.classList.contains('delete-card-btn')) {
      e.stopPropagation()
      e.target.closest('.card')?.remove()
      saveState()
      return
    }

    if (e.target.classList.contains('card-name')) {
      e.stopPropagation()
      e.target.contentEditable = true
      placeCaretAtEnd(e.target)
      e.target.focus()
      return
    }

    if (e.target.classList.contains('card-description')) {
      e.stopPropagation()
      const el = e.target
      if (el.classList.contains('is-placeholder')) {
        el.textContent = ''
        el.classList.remove('is-placeholder')
      }
      el.contentEditable = true
      placeCaretAtEnd(el)
      el.focus()
      return
    }

    const card = e.target.closest('.card')
    if (card && !e.target.closest('.delete-card-btn, .card-tag, .card-name, .card-description')) {
      showCardDetail(card)
    }
  })

  listsContainer.addEventListener('blur', e => {
    if (e.target.classList.contains('card-name')) {
      e.target.contentEditable = false
      saveState()
    }
    if (e.target.classList.contains('card-description')) {
      e.target.contentEditable = false
      if (!e.target.textContent.trim()) {
        e.target.textContent = DESCRIPTION_PLACEHOLDER
        e.target.classList.add('is-placeholder')
      }
      saveState()
    }
  }, true)
}

function initBoardTitle () {
  const title = $('.board-title')
  title?.addEventListener('blur', () => saveState())
  title?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault()
      title.blur()
    }
  })
}

function initImportExport () {
  $('#export-btn')?.addEventListener('click', async () => {
    try {
      const state = getStoredState()
      if (!state.lists) {
        showToast('No data to export', 'error')
        return
      }

      const boardTitle = state.boardTitle || 'trello-board'
      const sanitizedTitle = boardTitle.replace(/[^a-zA-Z0-9_\-]/g, '_')
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })

      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${sanitizedTitle}-export.json`,
          types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${sanitizedTitle}-export.json`
        a.click()
        URL.revokeObjectURL(url)
      }

      showToast('Board exported')
    } catch (error) {
      if (error.name !== 'AbortError') logError(error)
    }
  })

  $('#import-btn')?.addEventListener('click', () => $('#import-file').click())

  $('#import-file')?.addEventListener('change', e => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = event => {
      try {
        const state = JSON.parse(event.target.result)
        if (!state?.lists) {
          showToast('Invalid file', 'error')
          return
        }

        applyImportedState(state, { ...boardHelpers, clearTags })
        closeModal('card-modal')
        showToast('Board imported successfully')
        e.target.value = ''
      } catch (error) {
        logError(error)
        showToast('Failed to import board', 'error')
      }
    }
    reader.readAsText(file)
  })

  $('#reset-board-btn')?.addEventListener('click', () => {
    if (confirm('Reset the board? This cannot be undone.')) {
      resetBoard()
    }
  })
}

function initChecklist () {
  $('#add-checklist-item-btn')?.addEventListener('click', () => {
    addChecklistItem($('#checklist-items'))
    saveCurrentCardState()
  })
}

document.addEventListener('DOMContentLoaded', () => {
  initModals()
  initDrawer()
  initTags()
  initSearch()
  initBoardMenu()
  initErrorConsole()
  initAddCard()
  initListEvents()
  initBoardTitle()
  initImportExport()
  initChecklist()
  initGoogleDrive()

  loadState(boardHelpers)

  initDragDrop($('.lists-container'), () => saveState())
})
