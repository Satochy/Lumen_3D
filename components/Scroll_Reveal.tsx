'use client'

import { useEffect } from 'react'

const DURATION = 800 // ms — mantenha igual ao CSS (.8s)

export default function Scroll_Reveal() {
  useEffect(() => {
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    const timers: number[] = []
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          io.unobserve(el)
          el.dataset.revealState = 'shown'

          // Ao terminar, devolve o elemento às classes originais
          const delay = Number(el.dataset.revealDelay) || 0
          timers.push(
            window.setTimeout(() => {
              delete el.dataset.revealState
              el.style.removeProperty('--reveal-delay')
            }, delay + DURATION + 100)
          )
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0 }
    )

    for (const el of els) {
      // já está na tela (ou acima dela): não anima
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) continue
      el.dataset.revealState = 'hidden'
      el.style.setProperty('--reveal-delay', `${Number(el.dataset.revealDelay) || 0}ms`)
      io.observe(el)
    }

    return () => {
      io.disconnect()
      timers.forEach((t) => window.clearTimeout(t))
      for (const el of els) {
        delete el.dataset.revealState
        el.style.removeProperty('--reveal-delay')
      }
    }
  }, [])

  return null
}