import { rgbALab } from '../utils/color.js'
import { distancia, distanciaMinima, kmedias } from '../utils/kmedias.js'

// Separa el objeto del fondo en una foto, sin inteligencia artificial:
//   1. Achica la foto a unos 512 pixeles de lado (promediando) y pasa los
//      colores a Lab, donde las distancias se parecen a lo que percibe el ojo.
//      Trabaja sobre una copia levemente suavizada, para que la textura del
//      fondo (pasto, grano) no parezca un borde.
//   2. Detecta los bordes con el filtro de Sobel (donde el color cambia fuerte).
//   3. Aprende como es el fondo con los colores del borde de la foto: sus
//      grupos de colores y una superficie de color que predice el fondo en
//      cada punto (para fondos degradados). Las sombras sobre el fondo se
//      toleran: un pixel mas oscuro del mismo tono sigue siendo fondo.
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

// Lado de la grilla de analisis (512: en un banco de 100 pruebas dio la mayor
// precision). Los anchos medidos en pixeles (como BANDA)
// estan pensados para 256 y se escalan si la grilla es mas fina o mas gruesa.
export const LADO = 512
const BANDA = 2 // pixeles del borde que se toman como muestra del fondo (en 256)
const VUELTAS_REFINADO = 4
const PASADAS_ICM = 3
const MULTA_CORTE = 12 // cuanto cuesta separar dos pixeles vecinos parecidos
const GRUPOS = 5 // colores con que se describe el objeto y el fondo al refinar
const SOMBRA_MAS_OSCURA = 0.45 // factor de luz mas bajo que todavia se considera sombra
const MULTA_SOMBRA = 10 // cuanto cuesta, en distancia, oscurecer el fondo del todo
const OBJETO_MINIMO = 0.003 // parte minima de la foto que debe ocupar el objeto

// Achica la imagen promediando bloques de pixeles. Devuelve un color [r, g, b] por pixel.
function achicar(imagen, lado) {
  const escala = Math.max(1, Math.max(imagen.ancho, imagen.alto) / lado)
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

// Suavizado de caja: cada pixel promedia su vecindario. Sirve para que la
// textura fina del fondo (pasto, grano, tela) no parezca un borde.
function suavizarColores(lab, ancho, alto, radio) {
  let actual = lab
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const siguiente = new Array(actual.length)
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const suma = [0, 0, 0]
        let cuenta = 0
        for (let k = -radio; k <= radio; k++) {
          const [xx, yy] = [x + dx * k, y + dy * k]
          if (xx < 0 || yy < 0 || xx >= ancho || yy >= alto) continue
          const c = actual[yy * ancho + xx]
          suma[0] += c[0]
          suma[1] += c[1]
          suma[2] += c[2]
          cuenta++
        }
        siguiente[y * ancho + x] = suma.map((v) => v / cuenta)
      }
    }
    actual = siguiente
  }
  return actual
}

// Resuelve un sistema de ecuaciones lineales (eliminacion de Gauss).
function resolver(matriz, valores) {
  const n = valores.length
  const m = matriz.map((fila, i) => [...fila, valores[i]])
  for (let c = 0; c < n; c++) {
    let pivote = c
    for (let f = c + 1; f < n; f++) if (Math.abs(m[f][c]) > Math.abs(m[pivote][c])) pivote = f
    ;[m[c], m[pivote]] = [m[pivote], m[c]]
    for (let f = c + 1; f < n; f++) {
      const factor = m[f][c] / m[c][c]
      for (let k = c; k <= n; k++) m[f][k] -= factor * m[c][k]
    }
  }
  const x = new Array(n).fill(0)
  for (let f = n - 1; f >= 0; f--) {
    let suma = m[f][n]
    for (let k = f + 1; k < n; k++) suma -= m[f][k] * x[k]
    x[f] = suma / m[f][f]
  }
  return x
}

// Superficie de color del fondo: ajusta, con minimos cuadrados, un polinomio
// de segundo grado en x e y a los colores del borde. Asi predice que color
// tendria el fondo en cualquier punto, aunque sea un degrade o tenga una
// vineta (mas oscuro en las esquinas). Devuelve una funcion i -> color Lab.
function ajustarFondo(lab, indicesBorde, ancho, alto) {
  const terminos = (i) => {
    const x = ((i % ancho) / (ancho - 1)) * 2 - 1
    const y = (Math.floor(i / ancho) / (alto - 1)) * 2 - 1
    return [1, x, y, x * x, y * y, x * y]
  }
  const matriz = Array.from({ length: 6 }, (_, f) => Array.from({ length: 6 }, (_, c) => (f === c ? 1e-6 : 0)))
  const valores = [0, 1, 2].map(() => new Array(6).fill(0))
  for (const i of indicesBorde) {
    const t = terminos(i)
    for (let f = 0; f < 6; f++) {
      for (let c = 0; c < 6; c++) matriz[f][c] += t[f] * t[c]
      for (let canal = 0; canal < 3; canal++) valores[canal][f] += t[f] * lab[i][canal]
    }
  }
  const coeficientes = valores.map((v) => resolver(matriz, v))
  return (i) => {
    const t = terminos(i)
    return coeficientes.map((co) => co.reduce((suma, valor, k) => suma + valor * t[k], 0))
  }
}

