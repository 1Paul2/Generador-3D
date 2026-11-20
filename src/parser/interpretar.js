// Traduce el texto del buscador a una "receta": que forma construir y con que parametros.
// Las palabras se escriben con tildes porque tambien se usan como sugerencias de escritura.

// Palabra -> figura (las figuras estan definidas en generadores/formas.js).
const FORMAS = {
  esfera: 'esfera',
  bola: 'esfera',
  pelota: 'esfera',
  planeta: 'esfera',
  cubo: 'cubo',
  caja: 'cubo',
  bloque: 'cubo',
  dado: 'dado',
  pirámide: 'piramide',
  cilindro: 'cilindro',
  tubo: 'cilindro',
  lata: 'cilindro',
  cono: 'cono',
  diamante: 'diamante',
  gema: 'diamante',
  cristal: 'diamante',
  cápsula: 'capsula',
  pastilla: 'capsula',
  píldora: 'capsula',
  cojín: 'cojin',
  almohada: 'cojin',
  disco: 'disco',
  moneda: 'disco',
  rueda: 'disco',
  plato: 'disco',
  huevo: 'huevo',
  piedra: 'roca',
  roca: 'roca',
  peñasco: 'roca',
  guijarro: 'roca',
  torre: 'torre',
  edificio: 'edificio',
  montaña: 'montana',
  volcán: 'volcan',
  árbol: 'arbol',
  pino: 'arbol',
  abeto: 'arbol',
  ciprés: 'arbol',
  cerezo: 'arbol',
  almendro: 'arbol',
  manzano: 'arbol',
  roble: 'arbol',
  sauce: 'arbol',
  olivo: 'arbol',
  arce: 'arbol',
  colina: 'colina',
  cerro: 'colina',
  isla: 'isla',
  duna: 'duna',
  desierto: 'duna',
  llano: 'llano',
  pradera: 'llano',
  meseta: 'meseta',
  cascada: 'cascada',
  catarata: 'cascada',
  río: 'rio',
  arroyo: 'rio',
  lago: 'lago',
  laguna: 'lago',
  cañón: 'canon',
  barranco: 'canon',
  acantilado: 'acantilado',
  playa: 'costa',
  agua: 'costa',
  mar: 'costa',
  océano: 'costa',
  costa: 'costa',
  // Seres vivos: el tipo es el plan corporal; la palabra dice la especie.
  perro: 'cuadrupedo',
  perra: 'cuadrupedo',
  cachorro: 'cuadrupedo',
  gato: 'cuadrupedo',
  gata: 'cuadrupedo',
  caballo: 'cuadrupedo',
  yegua: 'cuadrupedo',
  vaca: 'cuadrupedo',
  toro: 'cuadrupedo',
  buey: 'cuadrupedo',
  novillo: 'cuadrupedo',
  ternero: 'cuadrupedo',
  ternera: 'cuadrupedo',
  vaquilla: 'cuadrupedo',
  cebú: 'cuadrupedo',
  brahman: 'cuadrupedo',
  potro: 'cuadrupedo',
  potranca: 'cuadrupedo',
  oveja: 'cuadrupedo',
  cordero: 'cuadrupedo',
  cerdo: 'cuadrupedo',
  chancho: 'cuadrupedo',
  león: 'cuadrupedo',
  leona: 'cuadrupedo',
  tigre: 'cuadrupedo',
  leopardo: 'cuadrupedo',
  jaguar: 'cuadrupedo',
  guepardo: 'cuadrupedo',
  pantera: 'cuadrupedo',
  cebra: 'cuadrupedo',
  lobo: 'cuadrupedo',
  zorro: 'cuadrupedo',
  oso: 'cuadrupedo',
  conejo: 'cuadrupedo',
  ratón: 'cuadrupedo',
  elefante: 'cuadrupedo',
  jirafa: 'cuadrupedo',
  ave: 'ave',
  pájaro: 'ave',
  paloma: 'ave',
  gallina: 'ave',
  pato: 'ave',
  águila: 'ave',
  loro: 'ave',
  pingüino: 'ave',
  pez: 'pez',
  pescado: 'pez',
  tiburón: 'pez',
  persona: 'persona',
  hombre: 'persona',
  mujer: 'persona',
  niño: 'persona',
  niña: 'persona',
  humano: 'persona',
}

// Palabras que nombran una forma abstracta y no una cosa real: para estas no
// se busca foto en Wikipedia.
const GEOMETRICAS = new Set(['esfera', 'cubo', 'bloque', 'piramide', 'cilindro', 'tubo', 'cono', 'disco', 'capsula'])

// Nombre para mostrar de cada figura.
export const NOMBRES_FIGURAS = {
  esfera: 'esfera',
  cubo: 'cubo',
  dado: 'dado',
  piramide: 'pirámide',
  cilindro: 'cilindro',
  cono: 'cono',
  diamante: 'diamante',
  capsula: 'cápsula',
  cojin: 'cojín',
  disco: 'disco',
  huevo: 'huevo',
  roca: 'roca',
  torre: 'torre',
  edificio: 'edificio',
  montana: 'montaña',
  volcan: 'volcán',
  arbol: 'árbol',
  colina: 'colina',
  isla: 'isla',
  duna: 'dunas',
  llano: 'llano',
  meseta: 'meseta',
  cascada: 'cascada',
  rio: 'río',
  lago: 'lago',
  canon: 'cañón',
  acantilado: 'acantilado',
  costa: 'costa',
  cuadrupedo: 'cuadrúpedo',
  ave: 'ave',
  pez: 'pez',
  persona: 'persona',
}

