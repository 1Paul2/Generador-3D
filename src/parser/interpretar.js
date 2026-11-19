// Traduce el texto del buscador a una "receta": que forma construir y con que parametros.

const FORMAS = {
  cubo: 'cubo',
  caja: 'cubo',
  dado: 'cubo',
  esfera: 'esfera',
  bola: 'esfera',
  pelota: 'esfera',
  planeta: 'esfera',
  piramide: 'piramide',
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
}

const TAMANOS = {
  diminuto: 0.5,
  diminuta: 0.5,
  pequeno: 0.7,
  pequena: 0.7,
  chico: 0.7,
  chica: 0.7,
  grande: 1.3,
  gigante: 1.6,
}

export const FORMAS_DISPONIBLES = ['cubo', 'esfera', 'pirámide']

// Quita tildes y mayusculas: "Pirámide Pequeña" -> "piramide pequena".
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Busca la palabra tal cual y sin plural ("cubos" -> "cubo", "naranjas" -> "naranja").
function buscar(diccionario, palabra) {
  return (
    diccionario[palabra] ??
    diccionario[palabra.replace(/s$/, '')] ??
    diccionario[palabra.replace(/es$/, '')]
  )
}

// Devuelve { tipo, color, tamano } o null si no reconoce ninguna forma.
export function interpretar(texto) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean)
  const receta = { tipo: null, color: '#c084fc', tamano: 1 }

  for (const palabra of palabras) {
    receta.tipo ??= buscar(FORMAS, palabra) ?? null
    receta.color = buscar(COLORES, palabra) ?? receta.color
    receta.tamano = buscar(TAMANOS, palabra) ?? receta.tamano
  }

  return receta.tipo ? receta : null
}
