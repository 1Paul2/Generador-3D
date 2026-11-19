import * as THREE from 'three'
import { crearRuido } from '../utils/ruido.js'
import { erosionar } from './erosion.js'

// Paisajes generados como terreno real sobre una maqueta: un bloque cuadrado
// con el relieve arriba y capas de tierra a los costados.
//   1. Cada paisaje define su mapa de alturas con formulas y ruido.
//   2. La erosion hidraulica talla cauces y deja sedimento al pie.
//   3. Cada punto se pinta segun su altura, su pendiente, el agua que paso
//      por ahi y los rasgos leidos (nieve, lava, bosque, desierto).

export const TERRENOS = ['volcan', 'montana', 'colina', 'isla', 'duna']

const LADO = 30 // medida del bloque
const CELDAS = 192 // divisiones por lado
const ESPESOR = 2.5 // profundidad del bloque bajo el piso
const FILAS_COSTADO = 10
const GOTAS = 45000

// Colores [r, g, b] de 0 a 255.
const COLOR = {
  pasto: [92, 128, 60],
  bosque: [46, 84, 40],
  tierra: [124, 102, 76],
  roca: [116, 110, 104],
  basalto: [58, 54, 52],
  ceniza: [148, 142, 134],
  nieve: [240, 243, 248],
  arena: [216, 190, 138],
  arenaOscura: [176, 140, 92],
  lava: [255, 104, 24],
  lavaOscura: [120, 26, 10],
  agua: [36, 102, 148],
  estratoClaro: [128, 100, 72],
  estratoOscuro: [86, 66, 50],
}

