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
  roca: { ancho: 5.5, alto: 3.5, profundo: 4.5, vertical: 0.75, horizontal: 0.7, afinar: 0.2, relieve: 0.09 },
  torre: { ancho: 2.5, alto: 10, profundo: 2.5, vertical: 0.1, horizontal: 0.1, afinar: 0.5 },
  edificio: { ancho: 4, alto: 8, profundo: 4, vertical: 0.1, horizontal: 0.1 },
}

// Medida mas grande que tiene un modelo 3D descargado despues de ajustarlo.
const MEDIDA_MODELO = 12

// Divisiones por lado de cada cara del cubo con que se arma la esfera.
const DIVISIONES = 96

// Esfera hecha desde un cubo subdividido, inflando cada cara hacia afuera.
// A diferencia de la esfera de paralelos y meridianos, no tiene polos donde
// se juntan todas las franjas (ahi quedaba una costura) y sus vertices se
// reparten parejo por toda la superficie.
function crearEsferaSinPolos(divisiones) {
  const cubo = new THREE.BoxGeometry(2, 2, 2, divisiones, divisiones, divisiones)
  cubo.deleteAttribute('uv')
  cubo.deleteAttribute('normal')
  const posiciones = cubo.attributes.position
  for (let i = 0; i < posiciones.count; i++) {
    const [x, y, z] = [posiciones.getX(i), posiciones.getY(i), posiciones.getZ(i)]
    // Proyeccion del cubo a la esfera que deja las celdas de tamano parejo.
    posiciones.setXYZ(
      i,
      x * Math.sqrt(1 - (y * y) / 2 - (z * z) / 2 + (y * y * z * z) / 3),
      y * Math.sqrt(1 - (z * z) / 2 - (x * x) / 2 + (z * z * x * x) / 3),
      z * Math.sqrt(1 - (x * x) / 2 - (y * y) / 2 + (x * x * y * y) / 3),
    )
  }
  return cubo
}

// Parte de una esfera de muchos vertices y lleva cada vertice, en linea recta
// desde el centro, hasta la superficie de la supercuadrica, que cumple:
//   (|x/ancho|^(2/horizontal) + |z/profundo|^(2/horizontal))^(horizontal/vertical)
//     + |y/alto|^(2/vertical) = 1
// Esa suma crece como una potencia de la distancia al centro, asi que el
// punto exacto donde la recta corta la superficie se calcula directo. Los
// vertices quedan repartidos parejo en las caras y en las aristas (con la
// formula por angulos se amontonaban en los bordes y dejaban triangulos
// larguisimos en los costados, que se veian como vetas).
// Despues angosta la forma hacia arriba segun "afinar" y la apoya en y = 0.
// Correccion - Poll: la tapa de las figuras mostraba una costura en el polo de la esfera
// Correccion - Poll: los costados de cubos y cilindros se pintaban con vetas
function crearSupercuadrica(figura, tamano) {
  const { vertical, horizontal, afinar = 0 } = figura
  const [a, b, c] = [figura.ancho * tamano, figura.alto * tamano, figura.profundo * tamano]
  const esfera = crearEsferaSinPolos(DIVISIONES)
  const posiciones = esfera.attributes.position

  for (let i = 0; i < posiciones.count; i++) {
    const [x, y, z] = [posiciones.getX(i), posiciones.getY(i), posiciones.getZ(i)]
    const suma =
      (Math.abs(x) ** (2 / horizontal) + Math.abs(z) ** (2 / horizontal)) ** (horizontal / vertical) +
      Math.abs(y) ** (2 / vertical)
    const t = suma ** (-vertical / 2)
    const altura = b * y * t + b
    const angosto = 1 - afinar * (altura / (2 * b))
    posiciones.setXYZ(i, a * x * t * angosto, altura, c * z * t * angosto)
  }

  // Une los vertices repetidos de la esfera (costura y polos) para que la luz
  // se reparta sin cortes.
  const geometria = mergeVertices(esfera)
  esfera.dispose()
  geometria.computeVertexNormals()
  return geometria
}

// Ancho de la mezcla entre dos colores vecinos de la paleta, como fraccion de
// la superficie: los colores pasan de uno a otro sin bordes escalonados.
const MEZCLA = 0.06
// Variacion de brillo del grano fino (poros, granos de la piedra).
const GRANO = 0.12

