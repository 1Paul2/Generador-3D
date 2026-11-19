import { rgbALab } from '../utils/color.js'
import { distancia, distanciaMinima, kmedias } from '../utils/kmedias.js'

// Separa el objeto del fondo en una foto, sin inteligencia artificial:
//   1. Achica la foto a unos 256 pixeles de lado (promediando) y pasa los
//      colores a Lab, donde las distancias se parecen a lo que percibe el ojo.
//   2. Detecta los bordes con el filtro de Sobel (donde el color cambia fuerte).
//   3. Aprende como es el fondo agrupando los colores del borde de la foto.
//   4. "Inunda" desde el borde por los pixeles que se parecen al fondo; los
//      bordes fuertes frenan el agua, asi no se mete en el objeto.
//   5. Refina como GrabCut (simplificado): con el recorte aprende los colores
//      del objeto y del fondo, vuelve a decidir cada pixel segun a cual se
//      parece mas, y cobra una multa por cortar entre pixeles parecidos. Esa
//      decision se resuelve con ICM: cada pixel elige la opcion mas barata
//      mirando a sus vecinos, varias pasadas. Se repite unas veces.
//   6. Se queda con el pedazo mas grande, rellena huecos y suaviza el contorno.
// Devuelve { mascara, colores, lab, ancho, alto, fondo } (mascara: 1 = objeto;
// colores en RGB y en Lab; fondo: colores Lab tipicos del fondo) o null si no
// encontro un objeto claro.

const LADO = 256
const BANDA = 2 // pixeles del borde que se toman como muestra del fondo
const VUELTAS_REFINADO = 4
const PASADAS_ICM = 3
const MULTA_CORTE = 12 // cuanto cuesta separar dos pixeles vecinos parecidos
const GRUPOS = 5 // colores con que se describe el objeto y el fondo al refinar

// Achica la imagen promediando bloques de pixeles. Devuelve un color [r, g, b] por pixel.
function achicar(imagen) {
  const escala = Math.max(1, Math.max(imagen.ancho, imagen.alto) / LADO)
  const ancho = Math.max(1, Math.round(imagen.ancho / escala))
  const alto = Math.max(1, Math.round(imagen.alto / escala))
  const colores = []
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const suma = [0, 0, 0]
      let cuenta = 0
      const [x0, x1] = [Math.floor(x * escala), Math.min(imagen.ancho, Math.floor((x + 1) * escala))]
      const [y0, y1] = [Math.floor(y * escala), Math.min(imagen.alto, Math.floor((y + 1) * escala))]
      for (let yy = y0; yy < Math.max(y1, y0 + 1); yy++) {
        for (let xx = x0; xx < Math.max(x1, x0 + 1); xx++) {
          const p = (yy * imagen.ancho + xx) * 4
          suma[0] += imagen.pixeles[p]
          suma[1] += imagen.pixeles[p + 1]
          suma[2] += imagen.pixeles[p + 2]
          cuenta++
        }
      }
      colores.push(suma.map((valor) => valor / cuenta))
    }
  }
  return { colores, ancho, alto }
}

// Vecinos en las 4 direcciones que estan dentro de la imagen.
function vecinos(i, ancho, alto) {
  const [x, y] = [i % ancho, Math.floor(i / ancho)]
  const lista = []
  if (x > 0) lista.push(i - 1)
  if (x < ancho - 1) lista.push(i + 1)
  if (y > 0) lista.push(i - ancho)
  if (y < alto - 1) lista.push(i + ancho)
  return lista
}

// Fuerza del borde en cada pixel: filtro de Sobel en los tres canales Lab.
function detectarBordes(lab, ancho, alto) {
  const fuerza = new Float32Array(lab.length)
  const valor = (x, y, c) => lab[Math.min(alto - 1, Math.max(0, y)) * ancho + Math.min(ancho - 1, Math.max(0, x))][c]
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let suma = 0
      for (let c = 0; c < 3; c++) {
        const gx =
          valor(x + 1, y - 1, c) + 2 * valor(x + 1, y, c) + valor(x + 1, y + 1, c) -
          valor(x - 1, y - 1, c) - 2 * valor(x - 1, y, c) - valor(x - 1, y + 1, c)
        const gy =
          valor(x - 1, y + 1, c) + 2 * valor(x, y + 1, c) + valor(x + 1, y + 1, c) -
          valor(x - 1, y - 1, c) - 2 * valor(x, y - 1, c) - valor(x + 1, y - 1, c)
        suma += gx * gx + gy * gy
      }
      fuerza[y * ancho + x] = Math.sqrt(suma) / 4
    }
  }
  return fuerza
}

