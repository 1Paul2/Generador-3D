import * as THREE from 'three'
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { crearRuido } from '../utils/ruido.js'
import { crearArbol } from './arbol.js'
import { aplicarOclusion, calcularOclusion } from './oclusion.js'
import { crearDesdeSilueta } from './silueta.js'
import { crearSer, SERES } from './seres.js'
import { crearTerreno, TERRENOS } from './terreno.js'

// Posicion de la camara al empezar.
export const VISTA = [20, 16, 24]

// Cada figura es una supercuadrica: una sola formula que, cambiando sus
// numeros, pasa de esfera a cubo, cilindro, diamante y todo lo intermedio.
//   ancho, alto, profundo: medio tamano en cada eje.
//   vertical, horizontal: redondez del perfil y de la planta.
//     0.1 = casi cuadrado, 1 = redondo, 2 = en punta (diamante).
//   afinar: cuanto se angosta hacia arriba (0 = nada, 1 = termina en punta).
//   relieve: que tan rugosa es la superficie, como fraccion del tamano.
// Se usan para las formas abstractas ("cubo", "esfera") o cuando no hay foto
// de la cosa para estudiar su silueta.
const FIGURAS = {
  esfera: { ancho: 6, alto: 6, profundo: 6, vertical: 1, horizontal: 1, relieve: 0.01 },
  cubo: { ancho: 4.5, alto: 4.5, profundo: 4.5, vertical: 0.1, horizontal: 0.1 },
  dado: { ancho: 4.5, alto: 4.5, profundo: 4.5, vertical: 0.35, horizontal: 0.35 },
  piramide: { ancho: 6.5, alto: 4.5, profundo: 6.5, vertical: 0.1, horizontal: 0.1, afinar: 1, relieve: 0.01 },
  cilindro: { ancho: 4, alto: 6, profundo: 4, vertical: 0.1, horizontal: 1 },
  cono: { ancho: 5, alto: 6, profundo: 5, vertical: 0.1, horizontal: 1, afinar: 1 },
  diamante: { ancho: 5, alto: 6, profundo: 5, vertical: 1.9, horizontal: 1.9 },
  capsula: { ancho: 2.5, alto: 6, profundo: 2.5, vertical: 0.5, horizontal: 1 },
  cojin: { ancho: 6, alto: 2, profundo: 6, vertical: 0.5, horizontal: 0.3, relieve: 0.01 },
  disco: { ancho: 6, alto: 0.8, profundo: 6, vertical: 0.1, horizontal: 1 },
  huevo: { ancho: 4.5, alto: 6, profundo: 4.5, vertical: 1, horizontal: 1, afinar: 0.3 },
  torre: { ancho: 2.5, alto: 10, profundo: 2.5, vertical: 0.1, horizontal: 0.1, afinar: 0.5 },
  edificio: { ancho: 4, alto: 8, profundo: 4, vertical: 0.1, horizontal: 0.1 },
}

// Medida mas grande que tiene un modelo 3D descargado despues de ajustarlo.
const MEDIDA_MODELO = 12

// Potencia que conserva el signo: (-0.5)^2 = -0.25.
function potencia(base, exponente) {
  return Math.sign(base) * Math.abs(base) ** exponente
}

