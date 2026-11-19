// K-medias: agrupa colores (en RGB o en Lab) en k grupos de colores parecidos.
// Se eligen k colores de partida, cada color se asigna al grupo mas parecido,
// cada grupo se mueve al promedio de sus colores, y se repite hasta que se asienta.

export function distancia(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

// Colores de partida: el primero es el mas cercano al promedio, y cada uno de
// los siguientes es el mas alejado de los ya elegidos. Asi no se repiten y
// cubren toda la variedad de colores.
function elegirPartida(colores, k) {
  const paso = Math.max(1, Math.floor(colores.length / 2000))
  const muestra = colores.filter((_, i) => i % paso === 0)
  const promedio = [0, 1, 2].map((c) => muestra.reduce((s, color) => s + color[c], 0) / muestra.length)
  const centros = [muestra.reduce((mejor, color) => (distancia(color, promedio) < distancia(mejor, promedio) ? color : mejor))]
  const cercania = muestra.map((color) => distancia(color, centros[0]))
  while (centros.length < k) {
    let lejano = 0
    for (let i = 1; i < muestra.length; i++) if (cercania[i] > cercania[lejano]) lejano = i
    centros.push(muestra[lejano])
    muestra.forEach((color, i) => (cercania[i] = Math.min(cercania[i], distancia(color, muestra[lejano]))))
  }
  return centros
}

// Devuelve { centros, grupos }: el color promedio de cada grupo y a que grupo
// pertenece cada color de entrada.
export function kmedias(colores, k, vueltas = 10) {
  let centros = elegirPartida(colores, k)
  const grupos = new Uint8Array(colores.length)

  for (let vuelta = 0; vuelta < vueltas; vuelta++) {
    const sumas = Array.from({ length: k }, () => [0, 0, 0, 0])
    colores.forEach((color, i) => {
      let mejor = 0
      for (let j = 1; j < k; j++) {
        if (distancia(color, centros[j]) < distancia(color, centros[mejor])) mejor = j
      }
      grupos[i] = mejor
      sumas[mejor][0] += color[0]
      sumas[mejor][1] += color[1]
      sumas[mejor][2] += color[2]
      sumas[mejor][3]++
    })
    centros = centros.map((centro, j) =>
      sumas[j][3] ? [sumas[j][0] / sumas[j][3], sumas[j][1] / sumas[j][3], sumas[j][2] / sumas[j][3]] : centro,
    )
  }
  return { centros, grupos }
}

// Distancia de un color al centro mas parecido.
export function distanciaMinima(color, centros) {
  let minima = Infinity
  for (const centro of centros) minima = Math.min(minima, distancia(color, centro))
  return minima
}
