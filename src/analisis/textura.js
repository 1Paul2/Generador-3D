// Textura del objeto a la resolucion completa de la foto, para pintar el
// modelo pixel por pixel (y no solo en sus vertices):
//   - Adentro de la silueta van los pixeles reales de la foto.
//   - En el borde, donde el color del objeto se mezcla con el del fondo, y
//     afuera de la silueta, cada pixel toma el color del pixel del objeto mas
//     cercano. Asi, por mas que el modelo lea cerca del borde o afuera, nunca
//     aparece el fondo de la foto.
// Devuelve { pixeles (RGBA), ancho, alto }.

// Celdas de la grilla de analisis que se descartan junto al contorno. Se mide
// en la grilla (donde la silueta es exacta) y no en la foto ampliada, cuyos
// bordes quedan escalonados y a veces se pasan unos pixeles sobre el fondo.
const BORDE = 3

// Pasos que separan a cada celda de la mascara del fondo, hasta "hasta".
function pasosAlFondo(mascara, ancho, alto, hasta) {
  const pasos = new Uint8Array(mascara.length).fill(hasta)
  let frente = []
  for (let i = 0; i < mascara.length; i++) {
    if (!mascara[i]) {
      pasos[i] = 0
      frente.push(i)
    }
  }
  for (let paso = 1; paso < hasta && frente.length; paso++) {
    const siguiente = []
    for (const i of frente) {
      const x = i % ancho
      for (const v of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
        if (v >= 0 && v < mascara.length && pasos[v] > paso) {
          pasos[v] = paso
          siguiente.push(v)
        }
      }
    }
    frente = siguiente
  }
  return pasos
}

// Correccion - Poll: el relleno de la textura tomaba como origen pixeles del fondo y la manchaba
export function crearTexturaObjeto(imagen, segmento) {
  const { ancho, alto, pixeles } = imagen
  const total = ancho * alto

  // Celdas firmes del objeto: a mas de BORDE pasos del fondo en la grilla.
  const pasos = pasosAlFondo(segmento.mascara, segmento.ancho, segmento.alto, BORDE + 1)
  const firme = new Uint8Array(total)
  for (let y = 0; y < alto; y++) {
    const sy = Math.min(segmento.alto - 1, Math.floor((y * segmento.alto) / alto))
    for (let x = 0; x < ancho; x++) {
      const sx = Math.min(segmento.ancho - 1, Math.floor((x * segmento.ancho) / ancho))
      firme[y * ancho + x] = pasos[sy * segmento.ancho + sx] > BORDE ? 1 : 0
    }
  }

  // Relleno: desde los pixeles firmes del objeto se avanza hacia afuera y cada
  // pixel alcanzado copia el color de su origen (el pixel del objeto mas cercano).
  const origen = new Int32Array(total).fill(-1)
  let cola = []
  for (let i = 0; i < total; i++) {
    if (firme[i]) {
      origen[i] = i
      cola.push(i)
    }
  }
  while (cola.length) {
    const siguiente = []
    for (const i of cola) {
      const x = i % ancho
      for (const v of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
        if (v >= 0 && v < total && origen[v] < 0) {
          origen[v] = origen[i]
          siguiente.push(v)
        }
      }
    }
    cola = siguiente
  }

  const salida = new Uint8Array(total * 4)
  for (let i = 0; i < total; i++) {
    const o = (origen[i] < 0 ? i : origen[i]) * 4
    salida[i * 4] = pixeles[o]
    salida[i * 4 + 1] = pixeles[o + 1]
    salida[i * 4 + 2] = pixeles[o + 2]
    salida[i * 4 + 3] = 255
  }
  return { pixeles: salida, ancho, alto }
}
