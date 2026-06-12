import { useState, useEffect } from 'react'

function getDims() {
  return { width: window.innerWidth, height: window.innerHeight }
}

export function useMobile() {
  const [dims, setDims] = useState(getDims)

  useEffect(() => {
    const update = () => setDims(getDims())
    const onOrientation = () => setTimeout(update, 120)

    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', onOrientation)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', onOrientation)
    }
  }, [])

  return {
    isMobile:   dims.width < 768,
    isTablet:   dims.width < 1024,
    isPortrait: dims.width <= dims.height,
    isLandscape: dims.width > dims.height,
    width: dims.width,
    height: dims.height,
  }
}
