import { normalizar } from './interpretar.js'

// Pistas que, si aparecen en la descripcion de algo, indican a que figura se parece.
const PISTAS = {
  esfera: [
    'esfera', 'esferico', 'esferica', 'planeta', 'planeta enano', 'satelite', 'luna',
    'estrella', 'asteroide', 'cuerpo celeste', 'pelota', 'balon', 'bola', 'globo',
    'burbuja', 'perla', 'canica', 'fruta',
  ],
  cubo: [
    'cubo', 'cubico', 'caja', 'bloque', 'ladrillo', 'contenedor', 'mueble', 'armario',
    'cofre', 'electrodomestico',
  ],
  dado: ['dado', 'poliedrica', 'poliedro'],
  edificio: ['edificio', 'edificacion', 'casa', 'vivienda', 'rascacielos', 'construccion'],
  torre: ['torre', 'monumento', 'faro', 'campanario', 'chimenea', 'obelisco', 'columna'],
  piramide: ['piramide', 'piramidal', 'tetraedro', 'triangulo'],
  cono: ['cono', 'conica', 'conico'],
  arbol: ['arbol', 'conifera', 'planta lenosa', 'pino', 'abeto'],
  volcan: ['volcan', 'crater', 'erupcion'],
  montana: ['montana', 'monte', 'cordillera', 'macizo', 'pico'],
  colina: ['colina', 'cerro', 'loma', 'otero'],
  isla: ['isla', 'archipielago', 'atolon', 'islote'],
  duna: ['duna', 'desierto', 'erg'],
  cascada: ['cascada', 'catarata', 'salto de agua', 'caida vertical', 'caida de agua'],
  rio: ['rio', 'arroyo', 'corriente natural de agua', 'curso de agua', 'afluente'],
  lago: ['lago', 'laguna', 'cuerpo de agua'],
  canon: ['canon', 'garganta', 'barranco', 'desfiladero'],
  acantilado: ['acantilado', 'risco', 'precipicio'],
  costa: ['playa', 'costa', 'litoral', 'bahia'],
  llano: ['llanura', 'pradera', 'llano', 'valle'],
  meseta: ['meseta', 'altiplano'],
  cilindro: [
    'cilindro', 'cilindrico', 'cilindrica', 'tubo', 'lata', 'botella', 'vaso', 'tronco',
    'barril',
  ],
  disco: ['disco', 'moneda', 'rueda', 'plato', 'pizza', 'galleta'],
  diamante: ['diamante', 'gema', 'cristal', 'piedra preciosa'],
  capsula: ['capsula', 'pastilla', 'pildora', 'comprimido'],
  cojin: ['cojin', 'almohada', 'colchon'],
  huevo: ['huevo', 'ovalo', 'ovoide'],
}

// Lee un texto (por ejemplo, la descripcion de Wikipedia) y devuelve la figura
// cuya pista aparece primero. La primera mencion suele ser la que define que
// es la cosa: "La Tierra es el planeta..." pesa mas que lo que se dice despues.
export function clasificar(texto) {
  const limpio = normalizar(texto ?? '')
  let mejor = null

  for (const [tipo, pistas] of Object.entries(PISTAS)) {
    for (const pista of pistas) {
      const posicion = limpio.search(new RegExp(`\\b${pista}(e?s)?\\b`))
      if (posicion !== -1 && (!mejor || posicion < mejor.posicion)) {
        mejor = { tipo, pista, posicion }
      }
    }
  }
  return mejor
}
