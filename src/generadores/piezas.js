// Piezas con las que se arman los seres vivos: cada una es una funcion de
// distancia (cuanto falta para llegar a su superficie desde un punto; negativa
// adentro), y el ser es la union suave de todas.

const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const largo = (a) => Math.hypot(a[0], a[1], a[2])

// Capsula que se afina: de "a" (radio ra) a "b" (radio rb).
export function capsula(a, b, ra, rb, zona) {
  const ba = resta(b, a)
  const largoBa = punto(ba, ba)
  return {
    zona,
    caja: [Math.min(a[0], b[0]) - ra, Math.min(a[1], b[1]) - ra, Math.min(a[2], b[2]) - ra,
      Math.max(a[0], b[0]) + ra, Math.max(a[1], b[1]) + ra, Math.max(a[2], b[2]) + ra],
    distancia(p) {
      const pa = resta(p, a)
      const h = Math.min(1, Math.max(0, punto(pa, ba) / largoBa))
      return largo([pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h]) - (ra + (rb - ra) * h)
    },
  }
}

// Elipsoide con centro "c" y radios en cada eje (distancia aproximada).
export function elipsoide(c, radios, zona) {
  return {
    zona,
    caja: [c[0] - radios[0], c[1] - radios[1], c[2] - radios[2], c[0] + radios[0], c[1] + radios[1], c[2] + radios[2]],
    distancia(p) {
      const q = resta(p, c)
      const k0 = largo([q[0] / radios[0], q[1] / radios[1], q[2] / radios[2]])
      const k1 = largo([q[0] / radios[0] ** 2, q[1] / radios[1] ** 2, q[2] / radios[2] ** 2])
      return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(...radios)
    },
  }
}

export const esfera = (c, r, zona) => elipsoide(c, [r, r, r], zona)

// Valor de una tabla [[x, valor], ...] (ordenada por x) en x, pasando suave
// de un punto al siguiente.
export function enTabla(tabla, x) {
  if (x <= tabla[0][0]) return tabla[0][1]
  for (let i = 1; i < tabla.length; i++) {
    const [x1, v1] = tabla[i]
    if (x <= x1) {
      const [x0, v0] = tabla[i - 1]
      const t = (x - x0) / (x1 - x0)
      return v0 + (v1 - v0) * (t * t * (3 - 2 * t))
    }
  }
  return tabla[tabla.length - 1][1]
}

// Tronco armado por su perfil, como en un plano: a lo largo del cuerpo (eje
// x) se dan la linea del lomo (arriba), la de la panza (abajo) y el medio
// ancho; cada corte es una superelipse, una elipse con las esquinas mas o
// menos cuadradas (cuadratura 2 = elipse; 3 = casi un rectangulo redondeado).
// Con esferas el cuerpo de un bovino salia redondo, como un barril; asi tiene
// el lomo recto, la grupa cuadrada y las costillas planas. Distancia aproximada.
export function perfil(arriba, abajo, ancho, cuadratura, zona) {
  const desde = Math.max(arriba[0][0], abajo[0][0], ancho[0][0])
  const hasta = Math.min(arriba[arriba.length - 1][0], abajo[abajo.length - 1][0], ancho[ancho.length - 1][0])
  const maximoAncho = Math.max(...ancho.map(([, v]) => v))
  return {
    zona,
    caja: [desde, Math.min(...abajo.map(([, v]) => v)), -maximoAncho, hasta, Math.max(...arriba.map(([, v]) => v)), maximoAncho],
    distancia(p) {
      const x = Math.min(hasta, Math.max(desde, p[0]))
      const dx = p[0] - x
      const tope = enTabla(arriba, x)
      const fondo = enTabla(abajo, x)
      const radioY = (tope - fondo) / 2
      const radioZ = enTabla(ancho, x)
      const n = typeof cuadratura === 'number' ? cuadratura : enTabla(cuadratura, x)
      const k = Math.pow(Math.pow(Math.abs(p[1] - (tope + fondo) / 2) / radioY, n) + Math.pow(Math.abs(p[2]) / radioZ, n), 1 / n)
      const d = (k - 1) * Math.min(radioY, radioZ)
      return dx === 0 ? d : d < 0 ? Math.abs(dx) : Math.hypot(d, dx)
    },
  }
}

// Union suave: como el minimo, pero redondea la union en un ancho "k".
export function minimoSuave(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

// Pares izquierdo y derecho de una pieza (patas, orejas, ojos).
export const espejo = (crear) => [crear(1), crear(-1)]

