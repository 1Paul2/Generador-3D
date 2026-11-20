import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

// Herramientas para armar plantas con su anatomia real, en metros. Cada parte
// es una superficie que se recorre con dos parametros (u a lo largo, v a lo
// ancho o alrededor), con muchos vertices: el color y el relieve de cada
// vertice llevan el detalle fino (nervaduras, cicatrices, manchas), sin
// texturas ni fotos.

export const ARRIBA = new THREE.Vector3(0, 1, 0)
export const vector = (x, y, z) => new THREE.Vector3(x, y, z)
export const mezclar = (a, b, t) => a.map((valor, k) => valor + (b[k] - valor) * t)
export const aclarar = (rgb, factor) => rgb.map((valor) => valor * factor)

// Pasa de 0 a 1 entre a y b con curva suave (a puede ser mayor que b).
export function transicion(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Diferencia entre dos angulos, entre -PI y PI.
export function diferenciaAngular(a, b) {
  const d = (a - b) % (Math.PI * 2)
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d
}

// Gira un vector alrededor de un eje (unitario).
export const girar = (vectorOriginal, eje, angulo) => vectorOriginal.clone().applyAxisAngle(eje, angulo)

// ---------- Malla ----------

// Junta todas las superficies de la planta en una sola malla.
export function crearMalla() {
  const posiciones = []
  const colores = []
  const indices = []

  // Superficie de (nu + 1) x (nv + 1) vertices: punto(u, v) -> { p, c }, con
  // u y v entre 0 y 1, p un Vector3 y c un color [r, g, b] de 0 a 255.
  function superficie(nu, nv, punto) {
    const base = posiciones.length / 3
    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j <= nv; j++) {
        const { p, c } = punto(i / nu, j / nv)
        posiciones.push(p.x, p.y, p.z)
        colores.push(c[0], c[1], c[2])
      }
    }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = base + i * (nv + 1) + j
        const b = a + nv + 1
        indices.push(a, a + 1, b, b, a + 1, b + 1)
      }
    }
  }

  // Tubo a lo largo de una curva (tallos, peciolos, frutos). Los marcos se
  // transportan a lo largo de la curva para que el tubo no se retuerza.
  //   centro(u) -> Vector3; radio(u, a) -> radio en el angulo a;
  //   color(u, a, p) -> [r, g, b].
  function tubo(nu, nv, centro, radio, color) {
    const puntos = Array.from({ length: nu + 1 }, (_, i) => centro(i / nu))
    const tangentes = puntos.map((_, i) => puntos[Math.min(nu, i + 1)].clone().sub(puntos[Math.max(0, i - 1)]).normalize())
    let normal = Math.abs(tangentes[0].y) < 0.9 ? vector(0, 1, 0) : vector(1, 0, 0)
    const normales = []
    const binormales = []
    for (const tangente of tangentes) {
      normal = normal.sub(tangente.clone().multiplyScalar(normal.dot(tangente))).normalize()
      normales.push(normal.clone())
      binormales.push(tangente.clone().cross(normal))
    }
    superficie(nu, nv, (u, v) => {
      const i = Math.round(u * nu)
      const a = v * Math.PI * 2
      const r = radio(u, a)
      const p = puntos[i].clone().addScaledVector(normales[i], Math.cos(a) * r).addScaledVector(binormales[i], Math.sin(a) * r)
      return { p, c: color(u, a, p) }
    })
  }

  // Arma la geometria: une los vertices repetidos (costuras de los tubos)
  // para que la luz se reparta sin cortes y pasa los colores a lineal.
  function armar() {
    const geometria = new THREE.BufferGeometry()
    geometria.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3))
    const lineales = new Float32Array(colores.length)
    const color = new THREE.Color()
    for (let k = 0; k < colores.length; k += 3) {
      const [r, g, b] = [colores[k], colores[k + 1], colores[k + 2]].map((valor) => Math.min(1, Math.max(0, valor / 255)))
      color.setRGB(r, g, b, THREE.SRGBColorSpace)
      lineales[k] = color.r
      lineales[k + 1] = color.g
      lineales[k + 2] = color.b
    }
    geometria.setAttribute('color', new THREE.BufferAttribute(lineales, 3))
    geometria.setIndex(indices)
    const unida = mergeVertices(geometria, 1e-5)
    geometria.dispose()
    return unida
  }

  return { superficie, tubo, armar }
}