const limitar = (x, a, b) => Math.min(b, Math.max(a, x))
const suave = (a, b, x) => {
  const t = limitar((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const mezclar = (c1, c2, t) => c1.map((valor, i) => valor + (c2[i] - valor) * t)

// Ruido de crestas multifractal: cada capa marca filos donde el ruido cruza
// la mitad, y las capas finas se suman sobre todo donde ya hay un filo.
function crestas(ruido, x, z) {
  let suma = 0
  let amplitud = 0.5
  let frecuencia = 1
  let peso = 1
  for (let capa = 0; capa < 5; capa++) {
    let n = 1 - Math.abs(2 * ruido(x * frecuencia, 11.3, z * frecuencia, 1) - 1)
    n *= n * peso
    peso = limitar(n * 2, 0, 1)
    suma += n * amplitud
    amplitud *= 0.5
    frecuencia *= 2
  }
  return suma
}

// Radio del crater, como fraccion del radio del volcan.
const CRATER = 0.14

// Mapas de alturas (entre 0 y 1) de cada paisaje. "r" es la distancia al
// centro dividida por el radio del paisaje. "tallar", si existe, se aplica
// despues de la erosion, para que el sedimento no tape lo que se talla.
const PAISAJES = {
  // Volcan: perfil concavo (laderas que se suavizan hacia la base), falda
  // ancha que se funde con el llano, quebradas radiales y, tras la erosion,
  // un crater con borde.
  volcan: {
    alto: 9,
    radio: 12,
    altura(x, z, r, ruido) {
      const cono = (q) => (q < 1 ? (1 - q) ** 1.7 : 0)
      let h = cono(Math.max(r, CRATER)) + 0.12 * Math.exp(-((r / 1.25) ** 2))

      const angulo = Math.atan2(z, x)
      const n = ruido(Math.cos(angulo) * 2.5 + 7, Math.sin(angulo) * 2.5 + 7, r * 3, 3)
      const quebrada = (1 - Math.abs(2 * n - 1)) ** 4
      h -= 0.08 * quebrada * suave(CRATER, 0.35, r) * (1 - suave(0.8, 1.1, r))
      h += 0.03 * (ruido(x * 0.35, 0, z * 0.35, 4) - 0.5)
      return h
    },
    tallar(h, r) {
      const hundido = r < CRATER ? 0.26 * (1 - (r / CRATER) ** 2) : 0
      return h - hundido + 0.035 * Math.exp(-(((r - CRATER) / 0.04) ** 2))
    },
  },
  // Montana: un macizo de crestas deformadas, mas alto en el centro.
  montana: {
    alto: 11,
    radio: 13,
    altura(x, z, r, ruido) {
      const mascara = 1 - suave(0.3, 1.05, r)
      const desvio = 2 * (ruido(x * 0.05, 5, z * 0.05, 3) - 0.5)
      const filos = crestas(ruido, x * 0.1 + desvio, z * 0.1 - desvio)
      return mascara ** 1.3 * (0.4 + 0.8 * filos) + 0.02 * ruido(x * 0.3, 1, z * 0.3, 4)
    },
  },
  // Colina: lomas suaves y redondeadas.
  colina: {
    alto: 5,
    radio: 13,
    altura(x, z, r, ruido) {
      return (1 - suave(0, 1, r)) ** 2 * (0.5 + 0.5 * ruido(x * 0.1, 2, z * 0.1, 4)) + 0.03
    },
  },
  // Isla: costa irregular (el radio cambia con el angulo) y relieve con filos;
  // las orillas quedan bajo el nivel del agua.
  isla: {
    alto: 7,
    radio: 11,
    agua: 0.14,
    altura(x, z, r, ruido) {
      const angulo = Math.atan2(z, x)
      const costa = r * (0.75 + 0.6 * ruido(Math.cos(angulo) * 1.5 + 3, Math.sin(angulo) * 1.5 + 3, 1, 3))
      const filos = crestas(ruido, x * 0.12, z * 0.12)
      return (1 - suave(0.05, 1, costa)) ** 1.4 * (0.5 + 0.6 * filos)
    },
  },
  // Dunas: ondas de arena que el viento desvia, por todo el bloque.
  duna: {
    alto: 6,
    radio: 20,
    desierto: true,
    altura(x, z, r, ruido) {
      const desvio = 3 * ruido(x * 0.05, 1, z * 0.05, 3)
      const onda = (0.5 + 0.5 * Math.sin(x * 0.45 + z * 0.15 + desvio * 2)) ** 2
      return 0.08 + 0.35 * onda * (0.6 + 0.6 * ruido(x * 0.08, 4, z * 0.08, 3))
    },
  },
}

// Tono del suelo en la foto: promedio de la mitad de abajo, sin el cielo
// (pixeles donde domina el azul).
function tonoDeFoto(imagen) {
  const suma = [0, 0, 0]
  let cuenta = 0
  for (let fila = Math.floor(imagen.alto * 0.45); fila < imagen.alto; fila++) {
    for (let columna = 0; columna < imagen.ancho; columna++) {
      const p = (fila * imagen.ancho + columna) * 4
      const [r, g, b] = [imagen.pixeles[p], imagen.pixeles[p + 1], imagen.pixeles[p + 2]]
      if (b > r * 1.1 && b > g) continue
      suma[0] += r
      suma[1] += g
      suma[2] += b
      cuenta++
    }
  }
  return cuenta ? suma.map((valor) => valor / cuenta) : null
}

function colorHex(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

// Elige el color de un punto del terreno.
//   alt: altura relativa (0 a 1), pendiente: subida por unidad de avance,
//   cauce: cuanta agua paso (0 a 1), variacion: ruido para que los limites
//   entre colores no sean lineas rectas.
//   crater: alturas reales del fondo y del borde del crater (solo volcanes).
function colorDelSuelo(tipo, paleta, rasgos, punto) {
  const { alt, pendiente, cauce, variacion, r, nivelAgua, crater } = punto
  const a = alt + variacion
  const desierto = rasgos.desierto || PAISAJES[tipo].desierto
  const verde = desierto ? paleta.arenaOscura : rasgos.bosque ? COLOR.bosque : COLOR.pasto
  let color

  if (tipo === 'duna') {
    color = mezclar(paleta.arena, paleta.arenaOscura, suave(0.3, 0.9, pendiente) * 0.7 + (1 - a) * 0.2)
  } else if (tipo === 'volcan') {
    color = mezclar(verde, paleta.tierra, suave(0.06, 0.16, a))
    color = mezclar(color, paleta.basalto, suave(0.14, 0.32, a))
    color = mezclar(color, paleta.ceniza, suave(0.5, 0.8, a) * 0.7)
  } else {
    color = mezclar(verde, paleta.tierra, suave(0.22, 0.42, a))
    color = mezclar(color, paleta.roca, suave(0.4, 0.62, a))
  }

  // Las paredes empinadas son roca expuesta: ahi no se sostiene la tierra.
  if (tipo !== 'duna') {
    const piedra = tipo === 'volcan' ? paleta.basalto : paleta.roca
    color = mezclar(color, piedra, suave(0.9, 1.8, pendiente) * 0.85)
  }
  // Por los cauces corrio agua: el suelo queda mas oscuro y humedo.
  color = mezclar(color, color.map((valor) => valor * 0.6), cauce * 0.5)

  // Nieve en las cumbres; no se sostiene en las paredes casi verticales.
  const conNieve = rasgos.nieve || (tipo === 'montana' && !desierto)
  if (conNieve) {
    const linea = 0.6
    color = mezclar(color, COLOR.nieve, suave(linea, linea + 0.1, a) * (1 - suave(2, 3.2, pendiente)))
  }
  // Fondo del crater: lava si el volcan esta activo, roca oscura si no.
  if (crater && r < CRATER) {
    const fondo = 1 - suave(crater.fondo, crater.fondo + 0.5 * (crater.borde - crater.fondo), alt)
    const lava = rasgos.activo ? mezclar(COLOR.lavaOscura, COLOR.lava, fondo) : paleta.basalto
    color = mezclar(color, lava, fondo)
  }
  // Arena en la orilla de una isla.
  if (nivelAgua !== null) color = mezclar(color, paleta.arena, 1 - suave(nivelAgua + 0.01, nivelAgua + 0.06, alt))

  return color
}

export function crearTerreno(receta, apariencia, random) {
  const paisaje = PAISAJES[receta.tipo]
  const rasgos = { ...receta.rasgos, isla: receta.rasgos?.isla || receta.tipo === 'isla' }
  const ruido = crearRuido(random)
  const n = CELDAS + 1
  const celda = LADO / CELDAS

  // Altura: segun el paisaje, el tamano pedido y la altitud leida (si la hay).
  const porAltitud = rasgos.altitud ? limitar(Math.sqrt(rasgos.altitud / 3000), 0.75, 1.4) : 1
  const alto = paisaje.alto * receta.tamano * porAltitud
  const radio = paisaje.radio * Math.min(receta.tamano, 1.2)
  const nivelAgua = paisaje.agua ?? (rasgos.isla ? 0.12 : null)

  // 1. Mapa de alturas.
  const alturas = new Float32Array(n * n)
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const [x, z] = [-LADO / 2 + ix * celda, -LADO / 2 + iz * celda]
      alturas[iz * n + ix] = Math.max(0, paisaje.altura(x, z, Math.hypot(x, z) / radio, ruido))
    }
  }

  // 2. Erosion, y despues lo que se talla encima (el crater).
  const flujo = erosionar(alturas, n, random, GOTAS)
  const flujoMaximo = flujo.reduce((maximo, valor) => Math.max(maximo, valor), 1)
  const distancia = (ix, iz) => Math.hypot(-LADO / 2 + ix * celda, -LADO / 2 + iz * celda) / radio
  if (paisaje.tallar) {
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix
        alturas[i] = Math.max(0, paisaje.tallar(alturas[i], distancia(ix, iz)))
      }
    }
  }

  // Fondo y borde reales del crater, para ubicar la lava.
  let crater = null
  if (receta.tipo === 'volcan') {
    crater = { fondo: Infinity, borde: 0 }
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const r = distancia(ix, iz)
        if (r < CRATER * 0.6) crater.fondo = Math.min(crater.fondo, alturas[iz * n + ix])
        if (r < CRATER * 1.4) crater.borde = Math.max(crater.borde, alturas[iz * n + ix])
      }
    }
  }

  // 3. Color de cada punto.
  const tinte = receta.colorElegido
    ? colorHex(receta.color)
    : apariencia.imagen
      ? tonoDeFoto(apariencia.imagen)
      : null
  const tenir = (base, cuanto) => (tinte ? mezclar(base, tinte, cuanto) : base)
  const paleta = {
    tierra: tenir(COLOR.tierra, 0.35),
    roca: tenir(COLOR.roca, 0.35),
    basalto: tenir(COLOR.basalto, 0.2),
    ceniza: tenir(COLOR.ceniza, 0.25),
    arena: tenir(COLOR.arena, 0.2),
    arenaOscura: tenir(COLOR.arenaOscura, 0.2),
  }

  const posiciones = []
  const colores = []
  const indices = []
  const color = new THREE.Color()
  function vertice(x, y, z, rgb) {
    posiciones.push(x, y, z)
    color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace)
    colores.push(color.r, color.g, color.b)
    return posiciones.length / 3 - 1
  }

  const alturaEn = (ix, iz) => alturas[limitar(iz, 0, n - 1) * n + limitar(ix, 0, n - 1)]
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const [x, z] = [-LADO / 2 + ix * celda, -LADO / 2 + iz * celda]
      const h = alturaEn(ix, iz)
      const pendiente =
        (Math.hypot(alturaEn(ix + 1, iz) - alturaEn(ix - 1, iz), alturaEn(ix, iz + 1) - alturaEn(ix, iz - 1)) * alto) /
        (2 * celda)
      const rgb = colorDelSuelo(receta.tipo, paleta, rasgos, {
        alt: h,
        pendiente,
        cauce: Math.sqrt(flujo[iz * n + ix] / flujoMaximo),
        variacion: 0.08 * (ruido(x * 0.4, 7, z * 0.4, 3) - 0.5),
        r: Math.hypot(x, z) / radio,
        nivelAgua,
        crater,
      })
      vertice(x, h * alto, z, rgb)
    }
  }
  for (let iz = 0; iz < CELDAS; iz++) {
    for (let ix = 0; ix < CELDAS; ix++) {
      const a = iz * n + ix
      indices.push(a, a + n, a + 1, a + 1, a + n, a + n + 1)
    }
  }

  // Agua: una superficie plana a la altura del mar; lo que sobresale es tierra.
  const alturaAgua = nivelAgua !== null ? nivelAgua * alto : null
  if (alturaAgua !== null) {
    const m = LADO / 2
    const [a, b, c, d] = [
      vertice(-m, alturaAgua, -m, COLOR.agua),
      vertice(m, alturaAgua, -m, COLOR.agua),
      vertice(m, alturaAgua, m, COLOR.agua),
      vertice(-m, alturaAgua, m, COLOR.agua),
    ]
    indices.push(a, d, c, a, c, b)
  }

  // Costados de la maqueta: capas de tierra (y agua arriba, si la hay), de la
  // superficie hasta el fondo del bloque. Se recorren los cuatro bordes en orden
  // para que las caras miren hacia afuera.
  const bordes = [
    Array.from({ length: n }, (_, i) => [i, CELDAS]),
    Array.from({ length: n }, (_, i) => [CELDAS, CELDAS - i]),
    Array.from({ length: n }, (_, i) => [CELDAS - i, 0]),
    Array.from({ length: n }, (_, i) => [0, i]),
  ]
  for (const borde of bordes) {
    const columnas = borde.map(([ix, iz]) => {
      const [x, z] = [-LADO / 2 + ix * celda, -LADO / 2 + iz * celda]
      const suelo = alturaEn(ix, iz) * alto
      const arriba = Math.max(suelo, alturaAgua ?? -Infinity)
      return Array.from({ length: FILAS_COSTADO + 1 }, (_, fila) => {
        const y = arriba - ((arriba + ESPESOR) * fila) / FILAS_COSTADO
        const estrato = 0.5 + 0.5 * Math.sin(y * 2.2 + 3 * ruido(x * 0.2, y * 0.3, z * 0.2, 2))
        const tierra = mezclar(COLOR.estratoOscuro, COLOR.estratoClaro, estrato)
        return vertice(x, y, z, y > suelo + 1e-3 ? COLOR.agua : tierra)
      })
    })
    for (let i = 0; i < columnas.length - 1; i++) {
      for (let fila = 0; fila < FILAS_COSTADO; fila++) {
        const [a, b] = [columnas[i][fila], columnas[i][fila + 1]]
        const [c, d] = [columnas[i + 1][fila], columnas[i + 1][fila + 1]]
        indices.push(a, b, c, c, b, d)
      }
    }
  }

  // Fondo del bloque.
  const m = LADO / 2
  const [a, b, c, d] = [
    vertice(-m, -ESPESOR, -m, COLOR.estratoOscuro),
    vertice(m, -ESPESOR, -m, COLOR.estratoOscuro),
    vertice(m, -ESPESOR, m, COLOR.estratoOscuro),
    vertice(-m, -ESPESOR, m, COLOR.estratoOscuro),
  ]
  indices.push(a, b, c, a, c, d)

  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3))
  geometria.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3))
  geometria.setIndex(indices)
  geometria.computeVertexNormals()
  geometria.computeBoundingBox()
  return { geometria, altura: geometria.boundingBox.max.y }
}
