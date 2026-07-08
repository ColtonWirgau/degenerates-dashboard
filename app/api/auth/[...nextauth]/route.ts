// Auth.js handlers. Re-exports GET + POST from the central auth config
// so all OAuth callbacks land here at /api/auth/*.

import { handlers } from '@/auth'

export const { GET, POST } = handlers