// Columna de una hoja: puntos a lo largo de la vena central que arranca en
// "origen" con la direccion dada y se va doblando hacia abajo (el peso de la
// hoja). Devuelve una funcion u -> { p, tangente }.
export function columna(origen, direccion, largo, curvatura, pasos = 60) {
  const eje = direccion.clone().cross(ARRIBA)
  if (eje.lengthSq() < 1e-6) eje.set(1, 0, 0)
  eje.normalize()
  const puntos = [origen.clone()]
  const tangentes = []
  let actual = direccion.clone().normalize()
  for (let i = 0; i < pasos; i++) {
    tangentes.push(actual.clone())
    puntos.push(puntos[i].clone().addScaledVector(actual, largo / pasos))
    // Se dobla hacia abajo, sin pasar de colgar derecho.
    if (actual.y > -0.97) actual = girar(actual, eje, -curvatura / pasos)
  }
  tangentes.push(actual.clone())
  return (u) => {
    const x = Math.min(pasos, u * pasos)
    const i = Math.min(pasos - 1, Math.floor(x))
    const t = x - i
    return {
      p: puntos[i].clone().lerp(puntos[i + 1], t),
      tangente: tangentes[i].clone().lerp(tangentes[i + 1], t).normalize(),
    }
  }
}

// ---------- Suelo ----------

// Monticulo de tierra al pie de la planta: terrones, granos claros y oscuros
// y alguna piedrita, bajando hasta el piso en el borde.
export function suelo(malla, radio, alto, ruido) {
  const tierra = [86, 60, 42]
  malla.superficie(40, 120, (u, v) => {
    const r = radio * u
    const a = v * Math.PI * 2
    const [x, z] = [Math.cos(a) * r, Math.sin(a) * r]
    const terron = ruido(x * 18 + 50, 3, z * 18, 4)
    const grano = ruido(x * 90, 7, z * 90, 2)
    const borde = 1 - transicion(0.75, 1, u)
    const y = (alto * (1 - u * u) + (terron - 0.5) * 0.025) * borde
    let c = aclarar(tierra, 0.8 + terron * 0.4 + (grano - 0.5) * 0.35)
    // Tierra mas seca y clara arriba del monticulo.
    c = mezclar(c, [140, 115, 88], 0.35 * (1 - u) * transicion(0.45, 0.7, ruido(x * 6, 9, z * 6, 3)))
    if (grano > 0.9) c = mezclar(c, [128, 116, 100], 0.6)
    return { p: vector(x, Math.max(0, y), z), c }
  })
}


// ---------- Hojas ----------

// Contorno de las hojas anchas: ancho relativo (0 a 1) a lo largo de la hoja.
export const CONTORNOS = {
  // Mas ancha en el medio (cafe, chile).
  eliptica: (u) => Math.pow(Math.sin(Math.PI * u), 0.85),
  // Mas ancha cerca de la base (papa, frijol).
  ovada: (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.85),
  // Con la punta alargada en "gotero" (cacao, cafe, frijol).
  acuminada: (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.68)), 1.1) * (1 - 0.35 * Math.pow(u, 3)),
}

// Lado de la lamina: perpendicular a la vena y lo mas horizontal posible.
function ladoDe(tangente, fijo) {
  const lado = fijo ? fijo.clone() : tangente.clone().cross(ARRIBA)
  if (lado.lengthSq() < 1e-6) lado.set(1, 0, 0)
  return lado.sub(tangente.clone().multiplyScalar(lado.dot(tangente))).normalize()
}

// Hoja ancha con nervadura pinnada: la vena central clara, las secundarias
// saliendo hacia el borde y la punta, la lamina un poco abollada entre
// venas, el borde ondulado o con dientes.
//   base, direccion: donde nace la lamina y hacia donde apunta.
//   color(u, s, q): color base en cada punto (s de -1 a 1 a lo ancho).
//   nervios: cuantos pares de venas secundarias; angulo: cuanto suben hacia la punta.
//   pliegue: cuanto se levantan los bordes (hoja en V); abolladura y onda: relieve.
//   giro: cuanto se tuerce la lamina sobre la vena (radianes).
export function hoja(malla, opciones) {
  const {
    base, direccion, largo, ancho, color, ruido,
    curvatura = 0.6, contorno = CONTORNOS.eliptica, nervios = 7, angulo = 0.55,
    pliegue = 0.15, abolladura = 0, onda = 0, dientes = 0, giro = 0, lado: ladoFijo,
    nu = 22, nv = 8, semilla = 0,
  } = opciones
  const vena = columna(base, direccion, largo, curvatura, 24)
  malla.superficie(nu, nv, (u, v) => {
    const { p, tangente } = vena(u)
    const s = v * 2 - 1
    const lado = ladoDe(tangente, ladoFijo).applyAxisAngle(tangente, giro * u)
    const normal = lado.clone().cross(tangente).normalize()
    const diente = dientes ? 1 + 0.07 * Math.abs(((u * dientes) % 1) - 0.5) * 2 : 1
    const w = ancho * contorno(u) * diente
    // Fase de las venas secundarias: cada vena sale de la central y sube hacia la punta.
    const fase = u * nervios - Math.abs(s) * angulo * nervios * (ancho / largo) * 2
    const entreVenas = Math.sin(Math.PI * (((fase % 1) + 1) % 1))
    const relieve =
      pliegue * Math.abs(s) * w +
      abolladura * w * entreVenas * Math.sin(Math.PI * Math.abs(s)) +
      onda * w * Math.sin(u * 26 + semilla) * s * s
    const q = p.clone().addScaledVector(lado, s * w).addScaledVector(normal, relieve)

    const fino = ruido(q.x * 260 + semilla, q.y * 260, q.z * 260, 3)
    let c = aclarar(color(u, s, q), 0.9 + fino * 0.2)
    // Venas secundarias claras y finas, la vena central marcada.
    const vena2 = 1 - transicion(0, 0.12, Math.min(((fase % 1) + 1) % 1, 1 - (((fase % 1) + 1) % 1)))
    c = aclarar(c, 1 + 0.12 * vena2 * (1 - Math.abs(s) * 0.7))
    c = mezclar(c, aclarar(mezclar(c, [210, 215, 160], 0.5), 1.05), 0.7 * (1 - transicion(0.02, 0.08, Math.abs(s))))
    // Las abolladuras quedan en sombra suave entre venas.
    c = aclarar(c, 1 - abolladura * 1.2 * (1 - entreVenas))
    return { p: q, c }
  })
}

