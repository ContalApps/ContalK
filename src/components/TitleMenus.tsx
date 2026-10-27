import { useEffect, useRef, useState } from 'react'
import { ControlIcon } from './ControlIcon'

export type MenuItem = { label: string; shortcut?: string; onSelect?: () => void; disabled?: boolean; hint?: string; checked?: boolean } | 'separator'
export type MenuGroup = { label: string; items: MenuItem[] }

// Codex-style menu bar (Arquivo / Editar / Exibir). Mouse down never takes focus, so edit commands act on the field the person was typing in.
export function TitleMenus({ menus }: { menus: MenuGroup[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const [active, setActive] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const items = open === null ? [] : menus[open].items
  const enabled = (index: number) => { const item = items[index]; return item !== 'separator' && item !== undefined && !item.disabled }
  const move = (from: number, step: 1 | -1) => { for (let i = 1; i <= items.length; i++) { const next = (from + step * i + items.length * 2) % items.length; if (enabled(next)) return next } return -1 }
  const close = () => { setOpen(null); setActive(-1) }
  const choose = (item: MenuItem) => { if (item === 'separator' || item.disabled) return; close(); item.onSelect?.() }
  useEffect(() => {
    if (open === null) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close() }
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      else if (event.key === 'ArrowDown') { event.preventDefault(); setActive(current => move(current, 1)) }
      else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(current => move(current < 0 ? 0 : current, -1)) }
      else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); setOpen(current => current === null ? null : (current + (event.key === 'ArrowRight' ? 1 : -1) + menus.length) % menus.length); setActive(-1) }
      else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(items[active]) }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', keys, true)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keys, true) }
  }, [open, active, menus])
  return <div className="ct-title-menus" role="menubar" aria-label="Menu do aplicativo" ref={root}>
    {menus.map((menu, index) => <div className="ct-title-menu" key={menu.label}>
      <button role="menuitem" aria-haspopup="menu" aria-expanded={open === index} data-open={open === index}
        onMouseDown={event => { event.preventDefault(); if (open === index) close(); else { setOpen(index); setActive(-1) } }}
        onMouseEnter={() => { if (open !== null && open !== index) { setOpen(index); setActive(-1) } }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') { event.preventDefault(); setOpen(index); setActive(move(-1, 1)) } }}>{menu.label}</button>
      {open === index && <div className="ct-title-menu-list" role="menu" aria-label={menu.label}>
        {menu.items.map((item, itemIndex) => item === 'separator'
          ? <div className="ct-title-menu-separator" role="separator" key={'s' + itemIndex}/>
          : <button key={item.label} role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={item.checked} aria-disabled={item.disabled || undefined} data-active={active === itemIndex} title={item.hint}
              onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(itemIndex)} onClick={() => choose(item)}>
              <span className="ct-title-menu-check" aria-hidden="true">{item.checked && <ControlIcon name="check" size={14}/>}</span>
              <span>{item.label}{item.hint && item.disabled && <small> · {item.hint}</small>}</span>
              {item.shortcut && <kbd>{item.shortcut}</kbd>}
            </button>)}
      </div>}
    </div>)}
  </div>
}
