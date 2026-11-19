import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { crearRuido } from '../utils/ruido.js'
import { aplicarOclusion, calcularOclusion } from './oclusion.js'

// Arboles por ramificacion recursiva (la idea de los L-systems): el tronco se
// divide en ramas, cada rama en otras mas cortas y delgadas, y en las puntas
// crece el follaje. Las coniferas (pinos, abetos) se arman distinto: un tronco
// recto con pisos de follaje en forma de cono, mas anchos abajo.

const COLOR = {
  corteza: [92, 66, 44],
  hojas: [62, 112, 46],
  hojasConifera: [34, 78, 44],
}

const ARRIBA = new THREE.Vector3(0, 1, 0)

const mezclar = (c1, c2, t) => c1.map((valor, i) => valor + (c2[i] - valor) * t)

// Para unir piezas todas tienen que tener sus triangulos sueltos (sin indice).
const sinIndice = (geometria) => (geometria.index ? geometria.toNonIndexed() : geometria)

// Color de las hojas en la foto: promedio de los pixeles donde domina el verde.
function verdeDeFoto(imagen) {
  const suma = [0, 0, 0]
  let cuenta = 0
  for (let p = 0; p < imagen.pixeles.length; p += 4) {
    const [r, g, b] = [imagen.pixeles[p], imagen.pixeles[p + 1], imagen.pixeles[p + 2]]
    if (g > r * 1.05 && g > b * 1.1) {
      suma[0] += r
      suma[1] += g
      suma[2] += b
      cuenta++
    }
  }
  return cuenta > 50 ? suma.map((valor) => valor / cuenta) : null
}

// Pinta todos los vertices de una geometria con un color, variando el brillo
// con ruido para que no se vea plano.
function pintar(geometria, rgb, ruido, variacion) {
  const posiciones = geometria.attributes.position
  const colores = new Float32Array(posiciones.count * 3)
  const color = new THREE.Color()
  for (let i = 0; i < posiciones.count; i++) {
    const n = ruido(posiciones.getX(i) * 0.8, posiciones.getY(i) * 0.8, posiciones.getZ(i) * 0.8, 3)
    const luz = 1 + (n - 0.5) * 2 * variacion
    color.setRGB((rgb[0] * luz) / 255, (rgb[1] * luz) / 255, (rgb[2] * luz) / 255, THREE.SRGBColorSpace)
    color.toArray(colores, i * 3)
  }
  geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3))
  return geometria
}

// Tramo de rama: un cilindro que va de "base" en la direccion dada.
function tramo(base, direccion, largo, radioAbajo, radioArriba) {
  const cilindro = new THREE.CylinderGeometry(radioArriba, radioAbajo, largo, 8, 1, true)
  cilindro.translate(0, largo / 2, 0)
  cilindro.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, direccion))
  cilindro.translate(base.x, base.y, base.z)
  return cilindro
}

// Mata de follaje: una esfera abollada con ruido para que parezca un monton de hojas.
function mata(centro, radio, ruido) {
  const esfera = new THREE.IcosahedronGeometry(radio, 3)
  const posiciones = esfera.attributes.position
  const punto = new THREE.Vector3()
  for (let i = 0; i < posiciones.count; i++) {
    punto.fromBufferAttribute(posiciones, i)
    const n = ruido(punto.x * 1.5 + centro.x, punto.y * 1.5 + centro.y, punto.z * 1.5 + centro.z, 3)
    punto.multiplyScalar(0.75 + 0.5 * n)
    posiciones.setXYZ(i, punto.x, punto.y, punto.z)
  }
  esfera.translate(centro.x, centro.y, centro.z)
  return esfera
}

