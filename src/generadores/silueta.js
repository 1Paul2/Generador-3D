import * as THREE from 'three'
import { colorearPorPixel } from '../analisis/colores.js'
import { aplicarOclusion, calcularOclusion } from './oclusion.js'

// Construye un objeto en 3D a partir de su silueta y sus regiones de color,
// identificadas en una foto. No se copia ningun pixel de la foto: se usa la
// forma del contorno y el color promedio de cada parte.
//
// Segun el volumen de la cosa (leido del texto) y su silueta se elige el metodo:
//   - Torno: solo para cosas que son iguales desde todos los lados (botella,
//     jarron, lampara) y cuya silueta es simetrica. Cada fila de la silueta se
//     hace girar alrededor de su centro, como en un torno de alfarero. El
//     centro de cada fila se respeta, asi una forma inclinada sigue inclinada.
//   - Inflado: para todo lo demas. La silueta se infla como un globo: cada
//     punto se levanta segun que tan lejos esta del borde, con el perfil de un
//     circulo, asi se respeta el contorno exacto. Las cosas planas (una hoja,
//     una senal) quedan como una lamina de grosor parejo.
// Que una silueta sea simetrica no alcanza para usar el torno: una hoja o un
// escudo son simetricos pero planos.

const MEDIDA = 14 // medida mas grande del objeto armado
const LADOS = 64 // divisiones alrededor del eje en el torno
// Que tan grueso queda el inflado comparado con un circulo.
const GROSOR = 0.85
// Medio grosor de una lamina (hoja, bandera), como fraccion de su medida mas grande.
const LAMINA = 0.006
const SUAVIZADO = 3 // pasadas para borrar los escalones de los pixeles
const ANCHO_SURCO = 2 // pixeles a cada lado de la junta entre dos partes
const PROFUNDIDAD_SURCO = 0.12 // cuanto se hunde la junta, como fraccion de la altura

// Rectangulo que encierra al objeto en la mascara.
function encuadrar({ mascara, ancho, alto }) {
  const caja = { x0: ancho, y0: alto, x1: -1, y1: -1 }
  for (let i = 0; i < mascara.length; i++) {
    if (!mascara[i]) continue
    const [x, y] = [i % ancho, Math.floor(i / ancho)]
    caja.x0 = Math.min(caja.x0, x)
    caja.y0 = Math.min(caja.y0, y)
    caja.x1 = Math.max(caja.x1, x)
    caja.y1 = Math.max(caja.y1, y)
  }
  return { ...caja, ancho: caja.x1 - caja.x0 + 1, alto: caja.y1 - caja.y0 + 1 }
}

// Que tan simetrica es la silueta respecto de su eje vertical (1 = espejo
// perfecto) y que parte de las filas tiene el objeto cortado en dos o mas
// tramos (como las piernas de una persona).
function medirSimetria({ mascara, ancho }, caja) {
  let suma = 0
  let cuenta = 0
  for (let i = 0; i < mascara.length; i++) {
    if (mascara[i]) {
      suma += i % ancho
      cuenta++
    }
  }
  const eje = suma / cuenta
  let ambos = 0
  let alguno = 0
  let filasPartidas = 0
  for (let y = caja.y0; y <= caja.y1; y++) {
    let tramos = 0
    for (let x = caja.x0; x <= caja.x1; x++) {
      const aca = mascara[y * ancho + x]
      const espejo = Math.round(2 * eje - x)
      const otro = espejo >= 0 && espejo < ancho ? mascara[y * ancho + espejo] : 0
      if (aca && otro) ambos++
      if (aca || otro) alguno++
      if (aca && (x === caja.x0 || !mascara[y * ancho + x - 1])) tramos++
    }
    if (tramos > 1) filasPartidas++
  }
  return { parecido: ambos / alguno, partidas: filasPartidas / caja.alto }
}

function armarGeometria(posiciones, colores, indices) {
  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3))
  geometria.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3))
  geometria.setIndex(indices)
  return geometria
}

