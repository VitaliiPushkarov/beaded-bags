'use client'
import { useEffect, useState } from 'react'
export function useIsMounted() {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  return m
}
