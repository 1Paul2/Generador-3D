// Generador aleatorio con semilla (mulberry32): la misma semilla da
// siempre la misma secuencia, asi cada modelo es reproducible.
export function crearRandom(semilla) {
  let estado = semilla >>> 0
  return function () {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Convierte un texto en un numero para usarlo como semilla.
export function semillaDeTexto(texto) {
  let hash = 2166136261
  for (const letra of texto) {
    hash = Math.imul(hash ^ letra.charCodeAt(0), 16777619)
  }
  return hash >>> 0
}