// Hoja acintada de los pastos (maiz, cana, arroz) y de los foliolos de la
// palma: larga y angosta, con la vena central blanca, venas paralelas, el
// borde ondulado y un arco que la hace caer.
export function hojaLarga(malla, opciones) {
  const {
    base, direccion, largo, ancho, color, ruido,
    curvatura = 1.2, giro = 0, onda = 0, nervio = 0.6, lado: ladoFijo, nu = 40, nv = 6, semilla = 0,
  } = opciones
  const vena = columna(base, direccion, largo, curvatura, 40)
  malla.superficie(nu, nv, (u, v) => {
    const { p, tangente } = vena(u)
    const s = v * 2 - 1
    const lado = ladoDe(tangente, ladoFijo).applyAxisAngle(tangente, giro * u)
    const normal = lado.clone().cross(tangente).normalize()
    const w = ancho * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 2.2))) * Math.pow(1 - u, 0.55)
    const relieve = 0.25 * Math.abs(s) * w + onda * w * Math.sin(u * 90 + semilla) * s * s
    const q = p.clone().addScaledVector(lado, s * w).addScaledVector(normal, relieve)
    const fino = ruido(q.x * 80 + semilla, q.y * 400, q.z * 80, 3)
    let c = aclarar(color(u, s, q), 0.88 + fino * 0.24)
    c = aclarar(c, 1 + 0.05 * Math.sin(s * 40))
    c = mezclar(c, [225, 228, 200], nervio * (1 - transicion(0.03, 0.1, Math.abs(s))))
    return { p: q, c }
  })
}

// ---------- Cuerpos de revolucion ----------

// Perfiles (radio relativo a lo largo del eje, de 0 a 1).
export const PERFILES = {
  esfera: (u) => 2 * Math.sqrt(Math.max(0, u * (1 - u))),
  // Huevo: mas ancho abajo.
  huevo: (u) => 2 * Math.sqrt(Math.max(0, u * (1 - u))) * (1.08 - 0.16 * u),
}

// Cuerpo de revolucion (frutos, granos, tuberculos) entre "desde" y "hacia".
//   forma(u, a): deformacion del radio en cada punto (gajos, costillas).
export function cuerpo(malla, desde, hacia, radio, perfil, color, opciones = {}) {
  const { forma = () => 1, nu = 24, nv = 24 } = opciones
  const eje = hacia.clone().sub(desde)
  malla.tubo(
    nu,
    nv,
    (u) => desde.clone().addScaledVector(eje, u),
    (u, a) => radio * perfil(u) * forma(u, a),
    color,
  )
}

// Celdas en espiral (filotaxis): "cantidad" puntos repartidos sobre una
// superficie de revolucion con el angulo de oro, como los ojos de la pina o
// los frutos del racimo de palma. Para un punto (u a lo alto, a alrededor)
// devuelve la distancia a la celda mas cercana (d1) y a la segunda (d2), en
// metros sobre la superficie, y cual es la mas cercana.
export function celdas(u, a, cantidad, alto, radio) {
  let [d1, d2, cerca] = [Infinity, Infinity, 0]
  const k = Math.round(u * cantidad)
  const vecinas = Math.ceil(cantidad * 0.2) + 6
  for (let i = Math.max(0, k - vecinas); i < Math.min(cantidad, k + vecinas); i++) {
    const dy = (u - (i + 0.5) / cantidad) * alto
    const dx = diferenciaAngular(a, i * 2.39996) * radio
    const d = Math.hypot(dx, dy)
    if (d < d1) [d2, d1, cerca] = [d1, d, i]
    else if (d < d2) d2 = d
  }
  return { d1, d2, cerca }
}
