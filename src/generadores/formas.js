import * as THREE from 'three'
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { crearRuido } from '../utils/ruido.js'
import { crearArbol } from './arbol.js'
import { aplicarOclusion, calcularOclusion } from './oclusion.js'
import { crearDesdeSilueta } from './silueta.js'
import { colorearPorPixel } from '../analisis/colores.js'
import { crearTexturaObjeto } from '../analisis/textura.js'
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

// Pinta un modelo con los colores de su foto, sin que se noten uniones:
//   1. Proyeccion: desde el angulo de la camara, el rectangulo que ocupa el
//      objeto en la foto se alinea con el modelo; cada vertice que mira hacia
//      la camara toma el color del pixel que le cae encima.
//   2. Sintesis de textura: los costados y la espalda no salen de estirar la
//      foto (eso deja franjas), sino de un ruido 3D continuo que elige, para
//      cada punto, un lugar de la foto. Como el ruido cambia suave de un punto
//      al vecino, la textura fluye sin cortes y con el grano de la foto real.
//   3. Fundido: cada vertice mezcla las dos segun cuanto mira hacia la camara,
//      asi no hay una linea donde termine una y empiece la otra.
// Se usan los colores ya identificados por pixel (colorearPorPixel), nunca el
// fondo: si un punto cae fuera de la silueta, toma el pixel del objeto mas cercano.
// Correccion - Poll: la proyeccion de la foto dejaba franjas estiradas y uniones visibles
function colorearAlineado(geometria, segmento, porPixel, random) {
  const { mascara, ancho, alto } = segmento
  let [x0, y0, x1, y1] = [ancho, alto, -1, -1]
  for (let i = 0; i < mascara.length; i++) {
    if (!mascara[i]) continue
    const [x, y] = [i % ancho, Math.floor(i / ancho)]
    ;[x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)]
  }
  // Pixel del objeto mas cercano: se busca hacia los costados y hacia arriba y abajo.
  const delObjeto = (x, y) => {
    for (let paso = 0; paso < Math.max(ancho, alto); paso++) {
      for (const [dx, dy] of [[paso, 0], [-paso, 0], [0, paso], [0, -paso]]) {
        const [xx, yy] = [x + dx, y + dy]
        if (xx >= 0 && yy >= 0 && xx < ancho && yy < alto && mascara[yy * ancho + xx]) return yy * ancho + xx
      }
    }
    return y * ancho + x
  }

  const pixel = (u, w) =>
    delObjeto(
      Math.min(ancho - 1, Math.max(0, Math.round(x0 + u * (x1 - x0)))),
      Math.min(alto - 1, Math.max(0, Math.round(y1 - w * (y1 - y0)))),
    )

  // Direccion de la camara y los ejes de la foto vistos desde ahi.
  geometria.computeBoundingBox()
  const caja = geometria.boundingBox
  const centro = caja.getCenter(new THREE.Vector3())
  const direccion = new THREE.Vector3(...VISTA).sub(centro).normalize()
  const derecha = new THREE.Vector3(0, 1, 0).cross(direccion).normalize()
  const arriba = direccion.clone().cross(derecha)

  const posiciones = geometria.attributes.position
  if (!geometria.attributes.normal) geometria.computeVertexNormals()
  const normales = geometria.attributes.normal
  const punto = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const proyeccion = new Float32Array(posiciones.count * 2)
  let [minU, maxU, minV, maxV] = [Infinity, -Infinity, Infinity, -Infinity]
  for (let v = 0; v < posiciones.count; v++) {
    punto.fromBufferAttribute(posiciones, v).sub(centro)
    const [u, w] = [punto.dot(derecha), punto.dot(arriba)]
    proyeccion[v * 2] = u
    proyeccion[v * 2 + 1] = w
    ;[minU, maxU, minV, maxV] = [Math.min(minU, u), Math.max(maxU, u), Math.min(minV, w), Math.max(maxV, w)]
  }

  const ruido = crearRuido(random)
  const medida = Math.max(caja.max.x - caja.min.x, caja.max.y - caja.min.y, caja.max.z - caja.min.z)
  // Escala del ruido: con 3, la textura sintetica de atras tiene el mismo grano
  // que la foto proyectada adelante (medido: 96%), y la union no se nota.
  const escala = 3 / medida
  const desfases = [random() * 100, random() * 100]
  // El ruido se concentra cerca de la mitad; se estira para recorrer toda la foto.
  const abrir = (n) => Math.min(1, Math.max(0, (n - 0.5) * 2.6 + 0.5))
  const suave = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }

  const colores = new Float32Array(posiciones.count * 3)
  const color = new THREE.Color()
  for (let v = 0; v < posiciones.count; v++) {
    const frente = (proyeccion[v * 2] - minU) / Math.max(1e-6, maxU - minU)
    const alturaFoto = (proyeccion[v * 2 + 1] - minV) / Math.max(1e-6, maxV - minV)
    const proyectado = pixel(frente, alturaFoto) * 3

    // Cuanto mira el vertice hacia la camara (1 = de frente).
    const mira = suave(0.15, 0.6, normal.fromBufferAttribute(normales, v).dot(direccion))
    let [r, g, b] = [porPixel[proyectado], porPixel[proyectado + 1], porPixel[proyectado + 2]]
    if (mira < 1) {
      punto.fromBufferAttribute(posiciones, v).multiplyScalar(escala)
      const sintetico =
        pixel(abrir(ruido(punto.x + desfases[0], punto.y, punto.z, 4)), abrir(ruido(punto.x, punto.y + desfases[1], punto.z, 4))) * 3
      r = porPixel[sintetico] + (r - porPixel[sintetico]) * mira
      g = porPixel[sintetico + 1] + (g - porPixel[sintetico + 1]) * mira
      b = porPixel[sintetico + 2] + (b - porPixel[sintetico + 2]) * mira
    }
    color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
    color.toArray(colores, v * 3)
  }
  geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3))

  // Los mismos datos, para que la tarjeta grafica repita este calculo en cada
  // pixel de la pantalla (ver efectos/materialFoto.js).
  return {
    caja: [x0 / ancho, y0 / alto, (x1 + 1) / ancho, (y1 + 1) / alto],
    centro: centro.toArray(),
    derecha: derecha.toArray(),
    arriba: arriba.toArray(),
    direccion: direccion.toArray(),
    limites: [minU, maxU, minV, maxV],
    escala,
    desfases,
  }
}

