import { $ } from '../utils.js'

let activeDrawer = null

export function openDrawer (drawerId) {
  const drawer = document.getElementById(drawerId)
  if (!drawer) return

  activeDrawer = drawer
  drawer.hidden = false
  drawer.setAttribute('aria-hidden', 'false')
}

export function closeDrawer (drawerId) {
  const drawer = document.getElementById(drawerId)
  if (!drawer || drawer.hidden) return

  drawer.hidden = true
  drawer.setAttribute('aria-hidden', 'true')
  if (activeDrawer?.id === drawerId) activeDrawer = null
}

export function closeActiveDrawer () {
  if (activeDrawer) closeDrawer(activeDrawer.id)
}

export function initDrawer () {
  $('#tags-drawer-btn')?.addEventListener('click', () => openDrawer('tags-drawer'))

  document.addEventListener('click', e => {
    if (e.target.matches('[data-drawer-close]')) {
      const drawer = e.target.closest('.drawer')
      if (drawer) closeDrawer(drawer.id)
    }
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activeDrawer) {
      closeDrawer(activeDrawer.id)
    }
  })
}
