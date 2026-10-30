import type { MebsyApi } from './index'

declare global {
  interface Window {
    mebsy: MebsyApi
  }
}

export {}
