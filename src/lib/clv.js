import { americanToDecimal } from './devig.js'

// Closing Line Value: how much better the price you TOOK was vs the CLOSING price,
// for the same side. CLV% = (takenDecimal / closingDecimal - 1) * 100.
// Positive = you beat the close (got better odds).
export function computeClv(takenAmerican, closingAmerican) {
  const takenDec = americanToDecimal(takenAmerican)
  const closeDec = americanToDecimal(closingAmerican)
  if (takenDec === null || closeDec === null) return null
  const clvPct = (takenDec / closeDec - 1) * 100
  return { clvPct, beat: clvPct > 0 }
}
