import '@testing-library/jest-dom/vitest'

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  // @ts-expect-error – jsdom polyfill for react-textarea-autosize
  window.ResizeObserver = ResizeObserver
}
