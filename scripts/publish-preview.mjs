import { cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function assemblePreviews(root, incoming, open, number, sha) {
  const allowed = new Set(open)
  if (!open.every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Invalid open PR list')
  if (number && (!/^[1-9]\d*$/.test(number) || !allowed.has(Number(number)) || !/^[a-f0-9]{40}$/.test(sha))) {
    throw new Error('Invalid preview identity')
  }
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const match = entry.name.match(/^pr-([1-9]\d*)$/)
    if (entry.isDirectory() && match && !allowed.has(Number(match[1]))) {
      await rm(join(root, entry.name), { recursive: true })
    }
  }
  if (number) {
    let total = 0
    const inspect = async dir => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) throw new Error('Hidden files and symlinks are not allowed in previews')
        const path = join(dir, entry.name)
        if (entry.isDirectory()) await inspect(path)
        else if (entry.isFile()) total += (await lstat(path)).size
        else throw new Error('Unsupported artifact entry')
        if (total > 50 * 1024 * 1024) throw new Error('Preview exceeds 50 MB')
      }
    }
    await inspect(incoming)
    const html = await readFile(join(incoming, 'index.html'), 'utf8')
    if (!html.includes('<html') || !html.includes('</body>')) throw new Error('Artifact has no valid index.html')
    const target = join(root, `pr-${number}`)
    await rm(target, { recursive: true, force: true })
    await cp(incoming, target, { recursive: true })
    // Trusted banner identifies exactly which untrusted PR build is being viewed.
    const banner = `<aside style="position:sticky;top:0;z-index:9999;background:#fff0be;color:#322b16;padding:12px;text-align:center;font:14px system-ui">VISTA DE PRUEBA · PR #${number} · commit ${sha.slice(0, 7)} · No es producción · No introducir datos sensibles</aside>`
    await writeFile(join(target, 'index.html'), html.replace('<head>', '<head><meta name="robots" content="noindex,nofollow">').replace('<body>', `<body>${banner}`))
    await writeFile(join(target, 'preview.json'), JSON.stringify({ number: Number(number), sha }))
  }
  await writeFile(join(root, '.nojekyll'), '')
  const active = (await readdir(root)).filter(name => /^pr-[1-9]\d*$/.test(name)).sort()
  await writeFile(join(root, 'index.html'), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Deuda Abierta · Previews</title></head><body style="font:16px system-ui;max-width:800px;margin:60px auto;padding:20px"><h1>Vistas de prueba</h1><p>Versiones públicas de desarrollo. No introducir datos sensibles.</p><ul>${active.map(name => `<li><a href="./${name}/">${name}</a></li>`).join('')}</ul>${active.length ? '' : '<p>No hay previews activas.</p>'}<a href="https://alejandrovaltierracarbonero.github.io/deuda-abierta/">Ir a producción</a></body></html>`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve('site')
  await mkdir(root, { recursive: true })
  const open = JSON.parse(await readFile('open-prs.json', 'utf8'))
  await assemblePreviews(root, resolve('incoming'), open, process.env.PREVIEW_NUMBER ?? '', process.env.PREVIEW_SHA ?? '')
}
