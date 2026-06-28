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
      className="pointer-events-none absolute bottom-3 right-3 rounded-md"
      style={{ width, height, border: `1px solid ${theme.minimap.border}` }}
    />
  )
})

export default Minimap
