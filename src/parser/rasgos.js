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

// Busca una altura en metros: "3432 m", "5.895 metros", "2 437 msnm".
function leerAltitud(texto) {
  const encontrado = texto.match(/\b(\d{1,2}[.\s]?\d{3})\s*(m\b|metros|msnm|m s n m)/)
  return encontrado ? Number(encontrado[1].replace(/[.\s]/g, '')) : null
}
