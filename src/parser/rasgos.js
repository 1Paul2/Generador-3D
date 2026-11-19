import { normalizar } from './interpretar.js'

// Lee un texto (lo que escribio el usuario y lo que dice Wikipedia) y saca
// rasgos que cambian como se genera: si tiene nieve, si esta activo, si es
// una isla, si es desertico, si tiene bosque, si es una conifera y su altitud.
export function leerRasgos(texto) {
  const limpio = normalizar(texto ?? '')
  const menciona = (...raices) => raices.some((raiz) => new RegExp(`\\b${raiz}`).test(limpio))

  return {
    nieve: menciona('nevad', 'nieve', 'glaciar', 'hielo', 'helad'),
    activo: menciona('activo', 'erupcion', 'erupciones', 'lava', 'magma', 'fumarola'),
    isla: menciona('isla', 'archipielago', 'atolon'),
    desierto: menciona('desiert', 'arid', 'arena', 'duna'),
    bosque: menciona('bosque', 'selva', 'tropical', 'vegetacion', 'pinar', 'nuboso'),
    conifera: menciona('conifer', 'pino', 'pinus', 'abeto', 'cipres', 'secuoya', 'cedro'),
    altitud: leerAltitud(limpio),
  }
}

// Palabras que indican el volumen de una cosa:
//   plano: casi sin grosor (una hoja, una senal, una bandera).
//   giratorio: igual desde todos los lados, como hecho en un torno (una
//     botella, un jarron, una lampara).
const VOLUMENES = {
  plano: [
    'hoja', 'papel', 'lamina', 'laminar', 'plan[oa]', 'aplanad', 'delgad', 'placa', 'tabla',
    'cuadro', 'pintura', 'bandera', 'senal', 'cartel', 'letrero', 'tarjeta', 'carta', 'moneda',
    'ala', 'petalo', 'escudo', 'galleta', 'mapa', 'billete', 'sello', 'pluma', 'lienzo',
  ],
  giratorio: [
    'botella', 'jarron', 'florero', 'vaso', 'copa', 'taza', 'lampara', 'maceta', 'vela',
    'campana', 'frasco', 'barril', 'trompo', 'columna', 'faro', 'anfora', 'tinaja', 'olla',
    'cuenco', 'bol', 'peon', 'reloj de arena',
  ],
}

// Decide el volumen mirando los textos en orden (lo que escribio el usuario,
// el titulo y la descripcion corta del articulo): gana la primera palabra
// encontrada. Devuelve 'plano', 'giratorio' o null si no hay pistas.
export function leerVolumen(...textos) {
  for (const texto of textos) {
    const limpio = normalizar(texto ?? '')
    let mejor = null
    for (const [volumen, raices] of Object.entries(VOLUMENES)) {
      for (const raiz of raices) {
        const posicion = limpio.search(new RegExp(`\\b${raiz}(e?s)?\\b`))
        if (posicion !== -1 && (!mejor || posicion < mejor.posicion)) mejor = { volumen, posicion }
      }
    }
    if (mejor) return mejor.volumen
  }
  return null
}

// Elementos de un entorno que se pueden sumar a cualquier relieve.
const ELEMENTOS = {
  rio: ['rio', 'arroyo', 'riachuelo', 'corriente de agua', 'curso de agua'],
  cascada: ['cascada', 'catarata', 'salto de agua', 'caida de agua'],
  lago: ['lago', 'laguna', 'estanque'],
  canon: ['canon', 'garganta', 'barranco', 'desfiladero'],
  acantilado: ['acantilado', 'risco', 'precipicio'],
  mar: ['mar', 'costa', 'playa', 'litoral', 'oceano', 'bahia'],
  bosque: ['bosque', 'selva', 'arboleda', 'jungla'],
}

// Lee que elementos nombran los textos ("montana con lago y bosque"). Como el
// volumen, se lee solo de lo que nombra a la cosa (texto, titulo, descripcion).
export function leerElementos(...textos) {
  const limpio = normalizar(textos.join(' '))
  return Object.entries(ELEMENTOS)
    .filter(([, raices]) => raices.some((raiz) => new RegExp(`\\b${raiz}(e?s)?\\b`).test(limpio)))
    .map(([elemento]) => elemento)
}

// Estaciones y estados de la vegetacion.
const ESTACIONES = {
  otono: ['otono', 'otonal', 'hojas secas', 'ocre'],
  invierno: ['invierno', 'invernal', 'nevad', 'escarcha'],
  primavera: ['primavera', 'primaveral', 'en flor', 'florecid', 'florido', 'cerezo', 'almendro', 'sakura'],
  seco: ['seco', 'muerto', 'sin hojas', 'pelado', 'deshojado'],
}

// Lee la estacion que nombran los textos ("arbol de otono"). Se mira solo lo
// que nombra a la cosa, igual que el volumen. Devuelve null si no dice ninguna.
export function leerEstacion(...textos) {
  for (const texto of textos) {
    const limpio = normalizar(texto ?? '')
    for (const [estacion, raices] of Object.entries(ESTACIONES)) {
      if (raices.some((raiz) => new RegExp(`\\b${raiz}`).test(limpio))) return estacion
    }
  }
  return null
}

// Cosas que tienen luz propia o brillan, y como lo hacen.
//   estrella: emite luz y lanza llamaradas hacia afuera (el Sol).
//   fuego: luz calida que parpadea y chispas que suben.
//   lampara: un halo de luz quieto.
//   brillante: superficie pulida (metal, cristal) con destellos que titilan.
const LUCES = {
  estrella: ['estrella', 'sol', 'astro', 'supernova', 'enana amarilla', 'enana roja'],
  fuego: ['fuego', 'llama', 'hoguera', 'fogata', 'antorcha', 'incendio', 'vela', 'brasa'],
  lampara: ['lampara', 'bombilla', 'foco', 'farol', 'neon', 'linterna', 'luciernaga', 'faro'],
  brillante: [
    'oro', 'dorad', 'plata', 'platead', 'metal', 'metalic', 'cromo', 'acero', 'cristal', 'vidrio',
    'diamante', 'gema', 'joya', 'espejo', 'hielo', 'trofeo', 'moneda', 'anillo', 'corona',
  ],
}

// Lee que tipo de luz tiene la cosa ("sol" -> estrella, "anillo de oro" ->
// brillante). Se mira solo lo que nombra a la cosa, como el volumen; gana la
// primera palabra encontrada. Devuelve null si no brilla.
export function leerLuz(...textos) {
  for (const texto of textos) {
    const limpio = normalizar(texto ?? '')
    let mejor = null
    for (const [luz, raices] of Object.entries(LUCES)) {
      for (const raiz of raices) {
        const posicion = limpio.search(new RegExp(`\\b${raiz}(e?s)?\\b`))
        if (posicion !== -1 && (!mejor || posicion < mejor.posicion)) mejor = { luz, posicion }
      }
    }
    if (mejor) return mejor.luz
  }
  return null
}

// Busca una altura en metros: "3432 m", "5.895 metros", "2 437 msnm".
function leerAltitud(texto) {
  const encontrado = texto.match(/\b(\d{1,2}[.\s]?\d{3})\s*(m\b|metros|msnm|m s n m)/)
  return encontrado ? Number(encontrado[1].replace(/[.\s]/g, '')) : null
}
