"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
  delayMs?: number
  side?: "top" | "bottom" | "left" | "right"
}

export function Tooltip({
  content,
  children,
  className = "",
  delayMs = 200,
  side = "top",
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<"top" | "bottom">(side === "bottom" ? "bottom" : "top")
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const clearTimeouts = useCallback(() => {
    if (showTimeoutRef.current) { clearTimeout(showTimeoutRef.current); showTimeoutRef.current = null }
    if (hideTimeoutRef.current) { clearTimeout(hideTimeoutRef.current); hideTimeoutRef.current = null }
  }, [])

  useEffect(() => { return () => clearTimeouts() }, [clearTimeouts])

  const showTooltip = useCallback(() => {
    clearTimeouts()
    showTimeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        if (side === "top" && rect.top < 120) setPosition("bottom")
        else if (side === "bottom" && window.innerHeight - rect.bottom < 120) setPosition("top")
        else setPosition(side === "bottom" ? "bottom" : "top")
      }
      setIsVisible(true)
    }, delayMs)
  }, [delayMs, clearTimeouts, side])

  const hideTooltip = useCallback(() => {
    clearTimeouts()
    hideTimeoutRef.current = setTimeout(() => setIsVisible(false), 150)
  }, [clearTimeouts])

  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) { clearTimeout(hideTimeoutRef.current); hideTimeoutRef.current = null }
  }, [])

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute z-[100] px-3 py-2.5 text-sm leading-relaxed rounded-lg shadow-2xl max-w-sm whitespace-normal
            bg-gray-900 text-gray-100
            ${position === "top" ? "bottom-full left-1/2 -translate-x-1/2 mb-2" : "top-full left-1/2 -translate-x-1/2 mt-2"}`}
          role="tooltip"
          onMouseEnter={cancelHide}
          onMouseLeave={hideTooltip}
        >
          {content}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-gray-900
              ${position === "top" ? "top-full -mt-1.5" : "bottom-full -mb-1.5"}`}
          />
        </div>
      )}
    </div>
  )
}
