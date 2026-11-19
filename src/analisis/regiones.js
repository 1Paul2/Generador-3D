import { distancia, kmedias } from '../utils/kmedias.js'

// Identifica las partes del objeto por su color: agrupa los colores del objeto
// (en Lab, como los percibe el ojo) en hasta 6 regiones (por ejemplo, tronco y
// copa, o carroceria, vidrios y ruedas), junta las regiones casi iguales y
// limpia los pixeles sueltos para que cada parte quede como una zona pareja.
// Devuelve { etiquetas, paleta }: etiquetas dice a que region pertenece cada
// pixel (-1 si es fondo) y paleta trae el color (RGB y Lab) y el peso de cada region.

const REGIONES = 6
// Regiones mas parecidas que esto (en Lab) se juntan en una: si no, un degrade
// (como el borde difuso de una hoja) se parte en escalones de tonos casi iguales.
const MISMO_COLOR = 16
// Regiones chicas: si se parecen al fondo son restos que se colaron (pasto
// entre las patas), y si casi todos sus pixeles estan pegados al contorno son
// la orla donde el color del objeto se mezcla con el del fondo. Esas se unen a
// otra region; las demas son detalles (ojos, una franja) y se conservan, salvo
// que sean minimas.
const REGION_CHICA = 0.06
const REGION_MINIMA = 0.01
const PARECE_FONDO = 15
const ORLA = 2 // pixeles desde el contorno que se consideran orla
const MAYORIA_EN_ORLA = 0.6
// Un pixel es dudoso si la region mas cercana no es mucho mas cercana que la
// segunda (distancia a la primera / distancia a la segunda mayor que esto).
const DUDA = 0.7
const VENTANA_DUDA = 3 // radio de la ventana donde votan los vecinos seguros (7x7)
const MANCHA = 0.003 // pedazos sueltos mas chicos que esta parte del objeto se absorben

// Busca los pedazos conectados de cada region; los minusculos (salpicaduras)
// pasan a la region que mas los rodea.
function quitarManchas(etiquetas, indices, ancho, alto, minimo) {
  const visto = new Uint8Array(etiquetas.length)
  for (const inicio of indices) {
    if (visto[inicio]) continue
    const etiqueta = etiquetas[inicio]
    const pedazo = [inicio]
    const vecinas = new Map()
    visto[inicio] = 1
    for (let k = 0; k < pedazo.length; k++) {
      const i = pedazo[k]
      const [x, y] = [i % ancho, Math.floor(i / ancho)]
      const alrededor = [x > 0 && i - 1, x < ancho - 1 && i + 1, y > 0 && i - ancho, y < alto - 1 && i + ancho]
      for (const v of alrededor) {
        if (v === false || etiquetas[v] < 0) continue
        if (etiquetas[v] === etiqueta) {
          if (!visto[v]) {
            visto[v] = 1
            pedazo.push(v)
          }
        } else {
          vecinas.set(etiquetas[v], (vecinas.get(etiquetas[v]) ?? 0) + 1)
        }
      }
    }
    if (pedazo.length < minimo && vecinas.size) {
      const nueva = [...vecinas].sort((a, b) => b[1] - a[1])[0][0]
      for (const i of pedazo) etiquetas[i] = nueva
    }
  }
}

