// Elementos que se combinan sobre cualquier relieve para armar un entorno:
// acantilado, rio, cascada (rio que cae por un acantilado, con poza abajo),
// lago, canon y costa. Cada uno modifica el mapa de alturas y, si tiene agua,
// marca en "agua" la altura de su superficie (NaN donde no hay agua).
// Las alturas van de 0 a 1 (despues se multiplican por el alto del paisaje).
//
// t: { alturas, agua, n, celda, lado, ruido, random } compartido por todos.

const limitar = (x, a, b) => Math.min(b, Math.max(a, x))
const suave = (a, b, x) => {
  const t = limitar((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

const posicion = (t, i) => t.celda * i - t.lado / 2

// Altura minima del fondo de un rio.
const PISO_RIO = 0.02

// Acantilado: un escalon que cruza el bloque de lado a lado, con el borde
// irregular. Todo lo que queda detras (hacia el fondo) sube de golpe.
function acantilado(t) {
  const { alturas, n, ruido } = t
  t.bordeAcantilado = (x) => -t.lado * 0.08 + 3 * (ruido(x * 0.12, 3.3, 0, 3) - 0.5)
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const [x, z] = [posicion(t, ix), posicion(t, iz)]
      const atras = suave(-0.35, 0.35, t.bordeAcantilado(x) - z)
      // La pared tiene salientes y entrantes, no es un plano liso.
      const rugosidad = 0.04 * (ruido(x * 0.6, z * 0.6, 9, 3) - 0.5) * atras * (1 - atras) * 4
      alturas[iz * n + ix] += 0.42 * atras + rugosidad
    }
  }
}

// Costa: el frente del bloque baja hasta quedar bajo el mar, con una linea de
// costa irregular. El mar (plano) lo dibuja el terreno con su nivel de agua.
function costa(t) {
  const { alturas, n, ruido } = t
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const [x, z] = [posicion(t, ix), posicion(t, iz)]
      const linea = t.lado * 0.12 + 4 * (ruido(x * 0.08, 7.7, 0, 3) - 0.5)
      const tierra = 1 - suave(linea - 4, linea + 3, z)
      alturas[iz * n + ix] = alturas[iz * n + ix] * tierra + 0.1 * tierra - 0.04
    }
  }
  t.nivelMar = 0.1
}

// Camino de un rio: avanza del fondo del bloque hacia el frente y serpentea.
// Devuelve la posicion x del centro del cauce para cada fila.
function trazarRio(t, centro) {
  const { n, ruido } = t
  const fase = t.random() * Math.PI * 2
  return Array.from({ length: n }, (_, iz) => {
    const z = posicion(t, iz)
    return centro + 2.2 * Math.sin(z * 0.17 + fase) + 2 * (ruido(0, z * 0.08, 5.5, 2) - 0.5)
  })
}

// Rio: talla un cauce siguiendo el camino. El fondo del cauce siempre baja
// (cada fila es un poco mas baja que la anterior), asi el agua corre hacia
// adelante; donde el terreno cae de golpe (un acantilado) el lecho cae con el
// y el agua forma una cascada.
function rio(t, { ancho = 1.6, profundidad = 0.05, centro = 0 } = {}) {
  const { alturas, agua, n } = t
  const camino = trazarRio(t, centro)
  const columna = (iz) => limitar(Math.round((camino[iz] + t.lado / 2) / t.celda), 0, n - 1)

  // El lecho nunca baja del piso de la maqueta (si no, el agua quedaria enterrada).
  const lecho = new Float32Array(n)
  for (let iz = 0; iz < n; iz++) {
    const suelo = alturas[iz * n + columna(iz)] - profundidad
    lecho[iz] = Math.max(PISO_RIO, iz === 0 ? suelo : Math.min(lecho[iz - 1] - 0.0008, suelo))
  }

  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const d = Math.abs(posicion(t, ix) - camino[iz])
      if (d > ancho * 2.2) continue
      const i = iz * n + ix
      // Orillas en pendiente suave: mas lejos del centro, menos se hunde.
      const fondo = lecho[iz] + (d / (ancho * 2.2)) ** 2 * Math.max(0, alturas[i] - lecho[iz])
      alturas[i] = Math.min(alturas[i], fondo)
      if (d < ancho && alturas[i] < lecho[iz] + profundidad * 0.7) agua[i] = lecho[iz] + profundidad * 0.7
    }
  }
  t.rio = { camino, lecho }
}