function tornear(segmento, caja, escala, colorDe) {
  const { mascara, ancho } = segmento
  // Extremos izquierdo y derecho de cada fila, de abajo hacia arriba.
  const filas = []
  for (let y = caja.y1; y >= caja.y0; y--) {
    let [izquierda, derecha] = [Infinity, -Infinity]
    for (let x = caja.x0; x <= caja.x1; x++) {
      if (mascara[y * ancho + x]) {
        izquierda = Math.min(izquierda, x)
        derecha = Math.max(derecha, x)
      }
    }
    filas.push({ y, centro: (izquierda + derecha) / 2, radio: (derecha - izquierda + 1) / 2 })
  }
  // Suaviza radio y centro con sus filas vecinas para que el perfil no tenga escalones.
  const suaves = filas.map((fila, j) => {
    const vecinas = filas.slice(Math.max(0, j - 2), j + 3)
    return {
      ...fila,
      centro: vecinas.reduce((s, f) => s + f.centro, 0) / vecinas.length,
      radio: vecinas.reduce((s, f) => s + f.radio, 0) / vecinas.length,
    }
  })

  const ejeX = (caja.x0 + caja.x1) / 2
  const posiciones = []
  const colores = []
  const indices = []
  suaves.forEach((fila, j) => {
    for (let k = 0; k < LADOS; k++) {
      const angulo = (k / LADOS) * Math.PI * 2
      posiciones.push(
        (fila.centro - ejeX + fila.radio * Math.cos(angulo)) * escala,
        j * escala,
        fila.radio * Math.sin(angulo) * escala,
      )
      colores.push(...colorDe(Math.round(fila.centro + fila.radio * Math.cos(angulo)), fila.y))
    }
  })
  for (let j = 0; j < suaves.length - 1; j++) {
    for (let k = 0; k < LADOS; k++) {
      const [a, c] = [j * LADOS + k, j * LADOS + ((k + 1) % LADOS)]
      const [b, d] = [a + LADOS, c + LADOS]
      indices.push(a, b, c, c, b, d)
    }
  }
  // Tapas de abajo y de arriba.
  for (const [j, haciaArriba] of [
    [0, false],
    [suaves.length - 1, true],
  ]) {
    const fila = suaves[j]
    const centro = posiciones.length / 3
    posiciones.push((fila.centro - ejeX) * escala, j * escala, 0)
    colores.push(...colorDe(Math.round(fila.centro), fila.y))
    for (let k = 0; k < LADOS; k++) {
      const [p, q] = [j * LADOS + k, j * LADOS + ((k + 1) % LADOS)]
      if (haciaArriba) indices.push(centro, q, p)
      else indices.push(centro, p, q)
    }
  }
  return armarGeometria(posiciones, colores, indices)
}

// Distancia de cada pixel del objeto al borde (aproximacion chamfer: dos
// pasadas, una de arriba a abajo y otra al reves, con costo 3 en recto y 4 en diagonal).
function distanciaAlBorde(dentro, ancho, alto) {
  const d = new Float32Array(ancho * alto)
  for (let i = 0; i < d.length; i++) d[i] = dentro[i] ? 1e9 : 0
  const pasos = [
    [-1, 0, 3],
    [0, -1, 3],
    [-1, -1, 4],
    [1, -1, 4],
  ]
  const valor = (x, y) => (x < 0 || y < 0 || x >= ancho || y >= alto ? 0 : d[y * ancho + x])
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      for (const [dx, dy, costo] of pasos) d[i] = Math.min(d[i], valor(x + dx, y + dy) + costo)
    }
  }
  for (let y = alto - 1; y >= 0; y--) {
    for (let x = ancho - 1; x >= 0; x--) {
      const i = y * ancho + x
      for (const [dx, dy, costo] of pasos) d[i] = Math.min(d[i], valor(x - dx, y - dy) + costo)
    }
  }
  return d.map((valor) => valor / 3)
}

// Promedia cada vertice con sus vecinos unas pasadas, para que el contorno
// no muestre los escalones de los pixeles.
function suavizarMalla(posiciones, indices) {
  const cantidad = posiciones.length / 3
  const vecinos = Array.from({ length: cantidad }, () => new Set())
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]]
    vecinos[a].add(b).add(c)
    vecinos[b].add(a).add(c)
    vecinos[c].add(a).add(b)
  }
  for (let pasada = 0; pasada < SUAVIZADO; pasada++) {
    const copia = posiciones.slice()
    for (let v = 0; v < cantidad; v++) {
      if (!vecinos[v].size) continue
      for (let eje = 0; eje < 3; eje++) {
        let suma = 0
        for (const n of vecinos[v]) suma += copia[n * 3 + eje]
        posiciones[v * 3 + eje] = copia[v * 3 + eje] * 0.5 + (suma / vecinos[v].size) * 0.5
      }
    }
  }
}

