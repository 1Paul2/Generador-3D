import { clasificar } from '../parser/clasificar.js'

// Consultas a Wikipedia en espanol. Es gratis, no pide clave y permite llamadas
// desde el navegador. Las respuestas se guardan para no repetir la misma consulta.

const API = 'https://es.wikipedia.org'
const resumenes = new Map()

// Resumen de un articulo: titulo, descripcion corta, primer parrafo, enlace e imagen.
// Primero se pide al buscador de Wikipedia el titulo exacto, porque el resumen
// distingue mayusculas ("torre eiffel" no existe, "Torre Eiffel" si).
// Devuelve null si no existe o si no se pudo consultar.
export async function resumen(termino) {
  if (resumenes.has(termino)) return resumenes.get(termino)

  try {
    const [titulo] = await sugerirTitulos(termino)
    const respuesta = await fetch(
      `${API}/api/rest_v1/page/summary/${encodeURIComponent(titulo ?? termino)}?redirect=true`,
    )
    // Solo se recuerda una respuesta definitiva. Si Wikipedia pide esperar
    // (demasiadas consultas) o falla, se vuelve a intentar la proxima vez.
    if (respuesta.status === 404) resumenes.set(termino, null)
    if (!respuesta.ok) return null

    const datos = await respuesta.json()
    const articulo = {
      titulo: datos.title,
      descripcion: datos.description ?? '',
      extracto: datos.extract ?? '',
      url: datos.content_urls?.desktop?.page,
      imagen: datos.thumbnail?.source ?? null,
      wikidata: datos.wikibase_item ?? null,
      ambiguo: datos.type === 'disambiguation',
    }
    resumenes.set(termino, articulo)
    return articulo
  } catch {
    // Sin conexion: se comporta como si no hubiera articulo.
    return null
  }
}

// Nombres de archivo que casi nunca son una foto del objeto en si.
const NO_ES_FOTO = /mapa|map|locator|ubicaci|escudo|coat|bandera|flag|logo|icon|diagram|esquema|scheme|plano|grafic|chart/i

// Ancho en pixeles de la copia de la foto que se descarga. Mas grande que la
// grilla de analisis: al achicarla se promedian varios pixeles reales y se
// reduce el ruido de compresion de la foto.
const ANCHO_FOTO = 1280

// Formatos de las imagenes de Wikidata que pueden ser fotos.
const FORMATOS_FOTO = ['image/jpeg', 'image/png', 'image/tiff', 'image/webp']

async function consultar(url) {
  const respuesta = await fetch(url)
  return respuesta.ok ? respuesta.json() : null
}

// Datos de los archivos de Commons pedidos: direccion de una copia de 640 px y tipo.
function archivos(datos) {
  return Object.values(datos?.query?.pages ?? {})
    .map((pagina) => ({ nombre: pagina.title, ...pagina.imageinfo?.[0] }))
    .filter((archivo) => archivo.thumburl)
}

// Busca una fotografia real de lo que describe el articulo, en este orden:
//   1. Las imagenes representativas que la comunidad eligio en Wikidata
//      (propiedad P18), en su orden: la primera que sea una foto y no un mapa,
//      logo o esquema. Las fotos de planetas y de objetos recortados suelen
//      estar en PNG, y algunas en TIFF (Commons entrega una copia en JPEG).
//   2. La primera foto del articulo que no sea un mapa, escudo, logo o esquema.
//   3. La imagen principal del resumen, sea cual sea.
// Correccion - Poll: Marte, Jupiter y Saturno descartaban su foto principal (PNG o TIFF) y tomaban otra cualquiera
export async function buscarFoto(articulo) {
  try {
    if (articulo.wikidata) {
      const datos = await consultar(
        `https://www.wikidata.org/w/api.php?action=wbgetclaims&property=P18&format=json&origin=*&entity=${articulo.wikidata}`,
      )
      const nombres = (datos?.claims?.P18 ?? []).map((dato) => dato.mainsnak?.datavalue?.value).filter(Boolean)
      if (nombres.length) {
        const parametros = new URLSearchParams({
          action: 'query',
          prop: 'imageinfo',
          iiprop: 'url|mime',
          iiurlwidth: String(ANCHO_FOTO),
          titles: nombres.map((nombre) => `File:${nombre}`).join('|'),
          format: 'json',
          origin: '*',
        })
        const fotos = archivos(await consultar(`https://commons.wikimedia.org/w/api.php?${parametros}`))
        // Commons las devuelve en otro orden: se respeta el de Wikidata.
        const titulo = (nombre) => `File:${nombre}`.replace(/_/g, ' ')
        for (const nombre of nombres) {
          const foto = fotos.find((archivo) => archivo.nombre === titulo(nombre))
          if (foto && FORMATOS_FOTO.includes(foto.mime) && !NO_ES_FOTO.test(foto.nombre)) return foto.thumburl
        }
      }
    }

    const parametros = new URLSearchParams({
      action: 'query',
      generator: 'images',
      gimlimit: '50',
      prop: 'imageinfo',
      iiprop: 'url|mime',
      iiurlwidth: String(ANCHO_FOTO),
      titles: articulo.titulo,
      format: 'json',
      origin: '*',
    })
    const fotos = archivos(await consultar(`${API}/w/api.php?${parametros}`))
    const foto = fotos.find((archivo) => archivo.mime === 'image/jpeg' && !NO_ES_FOTO.test(archivo.nombre))
    if (foto) return foto.thumburl
  } catch {
    // Sin conexion o error: se usa la imagen principal.
  }
  return articulo.imagen
}