function arbolDeHojas(escala, random, ruido, colores) {
  const ramas = []
  const hojas = []

  // Cada rama crece, y si no es la ultima se divide en 2 a 4 ramas hijas que
  // salen inclinadas, repartidas alrededor (angulo de oro) y algo hacia arriba.
  function crecer(base, direccion, largo, radio, nivel) {
    const fin = base.clone().addScaledVector(direccion, largo)
    ramas.push(tramo(base, direccion, largo, radio, radio * 0.7))

    if (nivel === 0) {
      hojas.push(mata(fin, escala * (0.9 + random() * 0.6), ruido))
      return
    }
    const hijas = 2 + Math.floor(random() * 3)
    const giro = random() * Math.PI * 2
    for (let h = 0; h < hijas; h++) {
      const apertura = THREE.MathUtils.degToRad(25 + random() * 25)
      const alrededor = giro + h * 2.39996
      const lateral = new THREE.Vector3(Math.cos(alrededor), 0, Math.sin(alrededor))
      const nueva = direccion
        .clone()
        .multiplyScalar(Math.cos(apertura))
        .addScaledVector(lateral, Math.sin(apertura))
        .add(new THREE.Vector3(0, 0.25, 0))
        .normalize()
      crecer(fin, nueva, largo * (0.65 + random() * 0.15), radio * 0.65, nivel - 1)
    }
  }

  crecer(new THREE.Vector3(0, 0, 0), ARRIBA.clone(), 4.5 * escala, 0.55 * escala, 4)
  return [
    pintar(mergeGeometries(ramas.map(sinIndice)), colores.corteza, ruido, 0.15),
    pintar(mergeGeometries(hojas.map(sinIndice)), colores.hojas, ruido, 0.3),
  ]
}

function conifera(escala, random, ruido, colores) {
  const alto = 14 * escala
  const tronco = tramo(new THREE.Vector3(0, 0, 0), ARRIBA, alto * 0.95, 0.45 * escala, 0.08 * escala)

  const pisos = []
  const cantidad = 6 + Math.floor(random() * 3)
  for (let p = 0; p < cantidad; p++) {
    const t = p / cantidad
    const radio = (1 - t) * 4.5 * escala + 0.6 * escala
    const altoPiso = alto * 0.22
    const cono = new THREE.ConeGeometry(radio, altoPiso, 48, 8)
    const posiciones = cono.attributes.position
    for (let i = 0; i < posiciones.count; i++) {
      const [x, y, z] = [posiciones.getX(i), posiciones.getY(i), posiciones.getZ(i)]
      const n = ruido(x * 1.2, y * 1.2 + p * 10, z * 1.2, 3)
      const abolladura = 0.8 + 0.4 * n
      posiciones.setXYZ(i, x * abolladura, y, z * abolladura)
    }
    cono.translate(0, alto * 0.18 + t * alto * 0.72 + altoPiso / 2, 0)
    pisos.push(sinIndice(cono))
  }
  return [
    pintar(sinIndice(tronco), colores.corteza, ruido, 0.15),
    pintar(mergeGeometries(pisos), colores.hojasConifera, ruido, 0.3),
  ]
}

export function crearArbol(receta, apariencia, random) {
  const ruido = crearRuido(random)
  const verde = apariencia.imagen ? verdeDeFoto(apariencia.imagen) : null
  const elegido = receta.colorElegido
    ? [1, 3, 5].map((i) => parseInt(receta.color.slice(i, i + 2), 16))
    : null
  const tono = elegido ?? verde
  const colores = {
    corteza: COLOR.corteza,
    hojas: tono ? mezclar(COLOR.hojas, tono, 0.6) : COLOR.hojas,
    hojasConifera: tono ? mezclar(COLOR.hojasConifera, tono, 0.5) : COLOR.hojasConifera,
  }

  const partes = receta.rasgos?.conifera
    ? conifera(receta.tamano, random, ruido, colores)
    : arbolDeHojas(receta.tamano, random, ruido, colores)
  // Se unen los vertices repetidos de cada parte para que la luz se reparta
  // suave sobre el follaje y la corteza, sin facetas.
  const suaves = partes.map((parte) => {
    parte.deleteAttribute('uv')
    parte.deleteAttribute('normal')
    const unida = mergeVertices(parte)
    parte.dispose()
    unida.computeVertexNormals()
    return unida
  })
  const geometria = mergeGeometries(suaves)
  suaves.forEach((parte) => parte.dispose())
  // El follaje se oscurece entre mata y mata, donde la luz entra menos.
  aplicarOclusion(geometria, calcularOclusion(geometria))
  geometria.computeBoundingBox()
  return { geometria, altura: geometria.boundingBox.max.y }
}