// Altura del inflado en cada pixel, como union de esferas sobre el eje medial:
//   1. El eje medial es el "esqueleto" de la silueta: los pixeles que estan
//      mas lejos del borde que todos sus vecinos (la linea central de cada parte).
//   2. En cada punto del eje se pone una esfera del tamano de esa parte (su
//      distancia al borde). La altura de cada pixel es la de la esfera mas
//      alta que lo cubre.
// Asi cada parte tiene su propio grosor: una pata fina queda fina y el cuerpo
// grueso queda grueso, en lugar de inflar todo con el mismo radio.
// Correccion - Poll: partes que se ensanchan quedaban sin altura en su linea central y el objeto se rajaba
function alturasPorEsferas(dentro, distancias, ancho, alto) {
  const alturas = new Float32Array(dentro.length)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      const r = distancias[i]
      if (!dentro[i] || r < 1.5) continue
      let esEje = true
      for (let dy = -1; dy <= 1 && esEje; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const [xx, yy] = [x + dx, y + dy]
          if (xx >= 0 && yy >= 0 && xx < ancho && yy < alto && distancias[yy * ancho + xx] > r) {
            esEje = false
            break
          }
        }
      }
      if (!esEje) continue

      const alcance = Math.ceil(r)
      for (let yy = Math.max(0, y - alcance); yy <= Math.min(alto - 1, y + alcance); yy++) {
        for (let xx = Math.max(0, x - alcance); xx <= Math.min(ancho - 1, x + alcance); xx++) {
          const j = yy * ancho + xx
          const lejos = (xx - x) ** 2 + (yy - y) ** 2
          if (dentro[j] && lejos < r * r) alturas[j] = Math.max(alturas[j], Math.sqrt(r * r - lejos))
        }
      }
    }
  }
  for (let i = 0; i < alturas.length; i++) {
    // Cada pixel es, como minimo, el centro de su propia esfera. Sin esto, la
    // linea central de una parte que se ensancha (una pata hacia el cuerpo) no
    // cuenta como eje, queda sin altura y el objeto se raja ahi.
    if (dentro[i]) alturas[i] = Math.max(alturas[i], distancias[i])
    // El borde queda en cero para que el frente y la espalda se cierren.
    if (distancias[i] <= 1) alturas[i] = 0
  }
  return alturas
}

// Surcos entre partes: donde cambia la region de color (vidrio y carroceria,
// cuello y cuerpo) la superficie se hunde un poco, como una junta real.
function marcarSurcos(alturas, dentro, ancho, alto, regionDe) {
  const lejania = new Float32Array(alturas.length).fill(Infinity)
  const cola = []
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      if (!dentro[i]) continue
      const propia = regionDe(x, y)
      const otra =
        (x + 1 < ancho && dentro[i + 1] && regionDe(x + 1, y) !== propia) ||
        (y + 1 < alto && dentro[i + ancho] && regionDe(x, y + 1) !== propia)
      if (otra) {
        lejania[i] = 0
        cola.push(i)
      }
    }
  }
  // Distancia a la junta mas cercana, recorriendo de a un pixel hasta ANCHO_SURCO.
  for (let paso = 0; paso < cola.length; paso++) {
    const i = cola[paso]
    if (lejania[i] >= ANCHO_SURCO) continue
    for (const v of [i - 1, i + 1, i - ancho, i + ancho]) {
      if (v >= 0 && v < alturas.length && dentro[v] && lejania[v] === Infinity) {
        lejania[v] = lejania[i] + 1
        cola.push(v)
      }
    }
  }
  for (let i = 0; i < alturas.length; i++) {
    if (lejania[i] <= ANCHO_SURCO) alturas[i] *= 1 - PROFUNDIDAD_SURCO * (1 - lejania[i] / (ANCHO_SURCO + 1))
  }
}