// Figuras cuya silueta real conviene mas que la figura: las estructuras
// (una torre o un edificio) tienen perfiles propios que la figura no imita.
const SILUETA_PRIMERO = new Set(['torre', 'edificio'])

// Elige como construir la cosa, de lo mas fiel a lo mas general:
//   1. Un modelo 3D real descargado (receta.modelo), pintado con los colores
//      de la foto alineados pixel por pixel.
//   2. Un paisaje como terreno, un arbol por ramificacion o un ser vivo por
//      su plan corporal (cuadrupedo, ave, pez, persona).
//   3. Si la forma es una figura conocida (una estrella es una esfera), la
//      figura exacta, pintada con los colores de la foto alineados.
//   4. Si no, la silueta identificada en la foto, hecha 3D por torno o inflado.
//   5. Una figura supercuadrica pintada con tonos (formas abstractas, sin foto).
// apariencia: { segmento, regiones } si se pudo estudiar una foto, { imagen }
// para los tonos de terrenos y arboles, y { paleta } con colores de respaldo.
// Correccion - Poll: una cosa con forma conocida (el Sol, una esfera) salia como silueta inflada con costuras
export function crearForma(receta, apariencia, random) {
  const paleta =
    apariencia.regiones && !receta.colorElegido ? [...apariencia.regiones.paleta.values()] : apariencia.paleta
  // Colores de la foto por pixel, para la proyeccion alineada.
  const porPixel = apariencia.segmento && !receta.colorElegido ? colorearPorPixel(apariencia.segmento) : null
  // Pinta el modelo. Con foto, ademas de los colores por vertice devuelve los
  // datos para pintarlo pixel por pixel en pantalla con la foto en alta resolucion.
  const pintar = (geometria, altura) => {
    if (!porPixel) {
      pintarConPaleta(geometria, paleta, altura, random)
      return null
    }
    const proyeccion = colorearAlineado(geometria, apariencia.segmento, porPixel, random)
    return apariencia.imagen ? { ...proyeccion, textura: crearTexturaObjeto(apariencia.imagen, apariencia.segmento) } : null
  }

  if (receta.modelo) {
    const geometria = ajustarModelo(receta.modelo, receta.tamano)
    geometria.computeBoundingBox()
    const altura = geometria.boundingBox.max.y
    const foto = pintar(geometria, altura)
    aplicarOclusion(geometria, geometria.attributes.oclusion.array)
    return { geometria, altura, metodo: 'modelo', foto }
  }
  if (TERRENOS.includes(receta.tipo)) return { ...crearTerreno(receta, apariencia, random), metodo: 'terreno' }
  if (receta.tipo === 'arbol') return { ...crearArbol(receta, apariencia, random), metodo: 'arbol' }
  if (SERES.includes(receta.tipo)) return { ...crearSer(receta, apariencia), metodo: 'ser' }
  if (apariencia.segmento && (!FIGURAS[receta.tipo] || SILUETA_PRIMERO.has(receta.tipo))) {
    return crearDesdeSilueta(apariencia.segmento, apariencia.regiones, receta)
  }

  const figura = FIGURAS[receta.tipo]
  const geometria = crearSupercuadrica(figura, receta.tamano)
  geometria.computeBoundingBox()
  const altura = geometria.boundingBox.max.y
  const foto = pintar(geometria, altura)
  aplicarRelieve(geometria, figura, receta.tamano, altura, random)
  aplicarOclusion(geometria, calcularOclusion(geometria))
  geometria.computeBoundingBox()
  return { geometria, altura: geometria.boundingBox.max.y, metodo: porPixel ? 'figuraFoto' : 'figura', foto }
}
