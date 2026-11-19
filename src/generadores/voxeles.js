// Generadores de formas con voxeles (cubos de 1x1x1).
// Solo devuelven datos: posiciones y variacion de color, sin nada de Three.js.

function generarCubo(tamano) {
  const lado = Math.round(8 * tamano)
  const voxeles = []
  for (let x = 0; x < lado; x++) {
    for (let y = 0; y < lado; y++) {
      for (let z = 0; z < lado; z++) {
        voxeles.push({ x: x - (lado - 1) / 2, y, z: z - (lado - 1) / 2 })
      }
    }
  }
  return voxeles
}

function generarEsfera(tamano) {
  const radio = 6 * tamano
  const limite = Math.ceil(radio)
  const voxeles = []
  for (let x = -limite; x <= limite; x++) {
    for (let y = -limite; y <= limite; y++) {
      for (let z = -limite; z <= limite; z++) {
        if (x * x + y * y + z * z <= radio * radio) {
          voxeles.push({ x, y: y + limite, z })
        }
      }
    }
  }
  return voxeles
}

function generarPiramide(tamano) {
  const base = Math.round(13 * tamano)
  const voxeles = []
  for (let y = 0; y * 2 < base; y++) {
    const lado = base - y * 2
    for (let x = 0; x < lado; x++) {
      for (let z = 0; z < lado; z++) {
        voxeles.push({ x: x - (lado - 1) / 2, y, z: z - (lado - 1) / 2 })
      }
    }
  }
  return voxeles
}

const GENERADORES = {
  cubo: generarCubo,
  esfera: generarEsfera,
  piramide: generarPiramide,
}

// Segundos que tarda en llegar el ultimo fragmento a su lugar (sin contar su vuelo).
const DURACION_ARMADO = 3

// Prepara cada voxel como un fragmento que vuela desde un punto disperso
// hasta su lugar. Se arma de abajo hacia arriba, con algo de desorden.
export function construir(receta, random) {
  const voxeles = GENERADORES[receta.tipo](receta.tamano)

  const ordenados = voxeles
    .map((voxel) => ({ ...voxel, orden: voxel.y + random() * 2 }))
    .sort((a, b) => a.orden - b.orden)

  const fragmentos = ordenados.map((voxel, i) => {
    const angulo = random() * Math.PI * 2
    const distancia = 14 + random() * 10
    return {
      destino: [voxel.x, voxel.y, voxel.z],
      origen: [
        voxel.x + Math.cos(angulo) * distancia,
        voxel.y + 6 + random() * 12,
        voxel.z + Math.sin(angulo) * distancia,
      ],
      retraso: (i / ordenados.length) * DURACION_ARMADO,
      giro: (random() - 0.5) * Math.PI * 4,
      variacion: (random() - 0.5) * 0.12,
    }
  })

  const altura = Math.max(...voxeles.map((voxel) => voxel.y)) + 1
  return { fragmentos, altura }
}