// Peso maximo de un modelo 3D para descargarlo (algunos pesan mas de 100 MB).
const LIMITE_MODELO = 25e6

// Busca si la cosa tiene un modelo 3D real enlazado en Wikidata (propiedad
// P4896): son escaneos y modelos subidos a Wikimedia Commons, y la comunidad
// los enlazo a mano, asi que son de la cosa correcta. Devuelve la direccion
// del archivo STL, o null si no hay o pesa demasiado.
export async function buscarModelo3D(articulo) {
  if (!articulo.wikidata) return null
  try {
    const datos = await consultar(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&property=P4896&format=json&origin=*&entity=${articulo.wikidata}`,
    )
    const nombre = datos?.claims?.P4896?.[0]?.mainsnak?.datavalue?.value
    if (!nombre) return null

    const parametros = new URLSearchParams({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|size',
      titles: `File:${nombre}`,
      format: 'json',
      origin: '*',
    })
    const info = await consultar(`https://commons.wikimedia.org/w/api.php?${parametros}`)
    const archivo = Object.values(info?.query?.pages ?? {})[0]?.imageinfo?.[0]
    return archivo && archivo.size <= LIMITE_MODELO ? archivo.url : null
  } catch {
    return null
  }
}

// Aclaraciones entre parentesis que no nombran una cosa que se pueda construir.
const NO_ES_COSA = /color|álbum|album|película|canción|banda|grupo|serie|novela|libro|discurso|apellido|nombre|empresa|revista|programa|personaje|desambiguación/i

// Una pagina de desambiguacion ("Naranja") no describe nada. Se busca entre
// los articulos con aclaracion ("Naranja (fruta)", "Naranja (color)") el
// primero que nombra una cosa.
async function desambiguar(termino) {
  const titulos = await sugerirTitulos(termino)
  const inicio = termino.toLowerCase() + ' ('
  for (const titulo of titulos) {
    if (!titulo.toLowerCase().startsWith(inicio) || NO_ES_COSA.test(titulo)) continue
    const articulo = await resumen(titulo)
    if (articulo && !articulo.ambiguo) return articulo
  }
  return null
}

// Palabras desde las que el extracto ya no dice que es la cosa sino de que
// partes esta hecha: "...compuesto de una caja de madera" no hace caja a la guitarra.
const PARTES = /\b(compuest[oa]s?|formad[oa]s?|const[ae]|consta|provist[oa]s?|tiene|tienen|cuenta con|hech[oa]s? de)\b/i

// La primera oracion del extracto, hasta donde empieza a describir sus partes.
function definicion(extracto) {
  const oracion = extracto.split(/\.\s/)[0]
  const corte = oracion.search(PARTES)
  return corte === -1 ? oracion : oracion.slice(0, corte)
}

// Busca las palabras desconocidas en Wikipedia (primero la frase completa, luego
// cada palabra) y decide que forma se les parece segun lo que dice el articulo.
// Devuelve { tipo, articulo, pista }; tipo es null si el articulo no da pistas.
// Correccion - Poll: "naranja" terminaba en la pagina de desambiguacion, sin foto
// Correccion - Poll: la guitarra salia como cubo por la "caja" de resonancia del extracto
export async function clasificarConWikipedia(palabras) {
  const terminos = [...new Set([palabras.join(' '), ...palabras])]
  let encontrado = null

  for (const termino of terminos) {
    let articulo = await resumen(termino)
    if (articulo?.ambiguo) articulo = (await desambiguar(termino)) ?? articulo
    if (!articulo) continue
    // Una pagina de desambiguacion no describe nada; se mira la palabra misma.
    const pista = articulo.ambiguo
      ? clasificar(termino)
      : clasificar(articulo.descripcion) ?? clasificar(definicion(articulo.extracto))
    if (pista) return { tipo: pista.tipo, pista: pista.pista, articulo }
    encontrado ??= { tipo: null, articulo }
  }
  return encontrado
}

// Titulos de articulos que empiezan como el texto escrito, para sugerirlos.
export async function sugerirTitulos(texto, senal) {
  const parametros = new URLSearchParams({
    action: 'opensearch',
    search: texto,
    limit: '5',
    namespace: '0',
    format: 'json',
    origin: '*',
  })
  try {
    const respuesta = await fetch(`${API}/w/api.php?${parametros}`, { signal: senal })
    if (!respuesta.ok) return []
    const [, titulos] = await respuesta.json()
    return titulos
  } catch {
    return []
  }
}
