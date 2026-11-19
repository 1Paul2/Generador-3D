// Ruido de valor en 3D: un numero al azar en cada esquina de una cuadricula
// invisible, mezclados suavemente entre esquinas. Sumando varias escalas del
// mismo ruido (fbm) salen manchas de borde irregular, como continentes o vetas.

const TAMANO = 256

export function crearRuido(random) {
  const valores = Float32Array.from({ length: TAMANO }, () => random())
  const orden = Array.from({ length: TAMANO }, (_, i) => i)
  for (let i = TAMANO - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[orden[i], orden[j]] = [orden[j], orden[i]]
  }

  // Valor fijo de una esquina de la cuadricula.
  const esquina = (x, y, z) => valores[orden[(orden[(orden[x & 255] + y) & 255] + z) & 255]]
  // Curva en S: hace que la mezcla entre esquinas no deje quiebres visibles.
  const suave = (t) => t * t * (3 - 2 * t)
  const mezclar = (a, b, t) => a + (b - a) * t

  function ruido(x, y, z) {
    const [xi, yi, zi] = [Math.floor(x), Math.floor(y), Math.floor(z)]
    const [tx, ty, tz] = [suave(x - xi), suave(y - yi), suave(z - zi)]
    const v = (dx, dy, dz) => esquina(xi + dx, yi + dy, zi + dz)
    return mezclar(
      mezclar(mezclar(v(0, 0, 0), v(1, 0, 0), tx), mezclar(v(0, 1, 0), v(1, 1, 0), tx), ty),
      mezclar(mezclar(v(0, 0, 1), v(1, 0, 1), tx), mezclar(v(0, 1, 1), v(1, 1, 1), tx), ty),
      tz,
    )
  }

  // Suma el ruido a escalas cada vez mas finas: manchas grandes con bordes detallados.
  return function fbm(x, y, z, octavas = 4) {
    let suma = 0
    let total = 0
    let amplitud = 0.5
    let frecuencia = 1
    for (let o = 0; o < octavas; o++) {
      suma += amplitud * ruido(x * frecuencia, y * frecuencia, z * frecuencia)
      total += amplitud
      amplitud *= 0.5
      frecuencia *= 2
    }
    return suma / total
  }
}
