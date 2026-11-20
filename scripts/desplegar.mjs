// Publica la pagina en GitHub Pages: la compila con la ruta /Generador-3D/ y
// sube el resultado como un commit nuevo a la rama gh-pages, que lleva solo la
// pagina compilada. Si la pagina no cambio, no sube nada.
// Uso: npm run deploy
import { execFileSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAMA = 'gh-pages'
const MENSAJE = 'Publicar la pagina del Generador 3D'

const git = (args, cwd = raiz) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()

// 1. Compilar la pagina con la ruta de GitHub Pages.
console.log('Compilando la pagina...')
execSync('npm run build:pages', { cwd: raiz, stdio: 'inherit' })
const compilada = path.join(raiz, 'dist')

// 2. Preparar una copia de trabajo aparte de la rama gh-pages, para no tocar
//    la carpeta del proyecto ni la rama en la que se esta trabajando.
const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-pages-'))
let existe = true
try {
  git(['fetch', 'origin', RAMA])
} catch {
  existe = false
}
try {
  if (existe) {
    git(['worktree', 'add', '--detach', copia, `origin/${RAMA}`])
  } else {
    // Primera publicacion: una rama nueva sin historia.
    git(['worktree', 'add', '--detach', copia])
    git(['checkout', '--orphan', RAMA], copia)
    git(['rm', '-rfq', '--cached', '.'], copia)
  }

  // 3. Reemplazar el contenido por la pagina recien compilada.
  for (const nombre of fs.readdirSync(copia)) {
    if (nombre !== '.git') fs.rmSync(path.join(copia, nombre), { recursive: true, force: true })
  }
  fs.cpSync(compilada, copia, { recursive: true })
  // Sin este archivo, GitHub Pages procesa los archivos con Jekyll.
  fs.writeFileSync(path.join(copia, '.nojekyll'), '')

  // 4. Subir solo si algo cambio.
  git(['add', '-A'], copia)
  if (!git(['status', '--porcelain'], copia)) {
    console.log('La pagina publicada ya estaba al dia; no hay nada que subir.')
  } else {
    git(['commit', '-q', '-m', MENSAJE], copia)
    git(['push', 'origin', `HEAD:${RAMA}`], copia)
    console.log('Pagina publicada. GitHub la actualiza en uno o dos minutos:')
    console.log('https://1paul2.github.io/Generador-3D/')
  }
} finally {
  // 5. Quitar la copia de trabajo.
  try {
    git(['worktree', 'remove', '--force', copia])
  } catch {
    fs.rmSync(copia, { recursive: true, force: true })
  }
  git(['worktree', 'prune'])
}
