import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assemblePreviews } from '../scripts/publish-preview.mjs'

test('publisher adds a preview, preserves others and removes closed PRs', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'deuda-preview-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const site = join(dir, 'site'), incoming = join(dir, 'incoming')
  await mkdir(site); await mkdir(incoming)
  await mkdir(join(site, 'pr-1')); await mkdir(join(site, 'pr-2'))
  await writeFile(join(incoming, 'index.html'), '<html><head></head><body>app</body></html>')
  await writeFile(join(incoming, 'app.js'), 'throw new Error("Must never execute")')
  const sha = 'a'.repeat(40)
  await assemblePreviews(site, incoming, [2, 3], '3', sha)
  assert.ok(!(await readdir(site)).includes('pr-1'))
  assert.ok((await readdir(site)).includes('pr-2'))
  assert.match(await readFile(join(site, 'pr-3', 'index.html'), 'utf8'), /VISTA DE PRUEBA/)
  assert.deepEqual(JSON.parse(await readFile(join(site, 'pr-3', 'preview.json'))), { number: 3, sha })
  await assemblePreviews(site, incoming, [], '', '')
  assert.deepEqual((await readdir(site)).sort(), ['.nojekyll', 'index.html'])
})

test('publisher rejects unsafe identifiers and hidden artifact files', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'deuda-preview-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await assert.rejects(assemblePreviews(dir, dir, [1], '../main', 'a'.repeat(40)), /Invalid preview identity/)
  const incoming = join(dir, 'incoming')
  await mkdir(incoming)
  await writeFile(join(incoming, '.gitconfig'), 'unsafe')
  await assert.rejects(assemblePreviews(dir, incoming, [1], '1', 'a'.repeat(40)), /Hidden files/)
})