// Pinta cada vertice con los colores de la paleta segun un ruido 3D. Los
// vertices se ordenan por su valor de ruido y se reparten entre los colores
// segun el peso de cada uno, asi el color mas importante cubre mas superficie.
// En el limite entre dos colores se mezclan, y encima va un grano fino.
// Correccion - Poll: las manchas de color tenian bordes escalonados, sin transicion
function pintarConPaleta(geometria, paleta, altura, random) {
  const ruido = crearRuido(random)
  const posiciones = geometria.attributes.position
  const escala = 3 / altura
  const desfase = [random() * 100, random() * 100, random() * 100]

  const valores = new Float32Array(posiciones.count)
  const granos = new Float32Array(posiciones.count)
  for (let i = 0; i < posiciones.count; i++) {
    const [x, y, z] = [posiciones.getX(i) * escala, posiciones.getY(i) * escala, posiciones.getZ(i) * escala]
    valores[i] = ruido(x + desfase[0], y + desfase[1], z + desfase[2], 5)
    granos[i] = ruido(x * 12 + desfase[2], y * 12 + desfase[0], z * 12 + desfase[1], 2)
  }

  // Lugar de cada vertice en el orden (0 = el valor mas bajo, 1 = el mas alto).
  const orden = Array.from(valores.keys()).sort((a, b) => valores[a] - valores[b])
  const lugar = new Float32Array(posiciones.count)
  orden.forEach((vertice, k) => (lugar[vertice] = k / orden.length))

  const total = paleta.reduce((suma, { peso }) => suma + peso, 0)
  let acumulado = 0
  const cortes = paleta.map(({ peso }) => (acumulado += peso / total))
  const colores = paleta.map(({ color: [r, g, b] }) =>
    new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace),
  )

  const color = new THREE.Color()
  const atributo = new Float32Array(posiciones.count * 3)
  for (let i = 0; i < posiciones.count; i++) {
    const t = lugar[i]
    let indice = cortes.findIndex((corte) => t <= corte)
    if (indice === -1) indice = colores.length - 1
    color.copy(colores[indice])
    // Cerca del corte con el color siguiente (o el anterior) se mezclan.
    const hastaSiguiente = cortes[indice] - t
    const desdeAnterior = t - (cortes[indice - 1] ?? -1)
    if (indice < colores.length - 1 && hastaSiguiente < MEZCLA) {
      color.lerp(colores[indice + 1], 0.5 * (1 - hastaSiguiente / MEZCLA))
    } else if (indice > 0 && desdeAnterior < MEZCLA) {
      color.lerp(colores[indice - 1], 0.5 * (1 - desdeAnterior / MEZCLA))
    }
    color.multiplyScalar(1 + (granos[i] - 0.5) * 2 * GRANO)
    color.toArray(atributo, i * 3)
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

// Pinta un modelo con su foto envolviendolo, sin uniones ni estiramientos.
// La foto muestra solo la cara de adelante; proyectarla de frente estira el
// borde finito del objeto sobre todo lo que queda de perfil (franjas). En
// cambio, cada punto se ubica por:
//   - su angulo respecto de la camara (0 de frente, 90 de perfil, 180 atras),
//   - y la direccion hacia la que esta (arriba, a la derecha...).
// Ademas se compensa la luz con la que se saco la foto (perfilDeBrillo).
// En esa direccion se lee la foto desde el centro del objeto hacia su borde:
// la mitad de adelante recorre todo el objeto en la foto y la de atras lo
// recorre de vuelta (su reflejo). La lectura avanza parejo en toda la vuelta,
// asi ninguna zona se estira, y en la union las dos mitades leen los mismos
// pixeles. El contorno se mide en cada direccion, asi sirve para cualquier
// forma y no solo para circulos. El ultimo tramo del borde de la foto no se
// usa: ahi el color se oscurece o se mezcla con el fondo.
// Se usan los colores ya identificados por pixel (colorearPorPixel), nunca el
// fondo: si un punto cae fuera de la silueta, toma el pixel del objeto mas cercano.
// Correccion - Poll: la proyeccion de la foto dejaba franjas estiradas y uniones visibles
function colorearAlineado(geometria, segmento, porPixel) {
  const { mascara, ancho, alto } = segmento
  const { centroFoto, radios } = medirContorno(segmento)
  const perfil = perfilDeBrillo(segmento, centroFoto, radios)

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

  // Direccion de la camara y los ejes de la foto vistos desde ahi.
  geometria.computeBoundingBox()
  const centro = geometria.boundingBox.getCenter(new THREE.Vector3())
  const direccion = new THREE.Vector3(...VISTA).sub(centro).normalize()
  const derecha = new THREE.Vector3(0, 1, 0).cross(direccion).normalize()
  const arriba = direccion.clone().cross(derecha)

  const posiciones = geometria.attributes.position
  const punto = new THREE.Vector3()
  const colores = new Float32Array(posiciones.count * 3)
  const color = new THREE.Color()
  for (let v = 0; v < posiciones.count; v++) {
    punto.fromBufferAttribute(posiciones, v).sub(centro)
    const [x, y, z] = [punto.dot(derecha), punto.dot(arriba), punto.dot(direccion)]
    const [px, py, parte] = leerEnvolvente(Math.atan2(Math.hypot(x, y), z), Math.atan2(y, x), centroFoto, radios)
    const i = delObjeto(Math.min(ancho - 1, Math.max(0, Math.round(px))), Math.min(alto - 1, Math.max(0, Math.round(py)))) * 3
    const luz = aclarado(perfil, parte) / 255
    color.setRGB(Math.min(1, porPixel[i] * luz), Math.min(1, porPixel[i + 1] * luz), Math.min(1, porPixel[i + 2] * luz), THREE.SRGBColorSpace)
    color.toArray(colores, v * 3)
  }
  geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3))

  // Los mismos datos, para que la tarjeta grafica repita este calculo en cada
  // pixel de la pantalla (ver efectos/materialFoto.js).
  return {
    centro: centro.toArray(),
    derecha: derecha.toArray(),
    arriba: arriba.toArray(),
    direccion: direccion.toArray(),
    centroFoto,
    radios: Array.from(radios),
    perfil: Array.from(perfil),
    tamano: [ancho, alto],
    alcance: ALCANCE,
  }
}

