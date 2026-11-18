// Opening things, on whichever computer the customer has.
//
// Until now Uncapped called /usr/bin/open directly in three places, which does
// nothing at all on Windows and failed silently there. That was survivable
// while those three were side errands. It is not survivable now that opening
// the browser IS the product.
//
// There is no platform on $, so we ask the environment: Windows sets OS and
// SystemRoot, and nothing else does.

let kind = null

export async function osKind($) {
  if (kind) return kind
  try {
    const os = (await $.env.get('OS')) || ''
    const root = (await $.env.get('SystemRoot')) || ''
    kind = /windows/i.test(os) || /windows/i.test(root) ? 'windows' : 'mac'
  } catch (e) {
    kind = 'mac'
  }
  return kind
}

// Opens a URL in whatever the person's browser or email app is.
//
// On Windows this uses rundll32 rather than `cmd /c start`, on purpose: start
// treats & as a command separator, so a mailto: link with more than one query
// parameter is cut in half and the body is lost. rundll32 takes the URL whole.
export async function openUrl($, url) {
  const os = await osKind($)
  const argv = os === 'windows'
    ? ['rundll32', 'url.dll,FileProtocolHandler', url]
    : ['/usr/bin/open', url]
  try {
    const r = await $.process.run(argv, { timeoutMs: 15000 })
    return r.exitCode === 0
  } catch (e) {
    return false
  }
}

// Shows a file in Finder or File Explorer, with the file itself selected.
export async function revealPath($, abs) {
  const os = await osKind($)
  const argv = os === 'windows'
    ? ['explorer', `/select,${abs.replace(/\//g, '\\')}`]
    : ['/usr/bin/open', '-R', abs]
  try {
    const r = await $.process.run(argv, { timeoutMs: 15000 })
    // explorer returns 1 even when it worked, so only Finder's code is trusted
    return os === 'windows' ? true : r.exitCode === 0
  } catch (e) {
    return false
  }
}

// Puts text on the clipboard.
export async function copyText($, text) {
  const os = await osKind($)
  const argv = os === 'windows' ? ['clip'] : ['/usr/bin/pbcopy']
  try {
    const r = await $.process.run(argv, { stdin: String(text), timeoutMs: 10000 })
    return r.exitCode === 0
  } catch (e) {
    return false
  }
}

// The word for the folder app, for anything we say to the customer.
export async function fileAppName($) {
  return (await osKind($)) === 'windows' ? 'File Explorer' : 'Finder'
}
