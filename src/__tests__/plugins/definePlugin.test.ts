/**
 * Regression test for a real gap found building a content-editor-kind
 * plugin (wyre.approvals, 2026-09-08): `definePlugin()` silently dropped
 * `contentAccess` from the manifest it returns, even though it's a real
 * field on `DefinePluginConfig`/`PluginManifest` and the CLI's own
 * `init --kind content-editor` scaffold writes it into the generated
 * `instatic-plugin.config.ts`. Any plugin declaring a `cms.content.*`
 * permission then failed manifest validation with "contentAccess is
 * required..." despite having declared it correctly — the config field
 * existed, the builder just never copied it into its output.
 */
import { describe, expect, it } from 'bun:test'
import { definePlugin } from '@core/plugin-sdk'
import { parsePluginManifest } from '@core/plugins/manifest'

describe('definePlugin — contentAccess', () => {
  it('carries contentAccess through into the returned manifest', () => {
    const { manifest } = definePlugin({
      id: 'acme.example',
      name: 'Example',
      version: '0.1.0',
      permissions: ['cms.content.read', 'cms.content.publish'],
      contentAccess: [{ table: 'pages', modes: ['read', 'publish'] }],
    })

    expect(manifest.contentAccess).toEqual([{ table: 'pages', modes: ['read', 'publish'] }])
  })

  it('omits contentAccess entirely when not declared (matches every other optional field)', () => {
    const { manifest } = definePlugin({
      id: 'acme.example',
      name: 'Example',
      version: '0.1.0',
      permissions: ['cms.storage'],
    })

    expect(manifest.contentAccess).toBeUndefined()
  })

  it('the resulting manifest passes parsePluginManifest — the actual failure mode this fixes', () => {
    const { manifest } = definePlugin({
      id: 'acme.example',
      name: 'Example',
      version: '0.1.0',
      permissions: ['cms.content.read', 'cms.content.publish'],
      contentAccess: [{ table: 'pages', modes: ['read', 'publish'] }],
    })

    // Before the fix this threw: "contentAccess is required when any
    // cms.content.* permission is granted" — parsing the manifest built by
    // definePlugin() itself failed even though the author had declared
    // contentAccess correctly in instatic-plugin.config.ts.
    expect(() => parsePluginManifest(manifest)).not.toThrow()
  })
})