function percentil(valores, fraccion) {
  const ordenados = Float32Array.from(valores).sort()
  return ordenados[Math.floor(fraccion * (ordenados.length - 1))]
}

// Pedazos conectados de la mascara; devuelve el mas grande.
function pedazoMasGrande(mascara, ancho, alto) {
  const pedazo = new Int32Array(mascara.length).fill(-1)
  let mejor = { numero: -1, tamano: 0 }
  let numero = 0
  for (let inicio = 0; inicio < mascara.length; inicio++) {
    if (!mascara[inicio] || pedazo[inicio] !== -1) continue
    const pila = [inicio]
    pedazo[inicio] = numero
    let tamano = 0
    while (pila.length) {
      const i = pila.pop()
      tamano++
      for (const v of vecinos(i, ancho, alto)) {
        if (mascara[v] && pedazo[v] === -1) {
          pedazo[v] = numero
          pila.push(v)
        }
      }
    }
    if (tamano > mejor.tamano) mejor = { numero, tamano }
    numero++
  }
  return Uint8Array.from(pedazo, (p) => (p === mejor.numero ? 1 : 0))
}

// Rellena los huecos que no tocan el borde de la imagen (estan encerrados por el objeto).
function rellenarHuecos(mascara, ancho, alto) {
  const afuera = new Uint8Array(mascara.length)
  const pila = []
  for (let i = 0; i < mascara.length; i++) {
    const [x, y] = [i % ancho, Math.floor(i / ancho)]
    const enBorde = x === 0 || y === 0 || x === ancho - 1 || y === alto - 1
    if (enBorde && !mascara[i]) {
      afuera[i] = 1
      pila.push(i)
    }
  }
  while (pila.length) {
    const i = pila.pop()
    for (const v of vecinos(i, ancho, alto)) {
      if (!mascara[v] && !afuera[v]) {
        afuera[v] = 1
        pila.push(v)
      }
    }
  }
  return Uint8Array.from(afuera, (valor) => (valor ? 0 : 1))
}

// Suaviza el contorno: cada pixel toma lo que diga la mayoria de su vecindario de 3x3.
function suavizar(mascara, ancho, alto) {
  const nueva = new Uint8Array(mascara.length)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let votos = 0
      let total = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const [xx, yy] = [x + dx, y + dy]
          if (xx < 0 || yy < 0 || xx >= ancho || yy >= alto) continue
          votos += mascara[yy * ancho + xx]
          total++
        }
      }
      nueva[y * ancho + x] = votos * 2 > total ? 1 : 0
    }
  }
  return nueva
}

function limpiar(mascara, ancho, alto) {
  let limpia = suavizar(suavizar(mascara, ancho, alto), ancho, alto)
  limpia = pedazoMasGrande(limpia, ancho, alto)
  return rellenarHuecos(limpia, ancho, alto)
}

// Primer recorte: inundacion desde el borde, frenada por los bordes fuertes.
function inundarFondo(lab, bordes, ancho, alto, enBanda, centros, tolerancia) {
  const umbralBorde = Math.max(8, percentil(bordes, 0.85))
  const cercania = (i) => distanciaMinima(lab[i], centros)
  // Un pixel se suma al fondo si se parece al fondo y no hay un borde fuerte,
  // o si se parece muchisimo (aunque haya textura, como en el pasto).
  const pasa = (i) => {
    const d = cercania(i)
    return d < tolerancia && (bordes[i] < umbralBorde || d < tolerancia * 0.5)
  }

  const fondo = new Uint8Array(lab.length)
  const pila = []
  for (let i = 0; i < lab.length; i++) {
    if (enBanda(i) && cercania(i) < tolerancia) {
      fondo[i] = 1
      pila.push(i)
    }
  }
  while (pila.length) {
    const i = pila.pop()
    for (const v of vecinos(i, ancho, alto)) {
      if (!fondo[v] && pasa(v)) {
        fondo[v] = 1
        pila.push(v)
      }
    }
  }
  return Uint8Array.from(fondo, (valor) => (valor ? 0 : 1))
}

