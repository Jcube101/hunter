import '@testing-library/jest-dom/vitest'
import { installVisualViewportStub } from './deviceStubs.js'

// jsdom has no visualViewport implementation at all (Session 19 addendum
// A14) — install a harmless default so any component that reads it doesn't
// crash. Individual tests can call installVisualViewportStub() again with
// overrides. Unlike screen.orientation (see deviceStubs.js), nothing in the
// suite depends on visualViewport being absent, so a global default is safe.
installVisualViewportStub()
