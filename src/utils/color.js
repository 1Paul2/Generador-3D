// Conversion de colores RGB (0 a 255) al espacio Lab, donde la distancia entre
// dos colores se parece a la diferencia que percibe el ojo humano: en RGB dos
// verdes muy distintos pueden quedar cerca, en Lab no.
//   L: luz (0 negro a 100 blanco), a: de verde a rojo, b: de azul a amarillo.

const lineal = (canal) => {
  const c = canal / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)

export function rgbALab([r, g, b]) {
  const [R, G, B] = [lineal(r), lineal(g), lineal(b)]
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}
