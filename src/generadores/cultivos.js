import * as THREE from 'three'
import { crearRuido } from '../utils/ruido.js'
import { crearMalla } from './botanica.js'
import { aplicarOclusion, calcularOclusion } from './oclusion.js'
import { arroz, banano, cana, maiz, palma, pina, yuca } from './plantas.js'
import { cacao, cafe, chile, frijol, papa, tomate } from './huerta.js'
import { COSECHAS } from './cosechas.js'

// Cultivos: la planta entera (la mata de banano, el cafeto, la milpa) o lo que
// se cosecha de ella (un banano, una mazorca, un monton de frijoles), armados
// con su anatomia real en metros. Ver botanica.js.

export const CULTIVOS = ['cultivo']

// Medida mas grande del modelo armado, como la de los seres vivos.
const MEDIDA = 12

// Palabra escrita (sin tildes, en singular) -> cultivo.
export const PALABRAS_DE_CULTIVO = {
  yuca: 'yuca',
  mandioca: 'yuca',
  banano: 'banano',
  banana: 'banano',
  guineo: 'banano',
  cambur: 'banano',
  platano: 'banano',
  bananal: 'banano',
  platanal: 'banano',
  pina: 'pina',
  anana: 'pina',
  pinal: 'pina',
  cafe: 'cafe',
  cafeto: 'cafe',
  cafetal: 'cafe',
  cana: 'cana',
  canal: 'cana',
  canaveral: 'cana',
  maiz: 'maiz',
  mazorca: 'maiz',
  elote: 'maiz',
  choclo: 'maiz',
  milpa: 'maiz',
  maizal: 'maiz',
  frijol: 'frijol',
  frijolar: 'frijol',
  poroto: 'frijol',
  tomate: 'tomate',
  tomatera: 'tomate',
  arroz: 'arroz',
  arrozal: 'arroz',
  papa: 'papa',
  patata: 'papa',
  chile: 'chile',
  pimiento: 'chile',
  pimenton: 'chile',
  cacao: 'cacao',
  cacaotal: 'cacao',
  palma: 'palma',
  palmera: 'palma',
  palmar: 'palma',
}

// Palabras que ya nombran la planta (o el sembrado) y no la cosecha: "cafetal",
// "milpa". "palma" tambien: la palma es el arbol; su fruto es el "racimo de palma".
const NOMBRAN_LA_PLANTA = new Set([
  'bananal', 'platanal', 'pinal', 'cafeto', 'cafetal', 'canal', 'canaveral', 'milpa', 'maizal',
  'frijolar', 'tomatera', 'arrozal', 'cacaotal', 'palma', 'palmera', 'palmar',
])

// Y las que nombran la cosecha aunque se diga "planta": "mazorca", "elote".
const NOMBRAN_LA_COSECHA = new Set(['mazorca', 'elote', 'choclo'])

const PLANTAS = { yuca, banano, pina, cafe, cana, maiz, frijol, tomate, arroz, papa, chile, cacao, palma }

// Decide si se arma la planta o la cosecha, como lo entenderia un agricultor:
// "mata de banano" o "bananal" es la planta; "banano" solo es la fruta;
// "racimo de banano" es la mano de bananos; "palma" es el arbol y "racimo de
// palma" su fruto.
export function esPlanta(receta) {
  if (NOMBRAN_LA_COSECHA.has(receta.palabra)) return false
  if (receta.racimo || receta.fruto) return false
  return Boolean(receta.planta) || NOMBRAN_LA_PLANTA.has(receta.palabra)
}

// Correccion - Poll: "banano" generaba la mata entera; ahora la mata se pide como "mata de banano" y "banano" es la fruta
export function crearCultivo(receta, random) {
  const cultivo = PALABRAS_DE_CULTIVO[receta.palabra] ?? 'yuca'
  const ruido = crearRuido(random)
  const malla = crearMalla()
  if (esPlanta(receta)) {
    PLANTAS[cultivo](malla, random, ruido)
  } else {
    const color = receta.colorElegido ? [1, 3, 5].map((i) => parseInt(receta.color.slice(i, i + 2), 16)) : null
    COSECHAS[cultivo](malla, random, ruido, { palabra: receta.palabra, racimo: receta.racimo, color })
  }
  const geometria = malla.armar()

  // Se escala a una medida comun y se apoya en el piso.
  geometria.computeBoundingBox()
  const caja = geometria.boundingBox
  const medidas = caja.getSize(new THREE.Vector3())
  const centro = caja.getCenter(new THREE.Vector3())
  geometria.translate(-centro.x, -caja.min.y, -centro.z)
  geometria.scale(...Array(3).fill((MEDIDA * receta.tamano) / Math.max(medidas.x, medidas.y, medidas.z)))
  geometria.computeVertexNormals()
  aplicarOclusion(geometria, calcularOclusion(geometria))
  geometria.computeBoundingBox()
  return { geometria, altura: geometria.boundingBox.max.y }
}
