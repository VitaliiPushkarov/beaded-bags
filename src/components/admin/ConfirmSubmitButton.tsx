'use client'

import type { MouseEvent, ReactNode } from 'react'

type ConfirmSubmitButtonProps = {
  children: ReactNode
  confirmMessage: string
  className?: string
}

export default function ConfirmSubmitButton({
  children,
  confirmMessage,
  className,
}: ConfirmSubmitButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return (
    <button type="submit" onClick={handleClick} className={className}>
      {children}
    </button>
  )
}