// Parte de una esfera de muchos vertices y mueve cada vertice segun la formula
// de la supercuadrica:
//   x = ancho    * cos(lat)^vertical * cos(lon)^horizontal
//   y = alto     * sen(lat)^vertical
//   z = profundo * cos(lat)^vertical * sen(lon)^horizontal
// Despues angosta la forma hacia arriba segun "afinar" y la apoya en y = 0.
function crearSupercuadrica(figura, tamano) {
  const { vertical, horizontal, afinar = 0 } = figura
  const [a, b, c] = [figura.ancho * tamano, figura.alto * tamano, figura.profundo * tamano]
  const esfera = new THREE.SphereGeometry(1, 256, 128)
  esfera.deleteAttribute('uv')
  esfera.deleteAttribute('normal')
  const posiciones = esfera.attributes.position

  for (let i = 0; i < posiciones.count; i++) {
    const [x, y, z] = [posiciones.getX(i), posiciones.getY(i), posiciones.getZ(i)]
    const cosLat = Math.hypot(x, z)
    const cosLon = cosLat > 1e-6 ? x / cosLat : 1
    const senLon = cosLat > 1e-6 ? z / cosLat : 0
    const radio = potencia(cosLat, vertical)
    const altura = b * potencia(y, vertical) + b
    const angosto = 1 - afinar * (altura / (2 * b))

    posiciones.setXYZ(
      i,
      a * radio * potencia(cosLon, horizontal) * angosto,
      altura,
      c * radio * potencia(senLon, horizontal) * angosto,
    )
  }

  // Une los vertices repetidos de la esfera (costura y polos) para que la luz
  // se reparta sin cortes.
  const geometria = mergeVertices(esfera)
  esfera.dispose()
  geometria.computeVertexNormals()
  return geometria
}

// Pinta cada vertice con un color de la paleta segun un ruido 3D. Los vertices
// se ordenan por su valor de ruido y se reparten entre los colores segun el
// peso de cada uno, asi el color mas importante cubre mas superficie.
function pintarConPaleta(geometria, paleta, altura, random) {
  const ruido = crearRuido(random)
  const posiciones = geometria.attributes.position
  const escala = 3 / altura
  const desfase = [random() * 100, random() * 100, random() * 100]

  const valores = new Float32Array(posiciones.count)
  for (let i = 0; i < posiciones.count; i++) {
    valores[i] = ruido(
      posiciones.getX(i) * escala + desfase[0],
      posiciones.getY(i) * escala + desfase[1],
      posiciones.getZ(i) * escala + desfase[2],
    )
  }

  const ordenados = Float32Array.from(valores).sort()
  let acumulado = 0
  const cortes = paleta.map(({ peso }) => {
    acumulado += peso
    return ordenados[Math.min(ordenados.length - 1, Math.floor(acumulado * ordenados.length))]
  })

  const colores = paleta.map(({ color: [r, g, b] }) =>
    new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace),
  )
  const atributo = new Float32Array(posiciones.count * 3)
  for (let i = 0; i < posiciones.count; i++) {
    const indice = cortes.findIndex((corte) => valores[i] <= corte)
    colores[indice === -1 ? colores.length - 1 : indice].toArray(atributo, i * 3)
  }
  geometria.setAttribute('color', new THREE.BufferAttribute(atributo, 3))
}

// Empuja cada vertice hacia afuera o hacia adentro, en la direccion en que mira
// la superficie, con un ruido 3D, para que deje de ser lisa segun que tan
// rugosa es la figura. El piso no se mueve, para que el modelo siga apoyado.
function aplicarRelieve(geometria, figura, tamano, altura, random) {
  if (!figura.relieve) return
  const ruido = crearRuido(random)
  const posiciones = geometria.attributes.position
  const normales = geometria.attributes.normal
  const medida = Math.max(figura.ancho, figura.alto, figura.profundo) * tamano
  const escala = 2.5 / medida
  const desfase = [random() * 100, random() * 100, random() * 100]

  const punto = new THREE.Vector3()
  const normal = new THREE.Vector3()
  for (let i = 0; i < posiciones.count; i++) {
    punto.fromBufferAttribute(posiciones, i)
    normal.fromBufferAttribute(normales, i)
    if (punto.y < 1e-3) continue
    const n = ruido(punto.x * escala + desfase[0], punto.y * escala + desfase[1], punto.z * escala + desfase[2], 6)
    // Cerca del piso el relieve se apaga, asi la base queda pareja.
    const subida = Math.min(1, punto.y / (altura * 0.15))
    punto.addScaledVector(normal, (n - 0.5) * 2 * figura.relieve * medida * subida)
    posiciones.setXYZ(i, punto.x, Math.max(0, punto.y), punto.z)
  }
  geometria.computeVertexNormals()
}