// Muestra pareja de hasta 4000 colores, para que k-medias sea rapido.
function muestrear(lab, indices) {
  const paso = Math.max(1, Math.floor(indices.length / 4000))
  return indices.filter((_, n) => n % paso === 0).map((i) => lab[i])
}

// Refinado tipo GrabCut con ICM (ver explicacion arriba).
function refinar(mascaraInicial, lab, ancho, alto, enBanda) {
  const mascara = mascaraInicial.slice()

  // Que tan distintos suelen ser dos vecinos: sirve para que la multa por
  // cortar sea alta entre pixeles parecidos y baja sobre un borde real.
  let suma = 0
  let cuenta = 0
  for (let i = 0; i < lab.length; i++) {
    if (i % ancho < ancho - 1) {
      suma += distancia(lab[i], lab[i + 1]) ** 2
      cuenta++
    }
    if (i + ancho < lab.length) {
      suma += distancia(lab[i], lab[i + ancho]) ** 2
      cuenta++
    }
  }
  const beta = 1 / (2 * Math.max(1, suma / cuenta))
  const multa = (i, j) => MULTA_CORTE * Math.exp(-beta * distancia(lab[i], lab[j]) ** 2)

  for (let vuelta = 0; vuelta < VUELTAS_REFINADO; vuelta++) {
    const objeto = []
    const fondo = []
    mascara.forEach((valor, i) => (valor ? objeto : fondo).push(i))
    if (objeto.length < 50 || fondo.length < 50) break

    const coloresObjeto = kmedias(muestrear(lab, objeto), GRUPOS).centros
    const coloresFondo = kmedias(muestrear(lab, fondo), GRUPOS).centros
    const costoObjeto = lab.map((color, i) => (enBanda(i) ? Infinity : distanciaMinima(color, coloresObjeto)))
    const costoFondo = lab.map((color) => distanciaMinima(color, coloresFondo))

    for (let pasada = 0; pasada < PASADAS_ICM; pasada++) {
      for (let i = 0; i < lab.length; i++) {
        let multaSiObjeto = 0
        let multaSiFondo = 0
        for (const v of vecinos(i, ancho, alto)) {
          if (mascara[v]) multaSiFondo += multa(i, v)
          else multaSiObjeto += multa(i, v)
        }
        mascara[i] = costoObjeto[i] + multaSiObjeto < costoFondo[i] + multaSiFondo ? 1 : 0
      }
    }
  }
  return mascara
}

export function segmentar(imagen) {
  const { colores, ancho, alto } = achicar(imagen)
  const lab = colores.map(rgbALab)
  const bordes = detectarBordes(lab, ancho, alto)
  const enBanda = (i) => {
    const [x, y] = [i % ancho, Math.floor(i / ancho)]
    return x < BANDA || y < BANDA || x >= ancho - BANDA || y >= alto - BANDA
  }

  // Modelo del fondo con los colores del borde.
  const muestra = []
  for (let i = 0; i < lab.length; i++) if (enBanda(i)) muestra.push(lab[i])
  const { centros, grupos } = kmedias(muestra, 4)
  // Que tan distinto puede ser un pixel y seguir pareciendo fondo: depende de
  // cuanto varia el propio fondo (un cielo liso tolera poco, un pasto mucho).
  const desvio = muestra.reduce((s, color, i) => s + distancia(color, centros[grupos[i]]), 0) / muestra.length
  const tolerancia = Math.min(28, Math.max(7, desvio * 2.5))

  const inicial = limpiar(inundarFondo(lab, bordes, ancho, alto, enBanda, centros, tolerancia), ancho, alto)
  let mascara = limpiar(refinar(inicial, lab, ancho, alto, enBanda), ancho, alto)

  // Si el refinado cambio el objeto de forma exagerada, se confia en el primer recorte.
  const area = (m) => m.reduce((s, valor) => s + valor, 0)
  const cambio = area(mascara) / Math.max(1, area(inicial))
  if (cambio < 0.5 || cambio > 2) mascara = inicial

  // Si el "objeto" es casi nada o casi toda la foto, no se separo bien.
  const ocupado = area(mascara) / mascara.length
  if (ocupado < 0.03 || ocupado > 0.92) return null
  return { mascara, colores, lab, ancho, alto, fondo: centros }
}