const COLORES = {
  rojo: '#e5484d',
  roja: '#e5484d',
  azul: '#3e63dd',
  verde: '#30a46c',
  amarillo: '#f5d90a',
  amarilla: '#f5d90a',
  naranja: '#f76b15',
  morado: '#8e4ec6',
  morada: '#8e4ec6',
  rosado: '#e93d82',
  rosada: '#e93d82',
  rosa: '#e93d82',
  blanco: '#eeeeee',
  blanca: '#eeeeee',
  negro: '#3a3a3a',
  negra: '#3a3a3a',
  oro: '#d4a73c',
  dorado: '#d4a73c',
  dorada: '#d4a73c',
  plata: '#c4c8cf',
  plateado: '#c4c8cf',
  plateada: '#c4c8cf',
  bronce: '#b0763a',
  cobre: '#b8673c',
}

const TAMANOS = {
  diminuto: 0.5,
  diminuta: 0.5,
  pequeño: 0.7,
  pequeña: 0.7,
  chico: 0.7,
  chica: 0.7,
  grande: 1.3,
  gigante: 1.6,
}

// Palabras de relleno que no describen nada y no vale la pena buscar.
const RELLENO = new Set(['un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'de', 'del', 'con', 'y', 'en'])

export const FORMAS_DISPONIBLES = Object.values(NOMBRES_FIGURAS)

// Todas las palabras que el diccionario entiende, para sugerirlas al escribir.
export const VOCABULARIO = [...Object.keys(FORMAS), ...Object.keys(COLORES), ...Object.keys(TAMANOS)]

// Quita tildes y mayusculas: "Pirámide Pequeña" -> "piramide pequena".
export function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Copia del diccionario con las claves sin tildes, para comparar con lo escrito.
function sinTildes(diccionario) {
  return Object.fromEntries(Object.entries(diccionario).map(([clave, valor]) => [normalizar(clave), valor]))
}

const FORMAS_NORMALIZADAS = sinTildes(FORMAS)
const COLORES_NORMALIZADOS = sinTildes(COLORES)

// Colores que tambien son el nombre de una cosa.
const COLORES_QUE_SON_COSAS = new Set(['naranja', 'rosa', 'oro', 'plata', 'bronce', 'cobre'])
const TAMANOS_NORMALIZADOS = sinTildes(TAMANOS)

// Busca la palabra tal cual y sin plural ("cubos" -> "cubo", "naranjas" -> "naranja").
function buscar(diccionario, palabra) {
  return diccionario[clave(diccionario, palabra)]
}

// La forma de la palabra que esta en el diccionario: "perros" -> "perro".
function clave(diccionario, palabra) {
  return [palabra, palabra.replace(/s$/, ''), palabra.replace(/es$/, '')].find((p) => p in diccionario)
}

// Devuelve { tipo, palabra, color, colorElegido, tamano, desconocidas, cosas }:
//   palabra: la palabra del diccionario que nombro la forma ("perro"), que
//     sirve para elegir la especie de un ser vivo.
//   colorElegido: si el texto nombra un color (si no, se usa la foto de Wikipedia).
//   desconocidas: palabras que no estan en el diccionario. Si ninguna palabra
//     nombra una figura, tipo es null y estas se averiguan en Wikipedia.
//   cosas: palabras que nombran algo real (no una forma abstracta como "cubo"),
//     para buscar su foto: "torre eiffel", "volcán", "lata".
// Correccion - Poll: "naranja" solo se tomaba como color y no se construia nada
export function interpretar(texto) {
  const palabras = texto.toLowerCase().split(/\s+/).filter(Boolean)
  const receta = {
    tipo: null,
    color: '#c084fc',
    colorElegido: false,
    tamano: 1,
    desconocidas: [],
    cosas: [],
  }

  for (const original of palabras) {
    const palabra = normalizar(original)
    const forma = buscar(FORMAS_NORMALIZADAS, palabra)
    const color = buscar(COLORES_NORMALIZADOS, palabra)
    const tamano = buscar(TAMANOS_NORMALIZADOS, palabra)

    if (forma && !receta.tipo) {
      receta.tipo = forma
      // Que palabra nombro la forma (sin tildes y en singular), para saber la especie.
      receta.palabra = clave(FORMAS_NORMALIZADAS, palabra)
    }
    receta.color = color ?? receta.color
    receta.colorElegido ||= Boolean(color)
    receta.tamano = tamano ?? receta.tamano
    // Se guarda con sus tildes, tal como se escribio, para buscarla en Wikipedia.
    const desconocida = !forma && !color && !tamano && !RELLENO.has(palabra)
    if (desconocida) receta.desconocidas.push(original)
    const geometrica = GEOMETRICAS.has(palabra) || GEOMETRICAS.has(palabra.replace(/s$/, ''))
    if (desconocida || (forma && !geometrica)) receta.cosas.push(original)
  }

  // "naranja" o "rosa" solos nombran la fruta o la flor, no un color: si
  // ninguna otra palabra dice que construir, se buscan como cosas.
  if (!receta.tipo && !receta.cosas.length) {
    const nombres = palabras.filter((p) => COLORES_QUE_SON_COSAS.has(normalizar(p)))
    if (nombres.length) {
      receta.cosas.push(...nombres)
      receta.desconocidas.push(...nombres)
      receta.colorElegido = false
    }
  }

  return receta
}