// Poza: donde el rio cae mas de golpe (la cascada), abajo se forma una
// pileta redonda por la fuerza del agua.
function poza(t) {
  if (!t.rio) return
  const { alturas, agua, n } = t
  const { camino, lecho } = t.rio
  let caida = 1
  for (let iz = 2; iz < n; iz++) if (lecho[iz - 2] - lecho[iz] > lecho[caida - 1] - lecho[caida + 1]) caida = iz - 1
  const iz0 = Math.min(n - 1, caida + Math.round(2.4 / t.celda))
  const [cx, cz] = [camino[iz0], posicion(t, iz0)]
  const radio = 2.6
  const nivel = lecho[iz0] + 0.03
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const r = Math.hypot(posicion(t, ix) - cx, posicion(t, iz) - cz) / radio
      if (r > 1.3) continue
      const i = iz * n + ix
      if (r < 1) alturas[i] = Math.min(alturas[i], nivel - 0.06 * (1 - r * r) - 0.005)
      if (alturas[i] < nivel) agua[i] = nivel
    }
  }
  t.cascada = { z: posicion(t, caida), x: camino[caida] }
}

// Lago: una cuenca de orilla irregular en la zona mas baja del relieve. El
// nivel del agua es la altura promedio de la orilla, asi el agua no "flota".
function lago(t) {
  const { alturas, agua, n, ruido } = t
  const alturaEn = (x, z) => {
    const [ix, iz] = [x, z].map((v) => limitar(Math.round((v + t.lado / 2) / t.celda), 0, n - 1))
    return alturas[iz * n + ix]
  }
  // Centro: el mas bajo entre varios candidatos cerca del medio.
  let centro = [0, 0]
  for (const cx of [-6, 0, 6]) {
    for (const cz of [-6, 0, 6]) if (alturaEn(cx, cz) < alturaEn(...centro)) centro = [cx, cz]
  }
  const radio = 5.5
  const forma = (angulo) => radio * (0.8 + 0.45 * ruido(Math.cos(angulo) * 1.4 + 2, Math.sin(angulo) * 1.4 + 2, 4, 3))

  let suma = 0
  for (let k = 0; k < 24; k++) {
    const angulo = (k / 24) * Math.PI * 2
    suma += alturaEn(centro[0] + Math.cos(angulo) * forma(angulo), centro[1] + Math.sin(angulo) * forma(angulo))
  }
  const nivel = suma / 24

  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const [dx, dz] = [posicion(t, ix) - centro[0], posicion(t, iz) - centro[1]]
      const r = Math.hypot(dx, dz) / forma(Math.atan2(dz, dx))
      if (r > 1.25) continue
      const i = iz * n + ix
      if (r < 1) alturas[i] = Math.min(alturas[i], nivel - 0.08 * (1 - r * r) - 0.004)
      else alturas[i] = Math.min(alturas[i], nivel + (r - 1) * 0.3)
      if (alturas[i] < nivel) agua[i] = nivel
    }
  }
}

// Canon: una garganta profunda de paredes casi verticales, escalonadas como
// las capas de roca, tallada por un rio que corre en el fondo.
function canon(t) {
  const { alturas, n } = t
  const camino = trazarRio(t, 0)
  const ancho = 5
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const d = Math.abs(posicion(t, ix) - camino[iz]) / ancho
      if (d > 1) continue
      const i = iz * n + ix
      // Paredes en escalones: la apertura avanza de a saltos, como estratos.
      const escalon = Math.floor(d * 5) / 5
      const pared = suave(0, 1, escalon * 0.6 + d * 0.4) ** 1.5
      alturas[i] = Math.min(alturas[i], 0.05 + pared * (alturas[i] - 0.05))
    }
  }
  t.canon = true
}

// Aplica los elementos en el orden correcto. "antes" son las formas grandes,
// que se hacen antes de la erosion para que el agua de lluvia las talle;
// "despues" son los tallados (rios, lagos), que van despues para que el
// sedimento no los tape.
export function aplicarAntes(t, elementos) {
  if (elementos.has('acantilado')) acantilado(t)
  if (elementos.has('mar')) costa(t)
}

export function aplicarDespues(t, elementos, centroRio) {
  if (elementos.has('canon')) canon(t)
  if (elementos.has('rio')) rio(t, { centro: centroRio, ancho: elementos.has('canon') ? 1.2 : 1.6 })
  if (elementos.has('poza')) poza(t)
  if (elementos.has('lago')) lago(t)
}
