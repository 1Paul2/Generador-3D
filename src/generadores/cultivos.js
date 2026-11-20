import * as THREE from 'three'
import { crearRuido } from '../utils/ruido.js'
import { crearMalla } from './botanica.js'
import { aplicarOclusion, calcularOclusion } from './oclusion.js'
import { arroz, banano, cana, maiz, palma, pina, yuca } from './plantas.js'
import { cacao, cafe, chile, frijol, papa, tomate } from './huerta.js'
import { ARBOLES, arbol, frutoGenerico, racimoDeMamonChino } from './arboles.js'
import { cebolla, COSECHAS_DE_HORTALIZAS, lechuga, repollo, zanahoria } from './hortalizas.js'
import { pasto } from './pastos.js'
import { canaIndia, helechoArborescente, helechoCuero } from './ornamentales.js'
import { vector } from './botanica.js'
import { chayote, melon, palmera, papaya } from './frutales.js'
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
  // Frutales.
  naranja: 'naranja',
  naranjo: 'naranja',
  naranjal: 'naranja',
  limon: 'naranja',
  limonero: 'naranja',
  mango: 'mango',
  aguacate: 'aguacate',
  aguacatal: 'aguacate',
  papaya: 'papaya',
  papayo: 'papaya',
  chayote: 'chayote',
  chayotera: 'chayote',
  melon: 'melon',
  sandia: 'sandia',
  coco: 'coco',
  cocotero: 'coco',
  cocal: 'coco',
  pejibaye: 'pejibaye',
  pejibayal: 'pejibaye',
  // Arboles del bosque y de plantacion forestal.
  guanacaste: 'guanacaste',
  ceiba: 'ceiba',
  cortez: 'cortez',
  cortes: 'cortez',
  roble: 'roble',
  teca: 'teca',
  melina: 'melina',
  poro: 'poro',
  cedro: 'cedro',
  guarumo: 'guarumo',
  indio: 'indio',
  guaba: 'guaba',
  laurel: 'laurel',
  maderonegro: 'madero',
  pochote: 'pochote',
  cenizaro: 'cenizaro',
  higueron: 'higueron',
  malinche: 'malinche',
  roblenegro: 'roblenegro',
  encino: 'roblenegro',
  mamonchino: 'mamonchino',
  rambutan: 'mamonchino',
  mangle: 'manglerojo',
  manglerojo: 'manglerojo',
  cipres: 'cipres',
  // Hortalizas.
  lechuga: 'lechuga',
  repollo: 'repollo',
  zanahoria: 'zanahoria',
  cebolla: 'cebolla',
  // Pastos.
  brachiaria: 'brachiaria',
  braquiaria: 'brachiaria',
  estrellaafricana: 'estrella',
  kikuyo: 'kikuyo',
  // Ornamentales y helechos.
  canaindia: 'canaindia',
  dracaena: 'canaindia',
  helecho: 'helechocuero',
  helechocuero: 'helechocuero',
  rabodemico: 'rabodemico',
  // Tanda B: arboles, frutales y palmas.
  cortezn: 'cortezn',
  almendro: 'almendro',
  espavel: 'espavel',
  guapinol: 'guapinol',
  carao: 'carao',
  javillo: 'javillo',
  balsa: 'balsa',
  cocobolo: 'cocobolo',
  jacaranda: 'jacaranda',
  almendroplaya: 'almendroplaya',
  jaul: 'jaul',
  caoba: 'caoba',
  acacia: 'acacia',
  amarillon: 'amarillon',
  terminalia: 'terminalia',
  pino: 'pino',
  eucalipto: 'eucalipto',
  chilamate: 'chilamate',
  robleblanco: 'robleblanco',
  aguacatillo: 'aguacatillo',
  cedrodulce: 'cedrodulce',
  lloro: 'lloro',
  ira: 'ira',
  manglecaballero: 'manglecaballero',
  manglesalado: 'manglesalado',
  mangleblanco: 'mangleblanco',
  manglebotoncillo: 'manglebotoncillo',
  manglepinuela: 'manglepinuela',
  mandarina: 'mandarina',
  guanabana: 'guanabana',
  cas: 'cas',
  guayaba: 'guayaba',
  carambola: 'carambola',
  maranon: 'maranon',
  macadamia: 'macadamia',
  achiote: 'achiote',
  nance: 'nance',
  jocote: 'jocote',
  zapote: 'zapote',
  mamon: 'mamon',
  anona: 'anona',
  manzanaagua: 'manzanaagua',
  palmareal: 'palmareal',
  coyol: 'coyol',
  chonta: 'chonta',
  yolillo: 'yolillo',
  suita: 'suita',
  palmito: 'palmito',
  cortesnegro: 'cortezn',
  botoncillo: 'manglebotoncillo',
  guanabano: 'guanabana',
  guayabo: 'guayaba',
  palmitera: 'palmito',
}

// Arboles: siempre se arma el arbol (no tienen una cosecha que se pida sola).
const ARBOLES_DEL_BOSQUE = [
  'guanacaste', 'ceiba', 'cortez', 'cortes', 'roble', 'teca', 'melina', 'poro', 'cedro', 'guarumo', 'indio', 'guaba',
  'laurel', 'maderonegro', 'pochote', 'cenizaro', 'higueron', 'malinche', 'roblenegro', 'encino', 'mangle', 'manglerojo', 'cipres',
  'cortezn', 'almendro', 'espavel', 'guapinol', 'carao', 'javillo', 'balsa', 'cocobolo', 'jacaranda', 'almendroplaya', 'jaul', 'caoba', 'acacia', 'amarillon', 'terminalia', 'pino', 'eucalipto', 'chilamate', 'robleblanco', 'aguacatillo', 'cedrodulce', 'lloro', 'ira', 'manglecaballero', 'manglesalado', 'mangleblanco', 'manglebotoncillo', 'manglepinuela', 'palmareal', 'coyol', 'chonta', 'yolillo', 'suita', 'palmito', 'cortesnegro', 'botoncillo', 'palmitera',
]

