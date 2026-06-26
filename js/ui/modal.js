import { $ } from '../utils.js'

let activeModal = null
let onCloseCallback = null

export function openModal (modalId, { onClose } = {}) {
  const modal = document.getElementById(modalId)
  if (!modal) return

  if (activeModal && activeModal !== modal) {
    closeModal(activeModal.id)
  }

  activeModal = modal
  onCloseCallback = onClose || null
  modal.hidden = false
  modal.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'

  const focusable = modal.querySelector('[contenteditable], input, button, textarea')
  focusable?.focus()
}

export function closeModal (modalId) {
  const modal = document.getElementById(modalId)
  if (!modal || modal.hidden) return

  if (onCloseCallback) {
    onCloseCallback()
    onCloseCallback = null
  }

  modal.hidden = true
  modal.setAttribute('aria-hidden', 'true')

  if (activeModal?.id === modalId) {
    activeModal = null
    document.body.style.overflow = ''
  }
}

export function closeActiveModal () {
  if (activeModal) closeModal(activeModal.id)
}

export function initModals () {
  document.addEventListener('click', e => {
    if (e.target.matches('[data-modal-close]')) {
      const modal = e.target.closest('.modal')
      if (modal) closeModal(modal.id)
    }
    if (e.target.matches('[data-drive-modal-close]')) {
      closeModal('drive-modal')
    }
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activeModal) {
      closeModal(activeModal.id)
    }
  })
}
