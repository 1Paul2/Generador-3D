import { STLLoader } from 'three/addons/loaders/STLLoader.js'

// Descarga un modelo 3D en formato STL (el de las impresoras 3D) y lo convierte
// en una geometria. Devuelve null si no se pudo descargar o leer.
export async function cargarModelo3D(url) {
  try {
    const respuesta = await fetch(url)
    if (!respuesta.ok) return null
    return new STLLoader().parse(await respuesta.arrayBuffer())
  } catch {
    return null
  }
}
