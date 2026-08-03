// Minimap.jsx — thin React wrapper around the minimap canvas. It only owns the
// <canvas> element + its placement; the actual drawing happens in renderer.js
// (drawMinimap), called from the game loop with this canvas's 2D context.

import { forwardRef } from 'react'
import { theme } from '../constants/theme.js'

const Minimap = forwardRef(function Minimap({ width, height }, ref) {
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className="pointer-events-none absolute [bottom:calc(0.75rem_+_var(--safe-bottom))] [right:calc(0.75rem_+_var(--safe-right))] rounded-md"
      style={{ width, height, border: `1px solid ${theme.minimap.border}` }}
    />
  )
})

export default Minimap
