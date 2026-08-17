/**
 * Server-side DOMPurify runtime.
 *
 * The DOM backing DOMPurify is part of the trusted computing base: if it
 * diverges from the DOM specification, the sanitizer's own logic being correct
 * does not save you. DOMPurify's README is explicit that happy-dom "is not
 * considered safe" and that pairing the two "will likely lead to XSS", so this
 * uses jsdom — the implementation DOMPurify documents and tests against.
 *
 * happy-dom remains a dependency for non-security DOM work; the constraint is
 * specifically that it must not back the sanitizer.
 */
import DOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'
import {
  configureRichtextSanitizer,
  type DOMPurifyRuntime,
} from '@core/sanitize'

type DOMPurifyFactory = (window: Window) => DOMPurifyRuntime

let installed = false
const serverSanitizerState: { window: Window | null } = { window: null }

export function installServerRichtextSanitizer(): void {
  if (installed) return

  serverSanitizerState.window = new JSDOM('', {
    url: 'http://localhost/',
  }).window as unknown as Window
  const createDOMPurify = DOMPurify as unknown as DOMPurifyFactory
  const purifier = createDOMPurify(serverSanitizerState.window)
  configureRichtextSanitizer(purifier)
  installed = true
}

installServerRichtextSanitizer()