// Distancia de un color al fondo, tolerante a las sombras. Una sombra
// multiplica el color del fondo por un factor menor que 1, y en Lab eso
// equivale a escalar todo el vector (L + 16, a, b) por un mismo numero. Por
// eso se busca que factor k acerca mas el fondo al pixel: si k esta entre
// SOMBRA_MAS_OSCURA y 1 (es el fondo, mas oscuro), la distancia es lo que
// sobra despues de escalar, mas una pequena multa por oscurecer.
function distanciaConSombra(color, fondo) {
  const p = [color[0] + 16, color[1], color[2]]
  const q = [fondo[0] + 16, fondo[1], fondo[2]]
  const k = (p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / Math.max(1e-6, q[0] * q[0] + q[1] * q[1] + q[2] * q[2])
  if (k >= 1 || k < SOMBRA_MAS_OSCURA) return distancia(color, fondo)
  const resto = Math.hypot(p[0] - k * q[0], p[1] - k * q[1], p[2] - k * q[2])
  return resto + (1 - k) * MULTA_SOMBRA
}

// Primer recorte: inundacion desde el borde, frenada por los bordes fuertes.
// cercania(i) dice que tan distinto del fondo es el pixel i.
function inundarFondo(bordes, ancho, alto, enBanda, cercania, tolerancia) {
  const umbralBorde = Math.max(8, percentil(bordes, 0.85))
  // Un pixel se suma al fondo si se parece al fondo y no hay un borde fuerte,
  // o si se parece muchisimo (aunque haya textura, como en el pasto).
  const pasa = (i) => {
    const d = cercania(i)
    return d < tolerancia && (bordes[i] < umbralBorde || d < tolerancia * 0.5)
  }

  const fondo = new Uint8Array(ancho * alto)
  const pila = []
  for (let i = 0; i < fondo.length; i++) {
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

// Correccion - Poll: fallaba con fondos degradados, sombras, texturas y objetos chicos
export function segmentar(imagen, lado = LADO) {
  const { colores, ancho, alto } = achicar(imagen, lado)
  const escalaPixeles = Math.max(ancho, alto) / 256
  const banda = Math.max(BANDA, Math.round(BANDA * escalaPixeles))
  const lab = colores.map(rgbALab)
  // La separacion se calcula sobre una copia suavizada (en proporcion a la
  // resolucion), para que la textura del fondo no confunda; los colores que
  // se devuelven son los originales.
  const suave = suavizarColores(lab, ancho, alto, Math.max(1, Math.round(escalaPixeles)))
  const bordes = detectarBordes(suave, ancho, alto)
  const enBanda = (i) => {
    const [x, y] = [i % ancho, Math.floor(i / ancho)]
    return x < banda || y < banda || x >= ancho - banda || y >= alto - banda
  }

  // Modelo del fondo con los colores del borde: sus grupos de colores y la
  // superficie de color que predice el fondo en cada punto (para degrades).
  const indicesBorde = []
  for (let i = 0; i < suave.length; i++) if (enBanda(i)) indicesBorde.push(i)
  const { centros } = kmedias(indicesBorde.map((i) => suave[i]), 4)
  const prediccion = ajustarFondo(suave, indicesBorde, ancho, alto)
  const cercania = (i) => {
    let minima = distanciaConSombra(suave[i], prediccion(i))
    for (const centro of centros) minima = Math.min(minima, distanciaConSombra(suave[i], centro))
    return minima
  }
  // Que tan distinto puede ser un pixel y seguir pareciendo fondo: depende de
  // cuanto varia el propio fondo (un cielo liso tolera poco, un pasto mucho).
  const desvio = indicesBorde.reduce((s, i) => s + cercania(i), 0) / indicesBorde.length
  const tolerancia = Math.min(28, Math.max(7, desvio * 2.5))

  const inicial = limpiar(inundarFondo(bordes, ancho, alto, enBanda, cercania, tolerancia), ancho, alto)
  let mascara = limpiar(refinar(inicial, suave, ancho, alto, enBanda), ancho, alto)

  // Si el refinado cambio el objeto de forma exagerada, se confia en el primer recorte.
  const area = (m) => m.reduce((s, valor) => s + valor, 0)
  const cambio = area(mascara) / Math.max(1, area(inicial))
  if (cambio < 0.5 || cambio > 2) mascara = inicial

  // Si el "objeto" es casi nada o casi toda la foto, no se separo bien.
  const ocupado = area(mascara) / mascara.length
  if (ocupado < OBJETO_MINIMO || ocupado > 0.92) return null
  return { mascara, colores, lab, ancho, alto, fondo: centros }
}
