import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { normalizar } from '../parser/interpretar.js'

// Descarga el modelo generado como archivo .glb, el formato estandar de
// modelos 3D (glTF binario): se abre en Blender, en el Visor 3D de Windows,
// en Unity o en cualquier pagina con un visor 3D. Guarda la forma y el color
// de cada vertice.
export async function descargarGLB(geometria, texto) {
  // Copia solo con lo que entiende cualquier programa: posicion, luz y color.
  const limpia = new THREE.BufferGeometry()
  for (const nombre of ['position', 'normal', 'color']) {
    if (geometria.attributes[nombre]) limpia.setAttribute(nombre, geometria.attributes[nombre])
  }
  if (geometria.index) limpia.setIndex(geometria.index)

  const nombre = normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'modelo'
  const malla = new THREE.Mesh(
    limpia,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  )
  malla.name = nombre

  const datos = await new GLTFExporter().parseAsync(malla, { binary: true })
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(new Blob([datos], { type: 'model/gltf-binary' }))
  enlace.download = `${nombre}.glb`
  enlace.click()
  // Se libera la direccion temporal cuando el navegador ya empezo la descarga.
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000)
  malla.material.dispose()
}
