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

    let inputMouseDown = true
    await act(async () => {
      inputMouseDown = fireEvent.mouseDown(input)
    })
    expect(inputMouseDown).toBe(false)
    expect(useEditorStore.getState().selectedNodeId).toBe(inputId)

    // ---- TEMPORARY CI DIAGNOSTICS (scratch branch only) ----
    {
      const doc = select.ownerDocument as Document
      const win = doc.defaultView as unknown as Record<string, unknown> | null
      const d = (k: string, v: unknown) => console.log(`[diag] ${k} = ${String(v)}`)
      d('input.ownerDocument===select.ownerDocument', input.ownerDocument === doc)
      d('select.isConnected', select.isConnected)
      d('input.isConnected', input.isConnected)
      d('select.tagName', select.tagName)
      d('win is null', win === null)
      d('typeof win.PointerEvent', win ? typeof win['PointerEvent'] : 'n/a')
      d('typeof win.MouseEvent', win ? typeof win['MouseEvent'] : 'n/a')
      d('typeof win.Event', win ? typeof win['Event'] : 'n/a')
      d('closest(form-control)', String(select.closest('input, textarea, select, button')?.tagName))
      d('closest(data-node-id)', String(select.closest('[data-node-id]')?.getAttribute('data-node-id')))
      d('expected node id', selectId)
      d('closest(canvas-interactive)', String(Boolean(select.closest('[data-canvas-interactive="true"]'))))
      d('select.parentElement', String(select.parentElement?.tagName))
      d('doc.contains(select)', doc.contains(select))
      d('doc.body.contains(select)', doc.body?.contains(select))

      let probeSawPointerDown = 0
      let probeCancelable: unknown = 'never-fired'
      let probeCtor: unknown = 'never-fired'
      let probePreventedAtProbe: unknown = 'never-fired'
      const probe = (event: Event) => {
        probeSawPointerDown += 1
        probeCancelable = event.cancelable
        probeCtor = event.constructor?.name
        probePreventedAtProbe = event.defaultPrevented
      }
      doc.addEventListener('pointerdown', probe, { capture: true })
      let probeReturn: unknown = 'not-run'
      await act(async () => {
        probeReturn = fireEvent.pointerDown(select)
      })
      doc.removeEventListener('pointerdown', probe, { capture: true })
      d('probe: doc capture listener fired count', probeSawPointerDown)
      d('probe: event.cancelable', probeCancelable)
      d('probe: event ctor', probeCtor)
      d('probe: defaultPrevented at probe (after suppression listener)', probePreventedAtProbe)
      d('probe: fireEvent return', probeReturn)
      d('probe: selectedNodeId after', useEditorStore.getState().selectedNodeId)
      d('probe: expected selectId', selectId)

      let mdOnSelect: unknown = 'not-run'
      await act(async () => {
        mdOnSelect = fireEvent.mouseDown(select)
      })
      d('mouseDown(select) return', mdOnSelect)
    }
    // ---- END TEMPORARY CI DIAGNOSTICS ----

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