// Ajusta un modelo 3D descargado: los archivos STL vienen con el eje Z hacia
// arriba (como en las impresoras 3D) y con cualquier tamano, asi que se gira,
// se escala a una medida comun, se centra y se apoya en el piso. Despues se
// calcula la luz suavizando solo las caras casi paralelas, para no redondear
// las aristas reales del objeto.
function ajustarModelo(original, tamano) {
  const geometria = original.clone()
  geometria.deleteAttribute('normal')
  geometria.rotateX(-Math.PI / 2)
  geometria.computeBoundingBox()
  const caja = geometria.boundingBox
  const medidas = caja.getSize(new THREE.Vector3())
  const centro = caja.getCenter(new THREE.Vector3())
  geometria.translate(-centro.x, -caja.min.y, -centro.z)
  geometria.scale(...Array(3).fill((MEDIDA_MODELO * tamano) / Math.max(medidas.x, medidas.y, medidas.z)))

  const unida = mergeVertices(geometria)
  geometria.dispose()
  // La oclusion necesita los vertices unidos; se guarda como atributo y se
  // aplica despues de pintar.
  unida.computeVertexNormals()
  unida.setAttribute('oclusion', new THREE.BufferAttribute(calcularOclusion(unida), 1))
  const suave = toCreasedNormals(unida, Math.PI / 6)
  unida.dispose()
  return suave
}

// Elige como construir la cosa, de lo mas fiel a lo mas general:
//   1. Un modelo 3D real descargado (receta.modelo), pintado con los colores
//      identificados en la foto.
//   2. Un paisaje como terreno, un arbol por ramificacion o un ser vivo por
//      su plan corporal (cuadrupedo, ave, pez, persona).
//   3. La silueta identificada en la foto, hecha 3D por torno o inflado.
//   4. Una figura supercuadrica (formas abstractas o cosas sin foto).
// apariencia: { segmento, regiones } si se pudo estudiar una foto, { imagen }
// para los tonos de terrenos y arboles, y { paleta } con colores de respaldo.
export function crearForma(receta, apariencia, random) {
  const paleta =
    apariencia.regiones && !receta.colorElegido ? [...apariencia.regiones.paleta.values()] : apariencia.paleta

  if (receta.modelo) {
    const geometria = ajustarModelo(receta.modelo, receta.tamano)
    geometria.computeBoundingBox()
    const altura = geometria.boundingBox.max.y
    pintarConPaleta(geometria, paleta, altura, random)
    aplicarOclusion(geometria, geometria.attributes.oclusion.array)
    return { geometria, altura, metodo: 'modelo' }
  }
  if (TERRENOS.includes(receta.tipo)) return { ...crearTerreno(receta, apariencia, random), metodo: 'terreno' }
  if (receta.tipo === 'arbol') return { ...crearArbol(receta, apariencia, random), metodo: 'arbol' }
  if (SERES.includes(receta.tipo)) return { ...crearSer(receta, apariencia), metodo: 'ser' }
  if (apariencia.segmento) return crearDesdeSilueta(apariencia.segmento, apariencia.regiones, receta)

  const figura = FIGURAS[receta.tipo]
  const geometria = crearSupercuadrica(figura, receta.tamano)
  geometria.computeBoundingBox()
  const altura = geometria.boundingBox.max.y
  pintarConPaleta(geometria, paleta, altura, random)
  aplicarRelieve(geometria, figura, receta.tamano, altura, random)
  aplicarOclusion(geometria, calcularOclusion(geometria))
  geometria.computeBoundingBox()
  return { geometria, altura: geometria.boundingBox.max.y, metodo: 'figura' }
}
