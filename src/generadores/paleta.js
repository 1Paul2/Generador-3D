// Paleta de colores para pintar un modelo cuando no hay imagen o el usuario
// eligio el color. Cada color tiene un peso: que parte de la superficie ocupa.
// Los colores son [r, g, b] de 0 a 255.

// Tres tonos (oscuro, normal y claro) de un solo color: "esfera roja" se pinta
// con rojos variados en lugar de un rojo plano. La variacion es leve, como la
// de un material real pintado de un color, y no manchas de camuflaje.
// Correccion - Poll: los tonos eran tan distintos que la figura parecia manchada
export function paletaDesdeColor(hex) {
  const base = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const tono = (hacia, cuanto) => base.map((v) => Math.round(v + (hacia - v) * cuanto))
  return [
    { color: tono(0, 0.12), peso: 0.3 },
    { color: base, peso: 0.4 },
    { color: tono(255, 0.08), peso: 0.3 },
  ]
}
