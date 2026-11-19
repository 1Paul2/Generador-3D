import * as THREE from 'three'
import { crearRuido } from '../utils/ruido.js'
import { aplicarAntes, aplicarDespues } from './entornos.js'
import { erosionar } from './erosion.js'

// Entornos generados como terreno real sobre una maqueta: un bloque cuadrado
// con el relieve arriba y capas de tierra a los costados.
//   1. Un relieve base (llano, meseta, colina, montana, volcan, isla, dunas).
//   2. Elementos que se combinan en cualquier orden (acantilado, costa, rio,
//      cascada, lago, canon, bosque), segun el tipo de entorno y lo que dice
//      el texto: "montana con lago" o "desierto con canon y rio".
//   3. La erosion hidraulica talla cauces y deja sedimento al pie.
//   4. Cada punto se pinta segun su altura, su pendiente, el agua y los rasgos.
//   5. El agua es una superficie propia: plana en lagos y mares, inclinada en
//      rios y casi vertical, blanca de espuma, en las cascadas.

const LADO = 30 // medida del bloque
const CELDAS = 192 // divisiones por lado
const ESPESOR = 2.5 // profundidad del bloque bajo el piso
const FILAS_COSTADO = 10
const GOTAS = 45000
const ARBOLES = 70

// Colores [r, g, b] de 0 a 255.
const COLOR = {
  pasto: [92, 128, 60],
  bosque: [46, 84, 40],
  tierra: [124, 102, 76],
  tierraMojada: [72, 62, 50],
  roca: [116, 110, 104],
  basalto: [58, 54, 52],
  ceniza: [148, 142, 134],
  nieve: [240, 243, 248],
  arena: [216, 190, 138],
  arenaOscura: [176, 140, 92],
  lava: [255, 104, 24],
  lavaOscura: [120, 26, 10],
  agua: [36, 102, 148],
  aguaClara: [70, 150, 160],
  espuma: [235, 245, 250],
  estratoClaro: [128, 100, 72],
  estratoOscuro: [86, 66, 50],
  canonClaro: [196, 120, 78],
  canonOscuro: [140, 76, 48],
  corteza: [92, 66, 44],
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

// Relieves base: mapas de alturas (entre 0 y 1). "r" es la distancia al
// centro dividida por el radio del paisaje. "tallar", si existe, se aplica
// despues de la erosion, para que el sedimento no tape lo que se talla.
// "pico" indica que el relieve sube en el centro (los rios lo rodean).
const PAISAJES = {
  // Volcan: perfil concavo, falda ancha, quebradas radiales y crater.
  volcan: {
    alto: 9,
    radio: 12,
    pico: true,
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
    pico: true,
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
  // Isla: costa irregular y relieve con filos; las orillas quedan bajo el agua.
  isla: {
    alto: 7,
    radio: 11,
    agua: 0.14,
    pico: true,
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
  // Llano: terreno casi plano con ondulaciones suaves.
  llano: {
    alto: 5,
    radio: 20,
    altura(x, z, r, ruido) {
      return 0.12 + 0.12 * ruido(x * 0.07, 6, z * 0.07, 4)
    },
  },
  // Meseta: llano alto, donde un canon puede hundirse mucho.
  meseta: {
    alto: 8,
    radio: 20,
    altura(x, z, r, ruido) {
      return 0.75 + 0.06 * ruido(x * 0.08, 8, z * 0.08, 4)
    },
  },
}

// Entornos compuestos: un relieve base y los elementos que lo forman.
// Los elementos que pida el texto se suman a estos.
const ENTORNOS = {
  cascada: { base: 'colina', elementos: ['acantilado', 'rio', 'poza', 'bosque'] },
  rio: { base: 'llano', elementos: ['rio', 'bosque'] },
  lago: { base: 'colina', elementos: ['lago', 'bosque'] },
  canon: { base: 'meseta', elementos: ['canon', 'rio'], desierto: true },
  acantilado: { base: 'llano', elementos: ['acantilado'] },
  costa: { base: 'llano', elementos: ['mar'] },
}

export const TERRENOS = [...Object.keys(PAISAJES), ...Object.keys(ENTORNOS)]

// Una cascada pedida en el texto es un acantilado, un rio y una poza.
function expandir(elementos) {
  const todos = new Set(elementos)
  if (todos.has('cascada')) ['acantilado', 'rio', 'poza'].forEach((e) => todos.add(e))
  if (todos.has('canon')) todos.add('rio')
  todos.delete('cascada')
  return todos
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
//   cauce: cuanta agua de lluvia paso (0 a 1), variacion: ruido para que los
//   limites entre colores no sean lineas rectas, mojado: cercania al agua
//   (1 = bajo el agua), crater: alturas reales del fondo y borde del crater.
function colorDelSuelo(base, entorno, paleta, rasgos, punto) {
  const { alt, pendiente, cauce, variacion, r, nivelAgua, crater, mojado } = punto
  const a = alt + variacion
  const desierto = rasgos.desierto || PAISAJES[base].desierto || entorno.desierto
  const verde = desierto ? paleta.arenaOscura : rasgos.bosque || entorno.bosque ? COLOR.bosque : COLOR.pasto
  let color

  if (base === 'duna') {
    color = mezclar(paleta.arena, paleta.arenaOscura, suave(0.3, 0.9, pendiente) * 0.7 + (1 - a) * 0.2)
  } else if (base === 'volcan') {
    color = mezclar(verde, paleta.tierra, suave(0.06, 0.16, a))
    color = mezclar(color, paleta.basalto, suave(0.14, 0.32, a))
    color = mezclar(color, paleta.ceniza, suave(0.5, 0.8, a) * 0.7)
  } else if (base === 'meseta') {
    color = mezclar(paleta.arenaOscura, paleta.tierra, 0.4)
  } else {
    color = mezclar(verde, paleta.tierra, suave(0.22, 0.42, a))
    color = mezclar(color, paleta.roca, suave(0.4, 0.62, a))
  }

  // Las paredes empinadas son roca expuesta: ahi no se sostiene la tierra.
  // En un canon la roca muestra sus capas (estratos) de tonos rojizos.
  if (base !== 'duna') {
    let piedra = base === 'volcan' ? paleta.basalto : paleta.roca
    if (entorno.canon) piedra = mezclar(COLOR.canonOscuro, COLOR.canonClaro, 0.5 + 0.5 * Math.sin(a * 45))
    color = mezclar(color, piedra, suave(0.9, 1.8, pendiente) * 0.85)
  }
  // Por los cauces de lluvia el suelo queda mas oscuro, y junto al agua, mojado.
  color = mezclar(color, color.map((valor) => valor * 0.6), cauce * 0.5)
  color = mezclar(color, desierto ? paleta.arenaOscura : COLOR.tierraMojada, mojado * 0.7)

  // Nieve en las cumbres; no se sostiene en las paredes casi verticales.
  const conNieve = rasgos.nieve || (base === 'montana' && !desierto)
  if (conNieve) {
    color = mezclar(color, COLOR.nieve, suave(0.6, 0.7, a) * (1 - suave(2, 3.2, pendiente)))
  }
  // Fondo del crater: lava si el volcan esta activo, roca oscura si no.
  if (crater && r < CRATER) {
    const fondo = 1 - suave(crater.fondo, crater.fondo + 0.5 * (crater.borde - crater.fondo), alt)
    const lava = rasgos.activo ? mezclar(COLOR.lavaOscura, COLOR.lava, fondo) : paleta.basalto
    color = mezclar(color, lava, fondo)
  }
  // Arena en la orilla del mar.
  if (nivelAgua !== null) color = mezclar(color, paleta.arena, 1 - suave(nivelAgua + 0.01, nivelAgua + 0.06, alt))

  return color
}

// Arbolitos sencillos (tronco y copa) para los bosques del entorno.
function sembrarArboles(t, alto, puedeIr, conifera, verde, vertice, indices) {
  const elegidos = []
  for (let intento = 0; intento < ARBOLES * 12 && elegidos.length < ARBOLES; intento++) {
    const [x, z] = [(t.random() - 0.5) * (LADO - 2), (t.random() - 0.5) * (LADO - 2)]
    if (!puedeIr(x, z) || elegidos.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 1.3)) continue
    elegidos.push([x, z])
  }
  const geometrias = []
  for (const [x, z] of elegidos) {
    const escala = 0.7 + t.random() * 0.6
    const suelo = t.alturaEn(x, z) * alto
    const tronco = new THREE.CylinderGeometry(0.08 * escala, 0.12 * escala, 0.6 * escala, 6)
    tronco.translate(x, suelo + 0.3 * escala, z)
    const copa = conifera
      ? new THREE.ConeGeometry(0.55 * escala, 1.6 * escala, 8).translate(x, suelo + 1.2 * escala, z)
      : new THREE.IcosahedronGeometry(0.6 * escala, 1).translate(x, suelo + 1 * escala, z)
    geometrias.push([tronco, COLOR.corteza], [copa, mezclar(verde, [0, 0, 0], t.random() * 0.25)])
  }
  for (const [geometria, rgb] of geometrias) {
    const plana = geometria.index ? geometria.toNonIndexed() : geometria
    const posiciones = plana.attributes.position
    for (let i = 0; i < posiciones.count; i += 3) {
      const tri = [0, 1, 2].map((k) => vertice(posiciones.getX(i + k), posiciones.getY(i + k), posiciones.getZ(i + k), rgb))
      indices.push(...tri)
    }
  }
}

export function crearTerreno(receta, apariencia, random) {
  const entorno = ENTORNOS[receta.tipo] ?? {}
  const base = entorno.base ?? receta.tipo
  const paisaje = PAISAJES[base]
  const rasgos = { ...receta.rasgos, isla: receta.rasgos?.isla || base === 'isla' }
  const elementos = expandir([...(entorno.elementos ?? []), ...(rasgos.elementos ?? [])])
  if (rasgos.bosque) elementos.add('bosque')
  const ruido = crearRuido(random)
  const n = CELDAS + 1
  const celda = LADO / CELDAS

  // Altura: segun el paisaje, el tamano pedido y la altitud leida (si la hay).
  const porAltitud = rasgos.altitud ? limitar(Math.sqrt(rasgos.altitud / 3000), 0.75, 1.4) : 1
  const alto = paisaje.alto * receta.tamano * porAltitud
  const radio = paisaje.radio * Math.min(receta.tamano, 1.2)

  const alturas = new Float32Array(n * n)
  const agua = new Float32Array(n * n).fill(NaN)
  const t = { alturas, agua, n, celda, lado: LADO, ruido, random }
  t.alturaEn = (x, z) => {
    const [ix, iz] = [x, z].map((v) => limitar(Math.round((v + LADO / 2) / celda), 0, n - 1))
    return alturas[iz * n + ix]
  }

  // 1. Relieve base.
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const [x, z] = [-LADO / 2 + ix * celda, -LADO / 2 + iz * celda]
      alturas[iz * n + ix] = Math.max(0, paisaje.altura(x, z, Math.hypot(x, z) / radio, ruido))
    }
  }

  // 2. Formas grandes, erosion, y despues lo que se talla encima.
  aplicarAntes(t, elementos)
  for (let i = 0; i < alturas.length; i++) alturas[i] = Math.max(0, alturas[i])
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
  // Si el relieve sube en el centro, el rio pasa por un costado.
  const centroRio = paisaje.pico ? (random() < 0.5 ? -1 : 1) * LADO * 0.3 : (random() - 0.5) * 4
  aplicarDespues(t, elementos, centroRio)
  for (let i = 0; i < alturas.length; i++) alturas[i] = Math.max(0, alturas[i])
  const nivelAgua = paisaje.agua ?? t.nivelMar ?? (rasgos.isla ? 0.12 : null)

  // Fondo y borde reales del crater, para ubicar la lava.
  let crater = null
  if (base === 'volcan') {
    crater = { fondo: Infinity, borde: 0 }
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const r = distancia(ix, iz)
        if (r < CRATER * 0.6) crater.fondo = Math.min(crater.fondo, alturas[iz * n + ix])
        if (r < CRATER * 1.4) crater.borde = Math.max(crater.borde, alturas[iz * n + ix])
      }
    }
  }

  // Cercania al agua de rios y lagos (1 = bajo el agua, baja hasta 0 a unas celdas).
  const mojado = new Float32Array(n * n)
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      if (Number.isNaN(agua[iz * n + ix])) continue
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          const [jx, jz] = [ix + dx, iz + dz]
          if (jx < 0 || jz < 0 || jx >= n || jz >= n) continue
          const j = jz * n + jx
          mojado[j] = Math.max(mojado[j], 1 - Math.hypot(dx, dz) / 4)
        }
      }
    }
  }

  // 3. Color de cada punto.
  const tinte = receta.colorElegido
    ? colorHex(receta.color)
    : apariencia.imagen
      ? tonoDeFoto(apariencia.imagen)
      : null
  const tenir = (color, cuanto) => (tinte ? mezclar(color, tinte, cuanto) : color)
  const paleta = {
    tierra: tenir(COLOR.tierra, 0.35),
    roca: tenir(COLOR.roca, 0.35),
    basalto: tenir(COLOR.basalto, 0.2),
    ceniza: tenir(COLOR.ceniza, 0.25),
    arena: tenir(COLOR.arena, 0.2),
    arenaOscura: tenir(COLOR.arenaOscura, 0.2),
  }
  const estilo = { desierto: entorno.desierto, canon: elementos.has('canon'), bosque: elementos.has('bosque') }

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
  const pendienteEn = (ix, iz) =>
    (Math.hypot(alturaEn(ix + 1, iz) - alturaEn(ix - 1, iz), alturaEn(ix, iz + 1) - alturaEn(ix, iz - 1)) * alto) /
    (2 * celda)
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const [x, z] = [-LADO / 2 + ix * celda, -LADO / 2 + iz * celda]
      const rgb = colorDelSuelo(base, estilo, paleta, rasgos, {
        alt: alturaEn(ix, iz),
        pendiente: pendienteEn(ix, iz),
        cauce: Math.sqrt(flujo[iz * n + ix] / flujoMaximo),
        variacion: 0.08 * (ruido(x * 0.4, 7, z * 0.4, 3) - 0.5),
        r: Math.hypot(x, z) / radio,
        nivelAgua,
        crater,
        mojado: mojado[iz * n + ix],
      })
      vertice(x, alturaEn(ix, iz) * alto, z, rgb)
    }
  }
  for (let iz = 0; iz < CELDAS; iz++) {
    for (let ix = 0; ix < CELDAS; ix++) {
      const a = iz * n + ix
      indices.push(a, a + n, a + 1, a + 1, a + n, a + n + 1)
    }
  }

  // Agua de rios, cascadas y lagos: una superficie que sigue su propia altura.
  // Donde baja de golpe (la cascada) se pinta de espuma blanca, igual que al
  // pie de la caida.
  const encima = 0.01 // un poco sobre el fondo, para que no se mezclen
  const indiceAgua = new Int32Array(n * n).fill(-1)
  const aguaEn = (ix, iz) => agua[limitar(iz, 0, n - 1) * n + limitar(ix, 0, n - 1)]
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix
      if (Number.isNaN(agua[i])) continue
      const [x, z] = [-LADO / 2 + ix * celda, -LADO / 2 + iz * celda]
      const vecinos = [aguaEn(ix + 1, iz), aguaEn(ix - 1, iz), aguaEn(ix, iz + 1), aguaEn(ix, iz - 1)]
      const caida = Math.max(...vecinos.filter((v) => !Number.isNaN(v)).map((v) => Math.abs(v - agua[i])), 0)
      const profundidad = agua[i] - alturas[i]
      let rgb = mezclar(COLOR.aguaClara, COLOR.agua, suave(0, 0.06, profundidad))
      let espuma = suave(0.25, 1.2, (caida * alto) / celda)
      if (t.cascada) espuma = Math.max(espuma, 1 - suave(0.4, 2.2, Math.hypot(x - t.cascada.x, z - t.cascada.z - 1.5)))
      rgb = mezclar(rgb, COLOR.espuma, espuma)
      indiceAgua[i] = vertice(x, agua[i] * alto + encima, z, rgb)
    }
  }
  for (let iz = 0; iz < CELDAS; iz++) {
    for (let ix = 0; ix < CELDAS; ix++) {
      const [a, b, c, d] = [iz * n + ix, iz * n + ix + 1, (iz + 1) * n + ix, (iz + 1) * n + ix + 1].map((i) => indiceAgua[i])
      if (a >= 0 && b >= 0 && c >= 0 && d >= 0) indices.push(a, c, b, b, c, d)
      else if (b >= 0 && c >= 0 && d >= 0) indices.push(b, c, d)
      else if (a >= 0 && c >= 0 && d >= 0) indices.push(a, c, d)
      else if (a >= 0 && b >= 0 && d >= 0) indices.push(a, d, b)
      else if (a >= 0 && b >= 0 && c >= 0) indices.push(a, c, b)
    }
  }

  // Mar: una superficie plana a su nivel; lo que sobresale es tierra.
  const alturaMar = nivelAgua !== null ? nivelAgua * alto : null
  if (alturaMar !== null) {
    const m = LADO / 2
    const [a, b, c, d] = [
      vertice(-m, alturaMar, -m, COLOR.agua),
      vertice(m, alturaMar, -m, COLOR.agua),
      vertice(m, alturaMar, m, COLOR.agua),
      vertice(-m, alturaMar, m, COLOR.agua),
    ]
    indices.push(a, d, c, a, c, b)
  }

  // Bosque: arbolitos en el suelo firme, lejos del agua, la nieve y las paredes.
  if (elementos.has('bosque')) {
    const verde = rasgos.desierto ? COLOR.arenaOscura : COLOR.bosque
    const puedeIr = (x, z) => {
      const [ix, iz] = [x, z].map((v) => limitar(Math.round((v + LADO / 2) / celda), 0, n - 1))
      const i = iz * n + ix
      return (
        Number.isNaN(agua[i]) &&
        mojado[i] < 0.3 &&
        pendienteEn(ix, iz) < 0.8 &&
        alturas[i] < 0.55 &&
        (nivelAgua === null || alturas[i] > nivelAgua + 0.04)
      )
    }
    sembrarArboles(t, alto, puedeIr, rasgos.conifera || base === 'montana', verde, vertice, indices)
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
      const superficie = Number.isNaN(aguaEn(ix, iz)) ? -Infinity : aguaEn(ix, iz) * alto
      const arriba = Math.max(suelo, alturaMar ?? -Infinity, superficie)
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
