import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'node_modules/@reactor-team/js-sdk/dist/wasm')
const destination = resolve(root, 'public/assets/wasm')

mkdirSync(destination, { recursive: true })
for (const file of ['reactor_wasm.js', 'reactor_wasm_bg.wasm']) {
  copyFileSync(resolve(source, file), resolve(destination, file))
}

console.log('Synced Reactor browser WASM assets.')
