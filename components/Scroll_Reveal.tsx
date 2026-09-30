'use client'

import { useEffect } from 'react'

const REVEAL_TYPES = ['left', 'right', 'pop'] as const

export default function Scroll_Reveal() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return
    }

    console.log('🚀 [Scroll_Reveal] A iniciar observador...')

    const observedElements = new Set<Element>()

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement
          if (entry.isIntersecting) {
            console.log('✨ [Scroll_Reveal] A revelar secção:', el.id || 'secção')
            el.dataset.revealState = 'shown'
          } else {
            el.dataset.revealState = 'hidden'
          }
        })
      },
      {
        rootMargin: '0px 0px -5% 0px',
        threshold: 0,
      }
    )

    const scanAndObserve = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))

      els.forEach((el) => {
        if (!observedElements.has(el)) {
          observedElements.add(el)

          // 1. Sorteia o tipo de entrada
          if (!el.dataset.revealType) {
            const randomType = REVEAL_TYPES[Math.floor(Math.random() * REVEAL_TYPES.length)]
            el.dataset.revealType = randomType
          }

          el.style.setProperty('--reveal-delay', `${Number(el.dataset.revealDelay) || 0}ms`)

          // 2. Define o estado inicial com base na posição no ecran
          const rect = el.getBoundingClientRect()
          if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
            el.dataset.revealState = 'shown'
          } else {
            el.dataset.revealState = 'hidden'
          }

          io.observe(el)
        }
      })
    }

    scanAndObserve()

    const mutationObserver = new MutationObserver(() => scanAndObserve())
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      mutationObserver.disconnect()
      io.disconnect()
    }
  }, [])

  return null
}