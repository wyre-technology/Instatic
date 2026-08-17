import { beforeEach, describe, expect, it } from 'bun:test'
import React from 'react'
import { act, cleanup, createEvent, fireEvent, render } from '@testing-library/react'
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

    // ---- TEMP CI DIAGNOSTICS (remove before merge) ----
    {
      const doc = select.ownerDocument
      const win = doc.defaultView as unknown as Record<string, unknown> | null
      const iframes = Array.from(document.querySelectorAll('iframe'))
      const probeEvent = createEvent.pointerDown(select) as Event
      const probeMouse = createEvent.mouseDown(select) as Event
      console.log('[DIAG] iframes=', iframes.length,
        'titles=', iframes.map((i) => (i as HTMLIFrameElement).title).join(' | '))
      console.log('[DIAG] bodyBreakpointIds=', iframes.map((i) =>
        (i as HTMLIFrameElement).contentDocument?.body?.getAttribute('data-breakpoint-id')).join(' | '))
      console.log('[DIAG] sameDocAsInput=', input.ownerDocument === doc,
        'docIsHost=', doc === document)
      console.log('[DIAG] win?', !!win,
        'typeof win.PointerEvent=', win ? typeof win['PointerEvent'] : 'n/a',
        'typeof win.MouseEvent=', win ? typeof win['MouseEvent'] : 'n/a',
        'typeof win.Event=', win ? typeof win['Event'] : 'n/a')
      console.log('[DIAG] pointer probe ctor=', probeEvent.constructor?.name,
        'cancelable=', probeEvent.cancelable, 'bubbles=', probeEvent.bubbles,
        'type=', probeEvent.type)
      console.log('[DIAG] mouse probe ctor=', probeMouse.constructor?.name,
        'cancelable=', probeMouse.cancelable, 'bubbles=', probeMouse.bubbles)
      console.log('[DIAG] closest(form-control)=', select.closest('input, textarea, select, button')?.tagName,
        'closest(node)=', select.closest('[data-node-id]')?.getAttribute('data-node-id'),
        'closest(interactive)=', !!select.closest('[data-canvas-interactive="true"]'),
        'selectId=', selectId, 'selectTag=', select.tagName)
    }
    let observedAtDoc: { type: string; cancelable: boolean; defaultPrevented: boolean; ctor: string } | null = null
    const diagDocListener = (event: Event) => {
      observedAtDoc = {
        type: event.type,
        cancelable: event.cancelable,
        defaultPrevented: event.defaultPrevented,
        ctor: event.constructor?.name ?? '?',
      }
    }
    select.ownerDocument.addEventListener('pointerdown', diagDocListener, { capture: true })
    // ---- END TEMP CI DIAGNOSTICS ----

    let selectMouseDown = true
    await act(async () => {
      selectMouseDown = fireEvent.pointerDown(select)
    })
    console.log('[DIAG] fireEvent.pointerDown returned=', selectMouseDown,
      'observedAtDoc=', JSON.stringify(observedAtDoc),
      'selectedNodeId=', useEditorStore.getState().selectedNodeId, 'expected=', selectId)
    select.ownerDocument.removeEventListener('pointerdown', diagDocListener, { capture: true })
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
