// Erosion hidraulica por gotas. Se sueltan miles de gotas de lluvia sobre el
// terreno; cada una baja por la pendiente, arranca tierra donde corre rapido y
// la deposita donde frena o donde el suelo vuelve a subir. Asi aparecen solos
// los cauces, las quebradas y los abanicos de sedimento al pie de las laderas.
//
// alturas: grilla cuadrada de lado x lado, con alturas entre 0 y 1 (se modifica).
// Devuelve cuanta agua paso por cada celda, para oscurecer los cauces al pintar.

const INERCIA = 0.05 // cuanto mantiene la gota su direccion en lugar de seguir la pendiente
const CAPACIDAD = 4 // cuanta tierra puede cargar una gota rapida y con mucha agua
const CAPACIDAD_MINIMA = 0.01
const DEPOSITO = 0.3 // que parte del exceso de tierra deja por paso
const EROSION = 0.3 // que parte de lo que le falta cargar arranca por paso
const EVAPORACION = 0.01
const GRAVEDAD = 4
const PASOS = 30
const RADIO = 3 // radio del pincel con el que una gota arranca tierra

// Celdas vecinas dentro del radio, con mas peso las del centro.
function crearPincel() {
  const pincel = []
  let total = 0
  for (let dz = -RADIO; dz <= RADIO; dz++) {
    for (let dx = -RADIO; dx <= RADIO; dx++) {
      const distancia = Math.hypot(dx, dz)
      if (distancia < RADIO) {
        const peso = 1 - distancia / RADIO
        pincel.push({ dx, dz, peso })
        total += peso
      }
    }
  }
  return pincel.map((celda) => ({ ...celda, peso: celda.peso / total }))
}

export function erosionar(alturas, lado, random, gotas) {
  const pincel = crearPincel()
  const flujo = new Float32Array(alturas.length)
  const indice = (x, z) => z * lado + x

  // Altura interpolada y pendiente en un punto entre celdas.
  function medir(px, pz) {
    const [x, z] = [Math.floor(px), Math.floor(pz)]
    const [u, v] = [px - x, pz - z]
    const a = alturas[indice(x, z)]
    const b = alturas[indice(x + 1, z)]
    const c = alturas[indice(x, z + 1)]
    const d = alturas[indice(x + 1, z + 1)]
    return {
      altura: a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v,
      gx: (b - a) * (1 - v) + (d - c) * v,
      gz: (c - a) * (1 - u) + (d - b) * u,
    }
  }

  for (let g = 0; g < gotas; g++) {
    let [px, pz] = [1 + random() * (lado - 3), 1 + random() * (lado - 3)]
    let [dx, dz] = [0, 0]
    let velocidad = 1
    let agua = 1
    let sedimento = 0

    for (let paso = 0; paso < PASOS; paso++) {
      const [x, z] = [Math.floor(px), Math.floor(pz)]
      const [u, v] = [px - x, pz - z]
      const { altura, gx, gz } = medir(px, pz)

      // La gota gira hacia donde baja el terreno.
      dx = dx * INERCIA - gx * (1 - INERCIA)
      dz = dz * INERCIA - gz * (1 - INERCIA)
      const largo = Math.hypot(dx, dz)
      if (largo < 1e-9) {
        const angulo = random() * Math.PI * 2
        ;[dx, dz] = [Math.cos(angulo), Math.sin(angulo)]
      } else {
        dx /= largo
        dz /= largo
      }
      px += dx
      pz += dz
      if (px < 1 || pz < 1 || px >= lado - 2 || pz >= lado - 2) break

      flujo[indice(x, z)] += agua
      const diferencia = medir(px, pz).altura - altura
      const capacidad = Math.max(-diferencia * velocidad * agua * CAPACIDAD, CAPACIDAD_MINIMA)

      if (sedimento > capacidad || diferencia > 0) {
        // Deja tierra en las 4 celdas que rodean el punto donde estaba.
        const deja = diferencia > 0 ? Math.min(diferencia, sedimento) : (sedimento - capacidad) * DEPOSITO
        sedimento -= deja
        alturas[indice(x, z)] += deja * (1 - u) * (1 - v)
        alturas[indice(x + 1, z)] += deja * u * (1 - v)
        alturas[indice(x, z + 1)] += deja * (1 - u) * v
        alturas[indice(x + 1, z + 1)] += deja * u * v
      } else {
        // Arranca tierra alrededor con el pincel, sin cavar mas de lo que bajo.
        const arranca = Math.min((capacidad - sedimento) * EROSION, -diferencia)
        for (const celda of pincel) {
          const [cx, cz] = [x + celda.dx, z + celda.dz]
          if (cx < 0 || cz < 0 || cx >= lado || cz >= lado) continue
          const i = indice(cx, cz)
          const quita = Math.min(alturas[i], arranca * celda.peso)
          alturas[i] -= quita
          sedimento += quita
        }
      }

      velocidad = Math.sqrt(Math.max(0, velocidad * velocidad - diferencia * GRAVEDAD))
      agua *= 1 - EVAPORACION
    }
  }
  return flujo
}
