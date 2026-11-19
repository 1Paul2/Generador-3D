// Oclusion ambiental por curvatura: a los pliegues, huecos y juntas les llega
// menos luz que a las partes que sobresalen, asi que se oscurecen un poco.
// Para saber si un punto esta en un pliegue se mira donde quedan sus vecinos:
// si el promedio de los vecinos queda "delante" del punto (hacia donde mira la
// superficie), el punto esta en un valle. El resultado se suaviza y se
// multiplica por el color de cada vertice.

const FUERZA = 0.45 // cuanto se oscurece el pliegue mas profundo
const PASADAS = 2 // suavizado del resultado para que no se vea ruidoso

// Devuelve, para cada vertice, por cuanto multiplicar su color (1 = sin cambio).
// La geometria tiene que tener indice y normales.
export function calcularOclusion(geometria) {
  const posiciones = geometria.attributes.position.array
  const normales = geometria.attributes.normal.array
  const indices = geometria.index.array
  const cantidad = posiciones.length / 3

  const vecinos = Array.from({ length: cantidad }, () => new Set())
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]]
    vecinos[a].add(b).add(c)
    vecinos[b].add(a).add(c)
    vecinos[c].add(a).add(b)
  }

  let valle = new Float32Array(cantidad)
  for (let v = 0; v < cantidad; v++) {
    if (!vecinos[v].size) continue
    const promedio = [0, 0, 0]
    let largo = 0
    for (const n of vecinos[v]) {
      const d = [0, 1, 2].map((eje) => posiciones[n * 3 + eje] - posiciones[v * 3 + eje])
      promedio[0] += d[0]
      promedio[1] += d[1]
      promedio[2] += d[2]
      largo += Math.hypot(...d)
    }
    const total = vecinos[v].size
    const adelante =
      (promedio[0] * normales[v * 3] + promedio[1] * normales[v * 3 + 1] + promedio[2] * normales[v * 3 + 2]) / total
    valle[v] = Math.max(0, adelante / Math.max(1e-6, largo / total))
  }

  for (let pasada = 0; pasada < PASADAS; pasada++) {
    const suave = new Float32Array(cantidad)
    for (let v = 0; v < cantidad; v++) {
      let suma = valle[v]
      for (const n of vecinos[v]) suma += valle[n]
      suave[v] = suma / (vecinos[v].size + 1)
    }
    valle = suave
  }
  return valle.map((profundidad) => 1 - FUERZA * Math.min(1, profundidad * 3))
}

// Multiplica el color de cada vertice por su factor de oclusion.
export function aplicarOclusion(geometria, factores) {
  const colores = geometria.attributes.color
  for (let v = 0; v < colores.count; v++) {
    colores.setXYZ(v, colores.getX(v) * factores[v], colores.getY(v) * factores[v], colores.getZ(v) * factores[v])
  }
  colores.needsUpdate = true
}
