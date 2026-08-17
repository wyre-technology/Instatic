import { beforeEach, describe, expect, it } from 'bun:test'
import React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { useEditorStore } from '@site/store/store'
import { CanvasRoot } from '@site/canvas/CanvasRoot'
import { waitForCanvasNodeInFrame } from './iframeCanvasQuery'
import '@modules/base'

function renderCanvas() {
  return render(<DndContext><CanvasRoot /></DndContext>)
}

beforeEach(() => {
  cleanup()
  useEditorStore.setState({
    site: null,
    _historyPast: [],
    _historyFuture: [],
    canUndo: false,
    canRedo: false,
    selectedNodeId: null,
    selectedNodeIds: [],
    hoveredNodeId: null,
    activeDocument: null,
    activePageId: null,
    activeBreakpointId: 'desktop',
    propertiesPanel: { collapsed: false, x: 0, y: 0, width: 360 },
    propertiesPanelMode: 'docked',
    hasUnsavedChanges: false,
  })
})

describe('canvas form controls', () => {
  it('prevents native form-control activation while preserving canvas node selection', async () => {
    const site = useEditorStore.getState().createSite('Form Controls')
    const page = site.pages[0]!
    const formId = useEditorStore.getState().insertNode('base.form', {
      mode: 'cms',
      formId: 'contact',
      targetTableId: '',
    }, page.rootNodeId)
    const inputId = useEditorStore.getState().insertNode('base.input', {
      inputType: 'email',
      name: 'email',
      id: 'email',
      autocomplete: 'email',
    }, formId)
    const selectId = useEditorStore.getState().insertNode('base.select', {
      name: 'plan',
      id: 'plan',
    }, formId)
    const submitId = useEditorStore.getState().insertNode('base.submit', {
      label: 'Send',
      formId: '',
    }, formId)

    renderCanvas()

    const form = await waitForCanvasNodeInFrame<HTMLFormElement>('desktop', formId)
    const input = await waitForCanvasNodeInFrame<HTMLInputElement>('desktop', inputId)
    const select = await waitForCanvasNodeInFrame<HTMLSelectElement>('desktop', selectId)
    const submit = await waitForCanvasNodeInFrame<HTMLButtonElement>('desktop', submitId)
    let submitted = false
    form.addEventListener('submit', (event) => {
      submitted = true
      event.preventDefault()
    })

    // ---- TEMPORARY CI DIAGNOSTICS (scratch branch only) ----
    {
      const d = (k: string, v: unknown) => console.log(`[diag] ${k} = ${String(v)}`)
      const doc = select.ownerDocument as Document
      const frames = Array.from(document.querySelectorAll('iframe'))
      d('parent iframe count', frames.length)
      d(
        'canvas iframe count',
        frames.filter((f) => f.title.startsWith('Canvas frame for ')).length,
      )
      d(
        'desktop frame docs',
        frames
          .map((f) => f.contentDocument?.body?.getAttribute('data-breakpoint-id'))
          .join('|'),
      )
      d('select.ownerDocument === input.ownerDocument', input.ownerDocument === doc)
      d('select ctor', select.constructor?.name)
      d('input ctor', input.constructor?.name)

      type Probe = { tag: string; el: Element; type: 'mousedown' | 'pointerdown' }
      const probes: Probe[] = [
        { tag: 'input/mousedown', el: input, type: 'mousedown' },
        { tag: 'input/pointerdown', el: input, type: 'pointerdown' },
        { tag: 'select/mousedown', el: select, type: 'mousedown' },
        { tag: 'select/pointerdown', el: select, type: 'pointerdown' },
      ]

      for (const p of probes) {
        let fired = 0
        let preventedAtProbe: unknown = 'never-fired'
        let targetIsEl: unknown = 'never-fired'
        let targetTag: unknown = 'never-fired'
        let targetCtor: unknown = 'never-fired'
        let closestControl: unknown = 'never-fired'
        let closestNode: unknown = 'never-fired'
        let closestInteractive: unknown = 'never-fired'
        let closestType: unknown = 'never-fired'
        const listener = (event: Event) => {
          fired += 1
          preventedAtProbe = event.defaultPrevented
          const t = event.target as unknown as Element | null
          targetIsEl = t === p.el
          targetTag = t == null ? 'null' : (t as Element).tagName
          targetCtor = t == null ? 'null' : t.constructor?.name
          closestType = typeof (t as unknown as { closest?: unknown } | null)?.closest
          if (t && typeof t.closest === 'function') {
            closestControl = String(t.closest('input, textarea, select, button')?.tagName)
            closestNode = String(t.closest('[data-node-id]')?.getAttribute('data-node-id'))
            closestInteractive = String(Boolean(t.closest('[data-canvas-interactive="true"]')))
          }
        }
        doc.addEventListener(p.type, listener, { capture: true })
        let ret: unknown = 'not-run'
        await act(async () => {
          ret =
            p.type === 'mousedown'
              ? fireEvent.mouseDown(p.el)
              : fireEvent.pointerDown(p.el)
        })
        doc.removeEventListener(p.type, listener, { capture: true })
        d(`${p.tag}: fireEvent return`, ret)
        d(`${p.tag}: doc-capture probe fired`, fired)
        d(`${p.tag}: defaultPrevented at probe`, preventedAtProbe)
        d(`${p.tag}: event.target === element`, targetIsEl)
        d(`${p.tag}: event.target.tagName`, targetTag)
        d(`${p.tag}: event.target ctor`, targetCtor)
        d(`${p.tag}: typeof target.closest`, closestType)
        d(`${p.tag}: target.closest(form-control)`, closestControl)
        d(`${p.tag}: target.closest(data-node-id)`, closestNode)
        d(`${p.tag}: target.closest(canvas-interactive)`, closestInteractive)
        d(`${p.tag}: selectedNodeId after`, useEditorStore.getState().selectedNodeId)
      }
      d('inputId', inputId)
      d('selectId', selectId)
      d('select.closest(form-control) direct', String(select.closest('input, textarea, select, button')?.tagName))
      d('select.matches(select) direct', select.matches('select'))
      d('select.matches(form-control) direct', select.matches('input, textarea, select, button'))
      d('select.closest(data-node-id) direct', String(select.closest('[data-node-id]')?.getAttribute('data-node-id')))
    }
    // ---- END TEMPORARY CI DIAGNOSTICS ----

    let inputMouseDown = true
    await act(async () => {
      inputMouseDown = fireEvent.mouseDown(input)
    })
    console.log(`[diag] final mouseDown(input) return = ${String(inputMouseDown)}`)
    expect(inputMouseDown).toBe(false)
    expect(useEditorStore.getState().selectedNodeId).toBe(inputId)

    let selectMouseDown = true
    await act(async () => {
      selectMouseDown = fireEvent.pointerDown(select)
    })
    console.log(`[diag] final pointerDown return = ${String(selectMouseDown)}`)
    expect(selectMouseDown).toBe(false)
    expect(useEditorStore.getState().selectedNodeId).toBe(selectId)

    await act(async () => {
      fireEvent.click(select!)
    })
    expect(useEditorStore.getState().selectedNodeId).toBe(selectId)

    await act(async () => {
      fireEvent.click(input!)
    })
    expect(useEditorStore.getState().selectedNodeId).toBe(inputId)

    let submitMouseDown = true
    await act(async () => {
      submitMouseDown = fireEvent.mouseDown(submit)
      fireEvent.click(submit)
    })
    expect(submitMouseDown).toBe(false)
    expect(submitted).toBe(false)
    expect(useEditorStore.getState().selectedNodeId).toBe(submitId)
  })
})
