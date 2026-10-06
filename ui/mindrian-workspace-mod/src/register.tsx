import type { Register } from 'claude-code'

import { registerBand } from './registrars/band'
import { registerModel } from './registrars/model'
import { registerPane } from './registrars/pane'

export const register: Register = (on, options) => {
  registerModel(on, options)
  registerBand(on, options)
  registerPane(on, options)
}