// Correccion - Poll: el borde difuso de la hoja salia como un laberinto de dos colores
export function identificarRegiones({ mascara, colores, lab, ancho, alto, fondo }) {
  const indices = []
  for (let i = 0; i < mascara.length; i++) if (mascara[i]) indices.push(i)
  const { centros, grupos } = kmedias(
    indices.map((i) => lab[i]),
    Math.min(REGIONES, indices.length),
  )

  // Junta regiones de color casi igual.
  const destino = centros.map((_, j) => j)
  for (let a = 0; a < centros.length; a++) {
    for (let b = 0; b < a; b++) {
      if (destino[b] === b && distancia(centros[a], centros[b]) < MISMO_COLOR) {
        destino[a] = b
        break
      }
    }
  }

  let etiquetas = new Int8Array(mascara.length).fill(-1)
  indices.forEach((i, n) => (etiquetas[i] = destino[grupos[n]]))

  // Suavizado segun la confianza: un pixel es dudoso si su color esta casi a
  // la misma distancia de dos regiones (pasa en los bordes difusos, donde el
  // color se mezcla). Los dudosos no deciden por su color sino por lo que
  // dicen sus vecinos seguros alrededor; los seguros (como una vena clara) no
  // se tocan, asi los detalles finos se conservan.
  const dudoso = new Uint8Array(mascara.length)
  for (const i of indices) {
    let [cerca, segunda] = [Infinity, Infinity]
    let [region, otra] = [-1, -1]
    centros.forEach((centro, j) => {
      const d = distancia(lab[i], centro)
      if (d < cerca) {
        ;[segunda, otra, cerca, region] = [cerca, region, d, j]
      } else if (d < segunda) {
        ;[segunda, otra] = [d, j]
      }
    })
    if (otra >= 0 && destino[region] !== destino[otra] && cerca / segunda > DUDA) dudoso[i] = 1
  }
  for (let pasada = 0; pasada < 2; pasada++) {
    const nuevas = etiquetas.slice()
    for (const i of indices) {
      if (!dudoso[i]) continue
      const [x, y] = [i % ancho, Math.floor(i / ancho)]
      const votos = new Map()
      for (let dy = -VENTANA_DUDA; dy <= VENTANA_DUDA; dy++) {
        for (let dx = -VENTANA_DUDA; dx <= VENTANA_DUDA; dx++) {
          const [xx, yy] = [x + dx, y + dy]
          if (xx < 0 || yy < 0 || xx >= ancho || yy >= alto) continue
          const j = yy * ancho + xx
          if (etiquetas[j] >= 0 && !dudoso[j]) votos.set(etiquetas[j], (votos.get(etiquetas[j]) ?? 0) + 1)
        }
      }
      if (votos.size) nuevas[i] = [...votos].sort((a, b) => b[1] - a[1])[0][0]
    }
    etiquetas = nuevas
  }

  // Limpieza: cada pixel del objeto toma la region que mas se repite a su alrededor.
  for (let pasada = 0; pasada < 2; pasada++) {
    const nuevas = etiquetas.slice()
    for (const i of indices) {
      const [x, y] = [i % ancho, Math.floor(i / ancho)]
      const votos = new Map()
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const [xx, yy] = [x + dx, y + dy]
          if (xx < 0 || yy < 0 || xx >= ancho || yy >= alto) continue
          const etiqueta = etiquetas[yy * ancho + xx]
          if (etiqueta >= 0) votos.set(etiqueta, (votos.get(etiqueta) ?? 0) + 1)
        }
      }
      nuevas[i] = [...votos].sort((a, b) => b[1] - a[1])[0][0]
    }
    etiquetas = nuevas
  }
  quitarManchas(etiquetas, indices, ancho, alto, Math.max(4, MANCHA * indices.length))

  // Las regiones que sobran (ver REGION_CHICA) se unen a la region de color
  // mas parecido.
  // Que parte de cada region esta en la orla del contorno.
  const enOrla = (i) => {
    const [x, y] = [i % ancho, Math.floor(i / ancho)]
    for (let dy = -ORLA; dy <= ORLA; dy++) {
      for (let dx = -ORLA; dx <= ORLA; dx++) {
        const [xx, yy] = [x + dx, y + dy]
        if (xx < 0 || yy < 0 || xx >= ancho || yy >= alto || !mascara[yy * ancho + xx]) return true
      }
    }
    return false
  }
  const orla = new Map()
  for (const i of indices) {
    const [cuenta, total] = orla.get(etiquetas[i]) ?? [0, 0]
    orla.set(etiquetas[i], [cuenta + (enOrla(i) ? 1 : 0), total + 1])
  }

  let paleta = colorPorRegion(etiquetas, indices, colores, lab)
  const sobra = ({ lab: color, peso }, etiqueta) => {
    if (peso < REGION_MINIMA) return true
    if (peso >= REGION_CHICA) return false
    const [cuenta, total] = orla.get(etiqueta)
    return cuenta / total > MAYORIA_EN_ORLA || fondo.some((centro) => distancia(centro, color) < PARECE_FONDO)
  }
  const sobrantes = new Set([...paleta].filter(([etiqueta, region]) => sobra(region, etiqueta)).map(([e]) => e))
  const grandes = [...paleta].filter(([etiqueta]) => !sobrantes.has(etiqueta))
  if (grandes.length && sobrantes.size) {
    for (const i of indices) {
      if (!sobrantes.has(etiquetas[i])) continue
      const region = paleta.get(etiquetas[i])
      etiquetas[i] = grandes.reduce((mejor, actual) =>
        distancia(actual[1].lab, region.lab) < distancia(mejor[1].lab, region.lab) ? actual : mejor,
      )[0]
    }
    paleta = colorPorRegion(etiquetas, indices, colores, lab)
  }
  return { etiquetas, paleta }
}

// Color de cada region (promedio real de sus pixeles, en RGB y en Lab) y que
// parte del objeto ocupa.
function colorPorRegion(etiquetas, indices, colores, lab) {
  const sumas = new Map()
  for (const i of indices) {
    const suma = sumas.get(etiquetas[i]) ?? [0, 0, 0, 0, 0, 0, 0]
    for (let c = 0; c < 3; c++) {
      suma[c] += colores[i][c]
      suma[c + 3] += lab[i][c]
    }
    suma[6]++
    sumas.set(etiquetas[i], suma)
  }
  return new Map(
    [...sumas].map(([etiqueta, suma]) => {
      const n = suma[6]
      return [
        etiqueta,
        {
          color: suma.slice(0, 3).map((v) => v / n),
          lab: suma.slice(3, 6).map((v) => v / n),
          peso: n / indices.length,
        },
      ]
    }),
  )
}