// Direcciones en que se mide el contorno del objeto en la foto.
const RADIOS = 64
// Parte del radio del objeto en la foto que se recorre. El anillo del borde no
// se usa: ahi la foto tiene efectos que dependen del angulo desde el que se
// saco (el borde se ve mas oscuro, aparecen brillos) y al envolver se repiten.
const ALCANCE = 0.78
// Anillos en que se mide el brillo promedio de la foto, del centro al borde.
const ANILLOS = 24

// Perfil de brillo de la foto: cuanto hay que aclarar cada anillo (del centro
// al borde) para que quede tan claro como el centro. Una foto trae la luz con
// la que se saco (en un objeto redondo, el borde se ve mas oscuro porque se mira
// de costado); en 3D esa luz la pone la escena, asi que se compensa.
function perfilDeBrillo({ mascara, colores, ancho }, centroFoto, radios) {
  const suma = new Float64Array(ANILLOS)
  const cuenta = new Float64Array(ANILLOS)
  for (let i = 0; i < mascara.length; i++) {
    if (!mascara[i]) continue
    const [dx, dy] = [(i % ancho) - centroFoto[0], centroFoto[1] - Math.floor(i / ancho)]
    const a = ((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * RADIOS
    const radio = radios[Math.floor(a) % RADIOS]
    const anillo = Math.min(ANILLOS - 1, Math.floor((Math.hypot(dx, dy) / radio) * ANILLOS))
    const [r, g, b] = colores[i]
    suma[anillo] += 0.299 * r + 0.587 * g + 0.114 * b
    cuenta[anillo]++
  }
  const brillo = Array.from(suma, (s, k) => (cuenta[k] ? s / cuenta[k] : 0))
  const centro = brillo.slice(0, 4).filter(Boolean)
  const referencia = centro.reduce((a, b) => a + b, 0) / Math.max(1, centro.length)
  return Float32Array.from(brillo, (b) => (b > 1 ? Math.min(2.5, Math.max(1, referencia / b)) : 1))
}

// Centro del objeto en la foto y su radio en cada direccion (en pixeles de la
// grilla): desde el centro se avanza hasta salir de la silueta.
function medirContorno({ mascara, ancho, alto }) {
  let [sx, sy, n] = [0, 0, 0]
  for (let i = 0; i < mascara.length; i++) {
    if (!mascara[i]) continue
    sx += i % ancho
    sy += Math.floor(i / ancho)
    n++
  }
  const centroFoto = [sx / n, sy / n]
  const radios = new Float32Array(RADIOS)
  for (let k = 0; k < RADIOS; k++) {
    const angulo = (k / RADIOS) * Math.PI * 2
    const [dx, dy] = [Math.cos(angulo), -Math.sin(angulo)]
    let radio = 0
    for (let r = 0; r < Math.max(ancho, alto); r += 0.5) {
      const [x, y] = [Math.round(centroFoto[0] + dx * r), Math.round(centroFoto[1] + dy * r)]
      if (x < 0 || y < 0 || x >= ancho || y >= alto || !mascara[y * ancho + x]) break
      radio = r
    }
    radios[k] = Math.max(1, radio)
  }
  return { centroFoto, radios }
}

// Que pixel de la foto (en la grilla) le toca a un punto, segun su angulo con
// la camara (theta) y su direccion (phi). Adelante (theta hasta 90) se va del
// centro al borde; atras se vuelve del borde al centro. sen(theta / 2) avanza
// sin frenarse en el perfil, por eso no hay estiramiento.
// Devuelve [x, y, parte del radio recorrida (0 centro, ALCANCE borde leido)].
function leerEnvolvente(theta, phi, centroFoto, radios) {
  const avance = Math.sin((theta <= Math.PI / 2 ? theta : Math.PI - theta) / 2) / Math.SQRT1_2
  const a = (((phi % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * RADIOS
  const [i0, t] = [Math.floor(a) % RADIOS, a - Math.floor(a)]
  const radio = (radios[i0] + (radios[(i0 + 1) % RADIOS] - radios[i0]) * t) * ALCANCE * avance
  return [centroFoto[0] + Math.cos(phi) * radio, centroFoto[1] - Math.sin(phi) * radio, ALCANCE * avance]
}

// Aclarado del anillo donde cae una lectura (interpolado entre anillos).
function aclarado(perfil, parte) {
  const a = Math.min(ANILLOS - 1, Math.max(0, parte * ANILLOS - 0.5))
  const i0 = Math.floor(a)
  return perfil[i0] + (perfil[Math.min(ANILLOS - 1, i0 + 1)] - perfil[i0]) * (a - i0)
}

// Figuras cuya silueta real conviene mas que la figura: las estructuras
// (una torre o un edificio) tienen perfiles propios que la figura no imita.
const SILUETA_PRIMERO = new Set(['torre', 'edificio'])

// Fraccion de la foto que ocupa el objeto. Si es muy chica, la foto no muestra
// una cosa suelta sino una superficie que llena el cuadro (un empedrado, una
// pared de roca) y lo separado es solo una astilla de ella: no sirve como
// silueta ni para proyectar sus colores.
function fraccionDelObjeto({ mascara }) {
  let area = 0
  for (let i = 0; i < mascara.length; i++) area += mascara[i]
  return area / mascara.length
}

// Por debajo de esta fraccion de la foto, se toma como una superficie.
const SUPERFICIE = 0.02
// Franjas de brillo en que se divide una foto de superficie.
const FRANJAS = 6

// Paleta de una foto de superficie: sus pixeles ordenados del mas oscuro al
// mas claro y divididos en franjas iguales, cada una con su color promedio.
// Asi se conserva cuanto hay de cada tono (las grietas oscuras, las caras
// claras), y como la paleta va de oscuro a claro, al repartirla con el ruido
// los tonos vecinos quedan juntos, como en la piedra real.
function paletaDeSuperficie({ colores, lab }) {
  const orden = Array.from(lab.keys()).sort((a, b) => lab[a][0] - lab[b][0])
  return Array.from({ length: FRANJAS }, (_, f) => {
    const franja = orden.slice(Math.floor((f * orden.length) / FRANJAS), Math.floor(((f + 1) * orden.length) / FRANJAS))
    const suma = [0, 0, 0]
    for (const i of franja) for (let c = 0; c < 3; c++) suma[c] += colores[i][c]
    return { color: suma.map((v) => v / franja.length), peso: 1 / FRANJAS }
  })
}

// Grosor de las uniones que se cortan para separar piezas, como fraccion del
// lado mas corto de la foto.
const UNION = 0.04

// Pasos (en 4 direcciones) desde cada pixel de "dentro" hasta el pixel mas
// cercano de "desde", sin salir de "dentro", hasta un maximo.
function pasosDesde(desde, dentro, ancho, maximo) {
  const pasos = new Uint16Array(desde.length).fill(maximo + 1)
  let frente = []
  for (let i = 0; i < desde.length; i++) {
    if (desde[i]) {
      pasos[i] = 0
      frente.push(i)
    }
  }
  for (let paso = 1; paso <= maximo && frente.length; paso++) {
    const siguiente = []
    for (const i of frente) {
      const x = i % ancho
      for (const v of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
        if (v >= 0 && v < desde.length && dentro[v] && pasos[v] > paso) {
          pasos[v] = paso
          siguiente.push(v)
        }
      }
    }
    frente = siguiente
  }
  return pasos
}

// Se queda con una sola pieza del objeto. Una foto puede mostrar varias cosas
// que se tocan (dos naranjas y unos gajos, un racimo): se achica la mascara
// hasta cortar las uniones finas, se elige la pieza mas grande y se la vuelve
// a crecer, sin pasarse de la mascara original. Asi la figura se pinta con
// una sola naranja y no con todas mezcladas.
function aislarPieza(segmento) {
  const { mascara, ancho, alto } = segmento
  const radio = Math.max(2, Math.round(Math.min(ancho, alto) * UNION))
  const fondo = mascara.map((m) => 1 - m)
  const todo = new Uint8Array(mascara.length).fill(1)
  const alFondo = pasosDesde(fondo, todo, ancho, radio)
  const nucleo = alFondo.map((p) => (p > radio ? 1 : 0))

  // Piezas del nucleo: se rotula cada una y se mide su tamano.
  const pieza = new Int32Array(mascara.length).fill(-1)
  let mayor = -1
  let tamanoMayor = 0
  for (let inicio = 0, rotulo = 0; inicio < nucleo.length; inicio++) {
    if (!nucleo[inicio] || pieza[inicio] >= 0) continue
    const pila = [inicio]
    pieza[inicio] = rotulo
    let tamano = 0
    while (pila.length) {
      const i = pila.pop()
      tamano++
      const x = i % ancho
      for (const v of [x > 0 ? i - 1 : -1, x < ancho - 1 ? i + 1 : -1, i - ancho, i + ancho]) {
        if (v >= 0 && v < nucleo.length && nucleo[v] && pieza[v] < 0) {
          pieza[v] = rotulo
          pila.push(v)
        }
      }
    }
    if (tamano > tamanoMayor) [mayor, tamanoMayor] = [rotulo, tamano]
    rotulo++
  }
  if (mayor < 0) return segmento

  const elegida = pieza.map((p) => (p === mayor ? 1 : 0))
  const hastaElegida = pasosDesde(elegida, mascara, ancho, radio)
  const nueva = hastaElegida.map((p) => (p <= radio ? 1 : 0))
  return { ...segmento, mascara: Uint8Array.from(nueva) }
}

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
// Correccion - Poll: una foto de superficie (la piedra) se proyectaba estirada y con vetas
// Correccion - Poll: con varias cosas en la foto (naranjas y gajos) se pintaba la figura con todas mezcladas
export function crearForma(receta, apariencia, random) {
  // Si la foto es una superficie, de ella solo se toman sus colores (los de
  // toda la foto), repartidos sobre la forma, sin proyectarla ni usar su silueta.
  const { segmento } = apariencia
  const superficie = segmento && FIGURAS[receta.tipo] && fraccionDelObjeto(segmento) < SUPERFICIE
  if (superficie) apariencia = { ...apariencia, segmento: null, regiones: null }
  // Un modelo 3D o una figura conocida se pintan con una sola pieza de la foto.
  else if (segmento && (receta.modelo || FIGURAS[receta.tipo])) {
    apariencia = { ...apariencia, segmento: aislarPieza(segmento) }
  }
  const paleta = receta.colorElegido
    ? apariencia.paleta
    : superficie
      ? paletaDeSuperficie(segmento)
      : apariencia.regiones
        ? [...apariencia.regiones.paleta.values()]
        : apariencia.paleta
  // Colores de la foto por pixel, para la proyeccion alineada.
  const porPixel = apariencia.segmento && !receta.colorElegido ? colorearPorPixel(apariencia.segmento) : null
  // Pinta el modelo. Con foto, ademas de los colores por vertice devuelve los
  // datos para pintarlo pixel por pixel en pantalla con la foto en alta resolucion.
  const pintar = (geometria, altura) => {
    if (!porPixel) {
      pintarConPaleta(geometria, paleta, altura, random)
      return null
    }
    const proyeccion = colorearAlineado(geometria, apariencia.segmento, porPixel)
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
