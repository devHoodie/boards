import { $ } from '../utils.js'
import { openModal, closeModal } from './modal.js'
import { applyConflictResolutions, fieldLabel, listTitleById } from '../merge.js'

let pendingResolve = null

function formatValue (field, value, state) {
  if (field === 'listId') return listTitleById(state, value)
  if (field === 'tags') return (value || []).map(t => t.name).join(', ') || '(none)'
  if (field === 'checklist') {
    const items = value || []
    return items.length ? items.map(i => i.text).join('; ') : '(empty)'
  }
  if (field === 'description') return value || '(empty)'
  return String(value ?? '')
}

export function showMergeReview ({
  roomId,
  localState,
  remoteState,
  mergeResult,
  onApply,
  onUseLive,
  onUseMine
}) {
  return new Promise(resolve => {
    pendingResolve = resolve
    const { merged, autoMerged, conflicts } = mergeResult
    const resolutions = {}

    const titleEl = $('#merge-modal-title')
    if (titleEl) titleEl.textContent = `Sync changes for room “${roomId}”`

    const autoEl = $('#merge-auto-list')
    autoEl.innerHTML = ''
    if (autoMerged.length === 0) {
      autoEl.innerHTML = '<li class="merge-empty">No field-level differences to auto-merge.</li>'
    } else {
      for (const item of autoMerged) {
        const li = document.createElement('li')
        if (item.field === '_card') {
          li.textContent = item.note || `Card “${item.cardTitle}”`
        } else {
          const from = item.source === 'local' ? 'your copy' : 'live room'
          li.textContent = `“${item.cardTitle}”: ${fieldLabel(item.field)} updated from ${from}`
        }
        autoEl.appendChild(li)
      }
    }

    const conflictsEl = $('#merge-conflicts')
    conflictsEl.innerHTML = ''
    const applyBtn = $('#merge-apply-btn')

    if (conflicts.length === 0) {
      conflictsEl.innerHTML = '<p class="merge-empty">No conflicts — all changes can be merged automatically.</p>'
      if (applyBtn) applyBtn.disabled = false
    } else {
      for (const c of conflicts) {
        const block = document.createElement('div')
        block.className = 'merge-conflict'
        block.innerHTML = `
          <p class="merge-conflict-title">“${c.cardTitle}” — ${fieldLabel(c.field)}</p>
          <label class="merge-conflict-option">
            <input type="radio" name="conflict-${c.cardId}-${c.field}" value="local" />
            <span>Yours: ${formatValue(c.field, c.localValue, localState)}</span>
          </label>
          <label class="merge-conflict-option">
            <input type="radio" name="conflict-${c.cardId}-${c.field}" value="remote" />
            <span>Theirs: ${formatValue(c.field, c.remoteValue, remoteState)}</span>
          </label>
        `
        block.querySelectorAll('input').forEach(input => {
          input.addEventListener('change', () => {
            resolutions[`${c.cardId}:${c.field}`] = input.value
            const allResolved = conflicts.every(
              x => resolutions[`${x.cardId}:${x.field}`]
            )
            if (applyBtn) applyBtn.disabled = !allResolved
          })
        })
        conflictsEl.appendChild(block)
      }
      if (applyBtn) applyBtn.disabled = true
    }

    const cleanup = () => {
      $('#merge-apply-btn')?.replaceWith($('#merge-apply-btn').cloneNode(true))
      $('#merge-use-live-btn')?.replaceWith($('#merge-use-live-btn').cloneNode(true))
      $('#merge-use-mine-btn')?.replaceWith($('#merge-use-mine-btn').cloneNode(true))
      pendingResolve = null
    }

    $('#merge-apply-btn')?.addEventListener('click', () => {
      const final = applyConflictResolutions(
        JSON.parse(JSON.stringify(merged)),
        conflicts,
        resolutions
      )
      closeModal('merge-modal')
      cleanup()
      onApply(final)
      resolve('merged')
    })

    $('#merge-use-live-btn')?.addEventListener('click', () => {
      closeModal('merge-modal')
      cleanup()
      onUseLive()
      resolve('live')
    })

    $('#merge-use-mine-btn')?.addEventListener('click', () => {
      closeModal('merge-modal')
      cleanup()
      onUseMine()
      resolve('mine')
    })

    openModal('merge-modal')
  })
}
