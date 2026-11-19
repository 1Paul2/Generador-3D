import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'
import { crearRandom } from '../utils/random.js'

// Decide que efecto de luz lleva un modelo y desde donde sale:
//   estrella: emite luz, con halo y llamaradas que salen hacia afuera.
//   fuego: luz calida que parpadea y chispas que suben desde la parte de arriba.
//   lampara: un halo de luz quieto alrededor.
//   lava: chispas que saltan del crater de un volcan activo y vuelven a caer.
//   brillante: destellos que titilan sobre una superficie pulida.
//   agua: reflejos sobre el agua; en los rios avanzan con la corriente.
// Devuelve null si el modelo no lleva efectos.

const PUNTOS = 220 // puntos de la superficie de donde nacen los efectos

// Puntos al azar sobre la superficie, con su direccion hacia afuera. "filtro"
// decide cuales sirven (por ejemplo, solo los de arriba para el fuego).
function puntosDeSuperficie(geometria, semilla, cantidad, filtro = () => true) {
  const muestreador = new MeshSurfaceSampler(new THREE.Mesh(geometria)).setRandomGenerator(crearRandom(semilla)).build()
  const posiciones = []
  const normales = []
  const punto = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const color = new THREE.Color()
  for (let intento = 0; intento < cantidad * 30 && posiciones.length < cantidad * 3; intento++) {
    muestreador.sample(punto, normal, color)
    if (!filtro(punto, normal, color)) continue
    posiciones.push(punto.x, punto.y, punto.z)
    normales.push(normal.x, normal.y, normal.z)
  }
  return { posiciones: new Float32Array(posiciones), normales: new Float32Array(normales) }
}

// Agua: se reconoce por su color (domina el azul) y porque mira hacia arriba.
const esAgua = (punto, normal, color) => normal.y > 0.6 && color.b > color.r * 1.6 && color.b > 0.05

export function planearEfectos({ geometria, altura, tipo, rasgos, semilla, elementos }) {
  geometria.computeBoundingSphere()
  const { center, radius } = geometria.boundingSphere
  const centro = [center.x, center.y, center.z]
  const luz = rasgos?.luz

  if (luz === 'estrella') {
    return { tipo: 'estrella', centro, radio: radius * 0.85, ...puntosDeSuperficie(geometria, semilla, PUNTOS) }
  }
  if (luz === 'fuego') {
    // Las chispas salen de la parte de arriba del objeto.
    const arriba = (punto, normal) => punto.y > altura * 0.7 && normal.y > 0.2
    return { tipo: 'fuego', centro, radio: radius, altura, ...puntosDeSuperficie(geometria, semilla, PUNTOS, arriba) }
  }
  if (luz === 'lampara') return { tipo: 'lampara', centro, radio: radius }
  if (tipo === 'volcan' && rasgos?.activo) {
    // El crater esta en el centro del volcan, cerca de la cima.
    return { tipo: 'lava', centro: [0, altura * 0.82, 0], radio: Math.max(1.2, altura * 0.18) }
  }
  if (luz === 'brillante') return { tipo: 'brillante', centro, ...puntosDeSuperficie(geometria, semilla, 60) }

  const conAgua = ['cascada', 'rio', 'lago', 'costa', 'isla'].includes(tipo) || elementos?.some((e) => ['rio', 'cascada', 'lago', 'mar'].includes(e))
  if (conAgua) {
    const agua = puntosDeSuperficie(geometria, semilla, 90, esAgua)
    if (agua.posiciones.length) {
      return { tipo: 'agua', centro, corriente: ['rio', 'cascada'].includes(tipo) || elementos?.includes('rio'), ...agua }
    }
  }
  return null
}
