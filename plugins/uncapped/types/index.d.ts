// The panel's state contract. Values are plain JSON; the saved work itself
// lives in the customer's my-work folder, and this state is the session's copy.

export type UncappedNav = {
  view: string
  builder?: string
  step?: number
  stage?: string
  idea?: number
  theme?: string
  id?: string
}

export type UncappedUi = {
  ws: string
  version: string
  readOnly: boolean
  notice: string | null
  error: string | null
  retry: string | null
  busy: { label: string; steps: string[]; startedAt: number; elapsed: number; builder: string } | null
  drafts: { [key: string]: string }
  editing: { builder: string; path: string; value: string; asks?: string } | null
  showExample: string | null
  update: { state: string; text: string } | null
  // a newer version on Pivot School's release list, when there is one
  latest?: string | null
  confirm: string | null
  cwd?: string
  support?: string
  // the newest support report: where it's saved and its text, for the email draft
  supportPath?: string | null
  supportText?: string | null
  feedback?: { [key: string]: unknown } | null
  trail?: string[]
  lastAction?: string | null
  // the request running or last finished, shown where it was pressed
  op?: { [key: string]: unknown } | null
  // why a press didn't start a new request (already running, done, or busy)
  opNote?: { place: string; state: string; text: string; name: string; target: string; args: unknown } | null
  repairPick?: { [key: string]: string | null }
  refineOpen?: string | null
  pendingFindings?: { [key: string]: unknown } | null
}

declare module 'claude-code' {
  interface PluginState {
    uncapped: {
      nav: Shaped<UncappedNav>
      ui: Shaped<UncappedUi>
      work: Shaped<{ [key: string]: unknown } | null>
    }
  }
}
