import { useState, useEffect } from 'react'

export function useMobile() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return {
    isMobile:  width < 640,
    isTablet:  width < 1024,
    width,
  }
}
