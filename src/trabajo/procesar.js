import * as THREE from 'three'
import { segmentar } from '../analisis/segmentar.js'
import { identificarRegiones } from '../analisis/regiones.js'
import { crearForma } from '../generadores/formas.js'
import { paletaDesdeColor } from '../generadores/paleta.js'
import { crearRandom } from '../utils/random.js'

// El trabajo pesado de generar un modelo: separar el objeto de su foto,
// identificar sus partes y construir la malla. Se corre en un proceso aparte
// (generador.worker.js) para que la pagina no se congele mientras tanto.
//
// datos: { receta, imagen, modelo, semilla }
//   receta: lo que se interpreto del texto (sin el modelo 3D).
//   imagen: { ancho, alto, pixeles } de la foto real, o null.
//   modelo: posiciones (Float32Array) de un modelo 3D real descargado, o null.
// Devuelve { sinForma: true } si no hay con que construir, o la malla como
// arreglos listos para enviar: { atributos, indices, altura, metodo, foto }.
// foto trae la textura del objeto en alta resolucion y los datos de la
// proyeccion, o null si el modelo se pinta solo con sus vertices.
export function procesar({ receta, imagen, modelo, semilla }) {
  const segmento = imagen ? segmentar(imagen) : null
  if (!receta.tipo && !modelo && !segmento) return { sinForma: true }

  if (modelo) {
    receta.modelo = new THREE.BufferGeometry()
    receta.modelo.setAttribute('position', new THREE.BufferAttribute(modelo, 3))
  }
  const apariencia = {
    imagen,
    segmento,
    regiones: segmento && identificarRegiones(segmento),
    paleta: paletaDesdeColor(receta.color),
  }
  const { geometria, altura, metodo, foto } = crearForma(receta, apariencia, crearRandom(semilla))

  // Solo lo que hace falta para dibujar: posicion, luz y color de cada vertice,
  // el largo del pelo (animales) y si hay, los datos para pintarlo pixel por
  // pixel con la foto.
  const atributos = {}
  for (const nombre of ['position', 'normal', 'color', 'pelo']) {
    const atributo = geometria.attributes[nombre]
    if (atributo) atributos[nombre] = Float32Array.from(atributo.array)
  }
  const indices = geometria.index ? Uint32Array.from(geometria.index.array) : null
  return { atributos, indices, altura, metodo, foto: foto ?? null }
}

// Vuelve a armar la geometria a partir de los arreglos que devuelve procesar().
export function armarGeometria({ atributos, indices }) {
  const geometria = new THREE.BufferGeometry()
  for (const [nombre, valores] of Object.entries(atributos)) {
    geometria.setAttribute(nombre, new THREE.BufferAttribute(valores, nombre === 'pelo' ? 1 : 3))
  }
  if (indices) geometria.setIndex(new THREE.BufferAttribute(indices, 1))
  geometria.computeBoundingBox()
  return geometria
}