// Una cosa plana (lamina) tiene el mismo grosor en toda su superficie, salvo
// el borde, que se cierra. Inflarla con esferas la abombaba en el centro y,
// donde es angosta (la punta de una hoja), el frente y la espalda quedaban
// tan pegados que se cruzaban y se veia una rejilla.
// Correccion - Poll: las laminas salian abombadas y con una rejilla en las partes angostas
// Correccion - Poll: el frente y la espalda se pegaban en cualquier pixel sin altura, no solo en el borde
function inflar(segmento, caja, escala, colorDe, regionDe, plano) {
  const { ancho, alto } = caja
  const dentro = new Uint8Array(ancho * alto)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      dentro[y * ancho + x] = segmento.mascara[(y + caja.y0) * segmento.ancho + x + caja.x0]
    }
  }
  const distancias = distanciaAlBorde(dentro, ancho, alto)
  let levantar
  if (plano) {
    const lamina = LAMINA * Math.max(ancho, alto)
    levantar = (i) => (distancias[i] <= 1 ? 0 : lamina)
  } else {
    const alturas = alturasPorEsferas(dentro, distancias, ancho, alto)
    marcarSurcos(alturas, dentro, ancho, alto, (x, y) => regionDe(x + caja.x0, y + caja.y0))
    levantar = (i) => GROSOR * alturas[i]
  }

  const posiciones = []
  const colores = []
  const frente = new Int32Array(ancho * alto).fill(-1)
  const atras = new Int32Array(ancho * alto).fill(-1)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      if (!dentro[i]) continue
      const z = levantar(i)
      const color = colorDe(x + caja.x0, y + caja.y0)
      const [px, py] = [(x - ancho / 2) * escala, (alto - 1 - y) * escala]
      frente[i] = posiciones.length / 3
      posiciones.push(px, py, z * escala)
      colores.push(...color)
      // Solo en el borde real el frente y la espalda comparten el vertice, asi
      // se cierran; adentro siempre van separados.
      if (distancias[i] <= 1) {
        atras[i] = frente[i]
      } else {
        atras[i] = posiciones.length / 3
        posiciones.push(px, py, -z * escala)
        colores.push(...color)
      }
    }
  }

  // Dos triangulos por cada cuadrado de 4 pixeles del objeto (o uno, si solo
  // hay 3), en el frente mirando hacia adelante y en la espalda hacia atras.
  const indices = []
  const triangulo = (a, b, c) => {
    indices.push(frente[a], frente[b], frente[c])
    indices.push(atras[a], atras[c], atras[b])
  }
  for (let y = 0; y < alto - 1; y++) {
    for (let x = 0; x < ancho - 1; x++) {
      const [a, b, c, d] = [y * ancho + x, y * ancho + x + 1, (y + 1) * ancho + x, (y + 1) * ancho + x + 1]
      const [ea, eb, ec, ed] = [dentro[a], dentro[b], dentro[c], dentro[d]]
      if (ea && eb && ec && ed) {
        triangulo(a, c, b)
        triangulo(b, c, d)
      } else if (eb && ec && ed) triangulo(b, c, d)
      else if (ea && ec && ed) triangulo(a, c, d)
      else if (ea && eb && ed) triangulo(a, d, b)
      else if (ea && eb && ec) triangulo(a, c, b)
    }
  }
  suavizarMalla(posiciones, indices)
  return armarGeometria(posiciones, colores, indices)
}

function luminancia([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// segmento: resultado de segmentar(); regiones: resultado de identificarRegiones().
// Correccion - Poll: una silueta simetrica (como una hoja) se giraba en el torno y salia redonda
// Correccion - Poll: el color se pintaba por regiones y se perdia el detalle; ahora va pixel por pixel
export function crearDesdeSilueta(segmento, regiones, receta) {
  const caja = encuadrar(segmento)
  const escala = (MEDIDA * receta.tamano) / Math.max(caja.ancho, caja.alto)
  const { ancho, mascara } = segmento

  // Color propio de cada pixel (ver colorearPorPixel). Si el usuario pidio un
  // color, cada pixel toma ese color con su misma luz: las partes oscuras
  // siguen oscuras y las vetas claras siguen claras.
  const porPixel = colorearPorPixel(segmento)
  const elegido = receta.colorElegido
    ? [1, 3, 5].map((i) => parseInt(receta.color.slice(i, i + 2), 16))
    : null
  let promedioLuz = 0
  let cuenta = 0
  for (let i = 0; i < mascara.length; i++) {
    if (!mascara[i]) continue
    promedioLuz += luminancia(porPixel.subarray(i * 3, i * 3 + 3))
    cuenta++
  }
  promedioLuz /= Math.max(1, cuenta)
  const color = new THREE.Color()

  // Color de un pixel del objeto; fuera de la mascara (puede pasar en el
  // torno) se usa el pixel del objeto mas cercano en la misma fila.
  function colorDe(x, y) {
    let i = y * ancho + x
    for (let paso = 1; !mascara[i] && paso < ancho; paso++) {
      if (x - paso >= 0 && mascara[i - paso]) i -= paso
      else if (x + paso < ancho && mascara[i + paso]) i += paso
    }
    let rgb = porPixel.subarray(i * 3, i * 3 + 3)
    if (elegido) rgb = elegido.map((v) => Math.min(255, (v * luminancia(rgb)) / Math.max(1, promedioLuz)))
    color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace)
    return [color.r, color.g, color.b]
  }

  const volumen = receta.rasgos?.volumen
  const { parecido, partidas } = medirSimetria(segmento, caja)
  const metodo =
    volumen === 'giratorio' && parecido > 0.75 && partidas < 0.15
      ? 'torno'
      : volumen === 'plano'
        ? 'plano'
        : 'inflado'
  const regionDe = (x, y) => regiones.etiquetas[y * segmento.ancho + x]
  const geometria =
    metodo === 'torno'
      ? tornear(segmento, caja, escala, colorDe)
      : inflar(segmento, caja, escala, colorDe, regionDe, metodo === 'plano')
  geometria.computeVertexNormals()
  aplicarOclusion(geometria, calcularOclusion(geometria))
  geometria.computeBoundingBox()
  geometria.translate(0, -geometria.boundingBox.min.y, 0)
  geometria.computeBoundingBox()
  return { geometria, altura: geometria.boundingBox.max.y, metodo }
}
