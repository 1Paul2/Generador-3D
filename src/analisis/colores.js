import { kmedias } from '../utils/kmedias.js'

// Color de cada pixel del objeto. Las regiones (regiones.js) son pocas y
// limpias porque sirven para la estructura; el color, en cambio, va pixel por
// pixel para no perder detalles finos como las venas de una hoja.
//   1. Se arma una paleta con una cantidad de colores que crece con la
//      cantidad de pixeles del objeto: un objeto grande y detallado tiene
//      mas colores que uno chico.
//   2. Cada pixel toma el color de la paleta mas parecido al suyo (en Lab).
//   3. En el contorno, los pixeles mezclan el objeto con el fondo (un halo
//      claro u oscuro de un par de pixeles), asi que toman el promedio de los
//      pixeles que estan justo mas adentro.
// Devuelve un arreglo con [r, g, b] (0 a 255) por pixel; el fondo queda en cero.

const COLORES_MINIMOS = 8
const COLORES_MAXIMOS = 48
const MUESTRA = 6000 // pixeles con que se calcula la paleta (despues se asignan todos)
const CONTORNO = 2 // ancho, en pixeles, de la banda del contorno que se corrige (en 256)

export function colorearPorPixel({ mascara, colores, lab, ancho, alto }) {
  const indices = []
  for (let i = 0; i < mascara.length; i++) if (mascara[i]) indices.push(i)
  const cantidad = Math.min(
    COLORES_MAXIMOS,
    Math.max(COLORES_MINIMOS, Math.round(Math.sqrt(indices.length) / 4)),
    indices.length,
  )

  const paso = Math.max(1, Math.floor(indices.length / MUESTRA))
  const { centros } = kmedias(
    indices.filter((_, n) => n % paso === 0).map((i) => lab[i]),
    cantidad,
  )

  // Cada pixel va al color de la paleta mas parecido; el color final de cada
  // entrada de la paleta es el promedio real (en RGB) de sus pixeles.
  const grupo = new Int16Array(mascara.length).fill(-1)
  const sumas = Array.from({ length: centros.length }, () => [0, 0, 0, 0])
  for (const i of indices) {
    let mejor = 0
    let distanciaMejor = Infinity
    centros.forEach((centro, j) => {
      const d = (lab[i][0] - centro[0]) ** 2 + (lab[i][1] - centro[1]) ** 2 + (lab[i][2] - centro[2]) ** 2
      if (d < distanciaMejor) {
        distanciaMejor = d
        mejor = j
      }
    })
    grupo[i] = mejor
    for (let c = 0; c < 3; c++) sumas[mejor][c] += colores[i][c]
    sumas[mejor][3]++
  }
  const paleta = sumas.map(([r, g, b, n]) => (n ? [r / n, g / n, b / n] : [0, 0, 0]))

  const resultado = new Float32Array(mascara.length * 3)
  for (const i of indices) resultado.set(paleta[grupo[i]], i * 3)

  // Contorno: los pixeles a menos de CONTORNO pasos del fondo toman el promedio
  // de los pixeles que estan justo mas adentro de esa banda.
  const contorno = Math.round(CONTORNO * Math.max(1, Math.max(ancho, alto) / 256))
  const pasos = distanciaAlFondo(mascara, ancho, alto, contorno + 1)
  for (const i of indices) {
    if (pasos[i] > contorno) continue
    const [x, y] = [i % ancho, Math.floor(i / ancho)]
    const radio = contorno + 2
    const suma = [0, 0, 0]
    let cuenta = 0
    for (let dy = -radio; dy <= radio; dy++) {
      for (let dx = -radio; dx <= radio; dx++) {
        const [xx, yy] = [x + dx, y + dy]
        if (xx < 0 || yy < 0 || xx >= ancho || yy >= alto) continue
        const j = yy * ancho + xx
        if (!mascara[j] || pasos[j] <= contorno) continue
        for (let c = 0; c < 3; c++) suma[c] += resultado[j * 3 + c]
        cuenta++
      }
    }
    if (cuenta) resultado.set(suma.map((valor) => valor / cuenta), i * 3)
  }
  return resultado
}

// Cuantos pasos (en las 4 direcciones) separan a cada pixel del objeto del
// fondo, contando hasta "hasta"; los mas lejanos quedan en "hasta".
function distanciaAlFondo(mascara, ancho, alto, hasta) {
  const pasos = new Uint8Array(mascara.length).fill(hasta)
  let frente = []
  for (let i = 0; i < mascara.length; i++) {
    if (!mascara[i]) continue
    const [x, y] = [i % ancho, Math.floor(i / ancho)]
    const toca =
      x === 0 || y === 0 || x === ancho - 1 || y === alto - 1 ||
      !mascara[i - 1] || !mascara[i + 1] || !mascara[i - ancho] || !mascara[i + ancho]
    if (toca) {
      pasos[i] = 1
      frente.push(i)
    }
  }
  for (let paso = 2; paso < hasta && frente.length; paso++) {
    const siguiente = []
    for (const i of frente) {
      for (const v of [i - 1, i + 1, i - ancho, i + ancho]) {
        if (v >= 0 && v < mascara.length && mascara[v] && pasos[v] > paso) {
          pasos[v] = paso
          siguiente.push(v)
        }
      }
    }
    frente = siguiente
  }
  return pasos
}