// Pastos, ornamentales y helechos: tambien se arma siempre la planta.
const SIEMPRE_PLANTA = ['brachiaria', 'braquiaria', 'estrellaafricana', 'kikuyo', 'canaindia', 'dracaena', 'helecho', 'helechocuero', 'rabodemico']

// Palabras que ya nombran la planta (o el sembrado) y no la cosecha: "cafetal",
// "milpa". "palma" tambien: la palma es el arbol; su fruto es el "racimo de palma".
const NOMBRAN_LA_PLANTA = new Set([
  'bananal', 'platanal', 'pinal', 'cafeto', 'cafetal', 'canal', 'canaveral', 'milpa', 'maizal',
  'frijolar', 'tomatera', 'arrozal', 'cacaotal', 'palma', 'palmera', 'palmar', 'naranjo', 'naranjal',
  'limonero', 'aguacatal', 'papayo', 'chayotera', 'cocotero', 'cocal', 'pejibayal', ...ARBOLES_DEL_BOSQUE, ...SIEMPRE_PLANTA,
])

// Y las que nombran la cosecha aunque se diga "planta": "mazorca", "elote".
const NOMBRAN_LA_COSECHA = new Set(['mazorca', 'elote', 'choclo'])

const PLANTAS = {
  yuca, banano, pina, cafe, cana, maiz, frijol, tomate, arroz, papa, chile, cacao, palma, papaya, chayote,
  melon: (malla, random, ruido) => melon(malla, random, ruido, false),
  sandia: (malla, random, ruido) => melon(malla, random, ruido, true),
  lechuga, repollo, zanahoria, cebolla,
  brachiaria: (malla, random, ruido) => pasto(malla, random, ruido, 'brachiaria'),
  estrella: (malla, random, ruido) => pasto(malla, random, ruido, 'estrella'),
  kikuyo: (malla, random, ruido) => pasto(malla, random, ruido, 'kikuyo'),
  canaindia: canaIndia,
  helechocuero: helechoCuero,
  rabodemico: helechoArborescente,
  ...Object.fromEntries(['coco', 'pejibaye', 'palmareal', 'coyol', 'chonta', 'yolillo', 'suita', 'palmito'].map((p) => [p, (malla, random, ruido) => palmera(malla, random, ruido, p)])),
  ...Object.fromEntries(
    [
      'naranja', 'mango', 'aguacate', 'guanacaste', 'ceiba', 'cortez', 'roble', 'teca', 'melina', 'poro', 'cedro', 'guarumo', 'indio',
      'guaba', 'laurel', 'madero', 'pochote', 'cenizaro', 'higueron', 'malinche', 'roblenegro', 'mamonchino', 'manglerojo', 'cipres',
      ...['cortezn', 'almendro', 'espavel', 'guapinol', 'carao', 'javillo', 'balsa', 'cocobolo', 'jacaranda', 'almendroplaya', 'jaul', 'caoba', 'acacia', 'amarillon', 'terminalia', 'pino', 'eucalipto', 'chilamate', 'robleblanco', 'aguacatillo', 'cedrodulce', 'lloro', 'ira', 'manglecaballero', 'manglesalado', 'mangleblanco', 'manglebotoncillo', 'manglepinuela', 'mandarina', 'guanabana', 'cas', 'guayaba', 'carambola', 'maranon', 'macadamia', 'achiote', 'nance', 'jocote', 'zapote', 'mamon', 'anona', 'manzanaagua'],
    ].map(
      (especie) => [especie, (malla, random, ruido) => arbol(malla, random, ruido, especie)],
    ),
  ),
}

// Cosechas de las hortalizas y frutas nuevas.
const COSECHAS_EXTRA = {
  ...COSECHAS_DE_HORTALIZAS,
  mamonchino: (malla, random, ruido) => racimoDeMamonChino(malla, vector(0, 0.2, 0), random, ruido),
  // Frutas de la tanda B: tres frutas (o racimos) apoyadas en el suelo.
  ...Object.fromEntries(
    ['mandarina', 'guanabana', 'cas', 'guayaba', 'carambola', 'maranon', 'macadamia', 'achiote', 'nance', 'jocote', 'zapote', 'mamon', 'anona', 'manzanaagua'].map((nombre) => [
      nombre,
      (malla, random, ruido) => {
        const fruto = ARBOLES[nombre].frutoForma
        const separacion = fruto.radio * (fruto.racimo ? 6 : 2.6)
        for (let n = 0; n < 3; n++) {
          const alto = fruto.radio * (fruto.largo ?? 1.4) * 2 + Math.abs(fruto.colgante ?? 0.04)
          frutoGenerico(malla, vector((n - 1) * separacion, alto, (n % 2) * separacion * 0.5), { ...fruto, colgante: Math.abs(fruto.colgante ?? 0.04) }, random, ruido)
        }
      },
    ]),
  ),
}

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
    const cosecha = COSECHAS[cultivo] ?? COSECHAS_EXTRA[cultivo]
    cosecha(malla, random, ruido, { palabra: receta.palabra, racimo: receta.racimo, color })
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
