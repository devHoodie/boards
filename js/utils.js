export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

export const DESCRIPTION_PLACEHOLDER = 'Click to add a description...'

export function placeCaretAtEnd (element) {
  const range = document.createRange()
  const selection = window.getSelection()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

let errorCount = 0

export function dataTransferHasType (transfer, type) {
  if (!transfer?.types) return false
  if (typeof transfer.types.includes === 'function') return transfer.types.includes(type)
  if (typeof transfer.types.contains === 'function') return transfer.types.contains(type)
  return Array.from(transfer.types).includes(type)
}

function formatError (error) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function logError (error) {
  const errorLog = $('.error-log')
  const errorCountEl = $('#error-count')
  const errorConsole = $('#error-console')
  if (!errorLog) return

  const message = document.createElement('div')
  message.textContent = `[Error] ${formatError(error)}`
  errorLog.appendChild(message)
  errorLog.scrollTop = errorLog.scrollHeight

  errorCount++
  if (errorCountEl) {
    errorCountEl.textContent = String(errorCount)
    errorCountEl.hidden = false
  }
  errorConsole?.classList.add('has-errors')
}

export function createListElement (list) {
  const listElement = document.createElement('div')
  listElement.className = 'list'
  listElement.setAttribute('data-list-id', list.id)
  listElement.innerHTML = `
    <div class="list-header">
      <h2 contenteditable="true" spellcheck="false"></h2>
      <span class="list-count">0</span>
    </div>
    <div class="cards"></div>
    <div class="add-card-area">
      <button type="button" class="add-card-toggle">+ Add a card</button>
      <div class="add-card-form" hidden>
        <textarea class="add-card-input" placeholder="Enter card title…" rows="2"></textarea>
        <div class="add-card-actions">
          <button type="button" class="btn btn-primary add-card-btn">Add card</button>
          <button type="button" class="btn btn-ghost add-card-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `
  listElement.querySelector('h2').textContent = list.title
  return listElement
}
