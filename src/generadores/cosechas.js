import { ARRIBA, aclarar, columna, cuerpo, girar, hoja, mezclar, transicion, vector } from './botanica.js'
import { frutaDePina, granoDeArroz, mazorca, racimoDePalma, trozoDeCana } from './plantas.js'
import { cerezaDeCafe, frutoDeChile, frutoDeTomate, mazorcaDeCacao, tuberculoDePapa, vainaDeFrijol } from './huerta.js'
import { frutoDeAguacate, frutoDeChayote, frutoDeCoco, frutoDeMango, frutoDeMelon, frutoDeNaranja, frutoDePapaya, racimoDePejibaye } from './frutales.js'

// Lo que se cosecha de cada cultivo, solo (sin la planta): un banano o una
// mano de bananos, la pina, las raices de yuca, una rama con granos de cafe,
// trozos de cana, la mazorca, un monton de frijoles o de arroz, tomates,
// papas, chiles, la mazorca de cacao y el racimo de palma.

// Banano (o platano): curvo, de cinco aristas, con el cuello verde hacia el
// pedunculo, la punta negra y pecas cafe. El platano es mas grande, mas
// anguloso y mas verde.
// Correccion - Poll: la punta del pedunculo del banano quedaba abierta
function dedoDeBanano(malla, desde, salida, platano, random, ruido) {
  const largo = platano ? 0.28 : 0.2
  const radio = platano ? 0.024 : 0.019
  const eje = salida.clone().cross(ARRIBA).normalize()
  const punto = (s) => desde.clone().addScaledVector(salida, largo * s * 0.75).addScaledVector(girar(salida, eje, s * 1.1), largo * s * 0.25)
  const base = platano ? [200, 190, 70] : [236, 200, 60]
  malla.tubo(
    40,
    20,
    punto,
    (s, a) =>
      radio *
      Math.pow(Math.sin(Math.PI * Math.min(1, 0.03 + s * 0.98)), 0.45) *
      (0.55 + 0.45 * transicion(0, 0.25, s)) *
      (1 + (platano ? 0.1 : 0.06) * Math.cos(a * 5)),
    (s, a, p) => {
      let c = aclarar(base, 0.88 + ruido(p.x * 300, p.y * 300, p.z * 300, 2) * 0.16 + 0.06 * Math.cos(a * 5))
      // Cuello verde, pecas cafe y punta negra.
      c = mezclar(c, [120, 150, 60], 1 - transicion(0.05, 0.25, s))
      c = mezclar(c, [95, 62, 30], transicion(0.7, 0.76, ruido(p.x * 150, p.y * 150, p.z * 150, 2)) * (platano ? 0.9 : 0.7))
      return mezclar(c, [40, 32, 26], transicion(0.93, 0.98, s))
    },
    { tapas: true },
  )
}

function banano(malla, random, ruido, opciones) {
  const platano = opciones.palabra === 'platano'
  if (!opciones.racimo) {
    dedoDeBanano(malla, vector(-0.08, 0.02, 0), vector(1, 0, 0), platano, random, ruido)
    return
  }
  // Mano: la corona de donde salen los dedos, en dos filas.
  const corona = vector(0, 0.06, 0)
  cuerpo(malla, corona.clone().add(vector(-0.03, 0, 0)), corona.clone().add(vector(0.01, 0.02, 0)), 0.025, () => 1, () => [110, 120, 70], { nu: 4, nv: 16 })
  for (let fila = 0; fila < 2; fila++) {
    const dedos = 7 - fila
    for (let d = 0; d < dedos; d++) {
      const ang = (d / (dedos - 1) - 0.5) * 1.6
      const salida = vector(Math.cos(ang), -0.1 + fila * 0.25, Math.sin(ang)).normalize()
      dedoDeBanano(malla, corona.clone().addScaledVector(ARRIBA, fila * 0.02), salida, platano, random, ruido)
    }
  }
}

// Raices de yuca recien arrancadas: alargadas y algo curvas, con la cascara
// cafe y aspera de anillos finos, y una cortada que deja ver la pulpa blanca
// con el anillo rosado de la cascara interna.
// Correccion - Poll: la punta gruesa de las raices quedaba abierta y se veia el hueco
function yuca(malla, random, ruido) {
  for (let r = 0; r < 3; r++) {
    const largo = 0.34 + random() * 0.1
    const radio = 0.045 + random() * 0.012
    const az = r * 0.5 - 0.5
    const dir = vector(Math.cos(az), 0, Math.sin(az))
    const desde = vector(-largo / 2, radio, (r - 1) * 0.09)
    const curva = (random() - 0.5) * 0.08
    const centro = (u) => desde.clone().addScaledVector(dir, largo * u).add(vector(0, 0, Math.sin(Math.PI * u) * curva))
    const cortada = r === 0
    const perfil = (u) => Math.pow(Math.sin(Math.PI * Math.min(1, cortada ? 0.5 + u * 0.5 : 0.02 + u * 0.98)), 0.22) * (1 - 0.25 * transicion(0.5, 1, u))
    malla.tubo(
      60,
      24,
      centro,
      (u, a) => radio * perfil(u) * (1 + 0.03 * Math.sin(u * 140) * ruido(Math.cos(a), u * 30, Math.sin(a), 2)),
      (u, a, p) => {
        let c = aclarar([112, 74, 46], 0.75 + ruido(p.x * 200, p.y * 200, p.z * 200, 3) * 0.4)
        // Anillos finos de la cascara.
        c = aclarar(c, 1 + 0.1 * Math.sin(u * 160 + ruido(p.x * 40, p.y * 40, p.z * 40, 2) * 6))
        return mezclar(c, [150, 110, 72], transicion(0.62, 0.7, ruido(p.x * 30, p.y * 30, p.z * 30, 3)) * 0.5)
      },
      { tapas: !cortada },
    )
    if (cortada) {
      // Cara del corte: pulpa blanca, anillo rosado y la cascara.
      const c0 = centro(0)
      const normal = dir.clone().negate()
      const lado = normal.clone().cross(ARRIBA).normalize()
      malla.superficie(10, 24, (u, v) => {
        const a = v * Math.PI * 2
        const r0 = radio * perfil(0) * u
        const p = c0.clone().addScaledVector(lado, Math.cos(a) * r0).addScaledVector(ARRIBA, Math.sin(a) * r0)
        let c = aclarar([238, 232, 212], 0.92 + ruido(p.x * 800, p.y * 800, p.z * 800, 1) * 0.1)
        c = mezclar(c, [215, 150, 150], transicion(0.78, 0.86, u) * (1 - transicion(0.9, 0.94, u)))
        return { p, c: mezclar(c, [112, 74, 46], transicion(0.93, 0.98, u)) }
      })
    }
  }
}

// Rama de cafe recien cortada, con dos pares de hojas y los racimos de granos.
// Correccion - Poll: las puntas de la bandola quedaban abiertas
function cafe(malla, random, ruido) {
  const eje = columna(vector(-0.18, 0.04, 0), vector(1, 0.05, 0), 0.36, 0.2, 20)
  malla.tubo(40, 8, (u) => eje(u).p, () => 0.004, () => [104, 112, 72], { tapas: true })
  for (let n = 1; n <= 4; n++) {
    const s = n / 4.5
    const { p, tangente } = eje(s)
    const lateral = tangente.clone().cross(ARRIBA).normalize()
    if (n % 2 === 0) {
      for (const signo of [-1, 1]) {
        hoja(malla, {
          base: p,
          direccion: lateral.clone().multiplyScalar(signo).addScaledVector(tangente, 0.5).normalize(),
          largo: 0.12,
          ancho: 0.04,
          curvatura: 0.4,
          pliegue: 0.18,
          onda: 0.1,
          abolladura: 0.05,
          nervios: 9,
          color: () => [32, 82, 34],
          ruido,
        })
      }
    }
    for (let g = 0; g < 9; g++) {
      const fuera = lateral.clone().applyAxisAngle(tangente, (g / 9) * Math.PI * 2)
      const centro = p.clone().addScaledVector(fuera, 0.011).addScaledVector(tangente, (random() - 0.5) * 0.014)
      cerezaDeCafe(malla, centro, tangente, 0.0075, Math.min(1, 0.6 + random() * 0.45), ruido)
    }
  }
}

// Tres trozos de cana cortada, uno apoyado sobre los otros.
function cana(malla, random, ruido) {
  for (let t = 0; t < 3; t++) {
    const y = t === 2 ? 0.05 : 0.018
    const z = t === 2 ? 0 : (t - 0.5) * 0.04
    const giro = (random() - 0.5) * 0.3
    trozoDeCana(malla, vector(-0.4, y, z - giro * 0.4), vector(0.4, y, z + giro * 0.4), random, ruido)
  }
}

// Monton de frijoles (rojos, o del color que se pida: "frijoles negros") con un par de
// vainas secas al lado. Cada frijol es un rinon chico con el hilo blanco.
// Correccion - Poll: los granos quedaban abiertos por un lado
function frijol(malla, random, ruido, opciones) {
  const color = opciones.color ? aclarar(opciones.color, 0.6) : [118, 32, 36]
  for (let f = 0; f < 320; f++) {
    // Monton conico: mas granos en el centro y mas altos.
    const r = Math.sqrt(random()) * 0.075
    const az = random() * Math.PI * 2
    const centro = vector(Math.cos(az) * r, 0.005 + Math.pow(1 - r / 0.075, 1.3) * 0.055 + random() * 0.004, Math.sin(az) * r)
    const eje = vector(random() - 0.5, (random() - 0.5) * 0.5, random() - 0.5).normalize()
    const curva = eje.clone().cross(ARRIBA).normalize()
    const tono = 0.85 + random() * 0.25
    malla.tubo(
      10,
      10,
      (u) => centro.clone().addScaledVector(eje, (u - 0.5) * 0.014).addScaledVector(curva, Math.sin(Math.PI * u) * 0.0015),
      (u) => 0.0045 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + u * 0.95)), 0.6),
      (u, a) => {
        const c = aclarar(color, tono * (1 + 0.25 * Math.max(0, Math.cos(a)) ** 6))
        // Hilo (hilum) blanco en el medio del lado concavo.
        return Math.abs(u - 0.5) < 0.12 && Math.cos(a) < -0.85 ? [225, 220, 205] : c
      },
      { tapas: true },
    )
  }
  for (let v = 0; v < 2; v++) {
    vainaDeFrijol(malla, vector(0.11 + v * 0.03, 0.006, -0.06 + v * 0.05), vector(0.2, 0, 1).normalize(), 0.11, true, ruido)
  }
}

// Tomates: tres, de distinto punto de madurez.
function tomate(malla, random, ruido) {
  const radios = [0.04, 0.034, 0.03]
  radios.forEach((radio, t) => {
    frutoDeTomate(malla, vector((t - 1) * 0.085, radio * 0.82, (t % 2) * 0.03), radio, 1 - t * 0.3, random, ruido)
  })
}

// Monton de arroz en granza (con cascara).
function arroz(malla, random, ruido) {
  for (let g = 0; g < 650; g++) {
    const r = Math.sqrt(random()) * 0.07
    const az = random() * Math.PI * 2
    const centro = vector(Math.cos(az) * r, 0.002 + (1 - r / 0.07) * 0.035 + random() * 0.003, Math.sin(az) * r)
    const eje = vector(random() - 0.5, (random() - 0.5) * 0.4, random() - 0.5).normalize()
    granoDeArroz(malla, centro, eje, ruido, aclarar([208, 180, 98], 0.85 + random() * 0.25))
  }
}

// Papas: tres tuberculos recien sacados.
function papa(malla, random, ruido) {
  for (let t = 0; t < 3; t++) {
    const tamano = 0.09 + random() * 0.03
    tuberculoDePapa(malla, vector((t - 1) * 0.1, tamano * 0.38, (t % 2) * 0.05), vector(Math.cos(t * 1.3), 0.1, Math.sin(t * 1.3)).normalize(), tamano, random, ruido)
  }
}

// Chiles dulces: uno rojo y uno verde.
function chile(malla, random, ruido) {
  frutoDeChile(malla, vector(-0.05, 0.1, 0), 0.1, true, random, ruido)
  frutoDeChile(malla, vector(0.05, 0.09, 0.02), 0.09, false, random, ruido)
}

// Mazorca de cacao acostada.
function cacao(malla, random, ruido) {
  mazorcaDeCacao(malla, vector(-0.1, 0.05, 0), vector(1, 0, 0), 0.2, random() < 0.4, ruido)
}

// Racimo de palma aceitera recien cortado, apoyado en el suelo.
function palma(malla, random, ruido) {
  racimoDePalma(malla, vector(0, 0.02, 0), vector(0.05, 0.4, 0), ruido)
}

function pina(malla, random, ruido) {
  frutaDePina(malla, 0, random, ruido)
}

function maiz(malla, random, ruido) {
  mazorca(malla, random, ruido)
}

// Naranjas (o limones): tres frutas, una con la hoja todavia pegada.
function naranja(malla, random, ruido, opciones) {
  const limon = opciones.palabra === 'limon'
  const radio = limon ? 0.028 : 0.04
  for (let n = 0; n < 3; n++) frutoDeNaranja(malla, vector((n - 1) * radio * 2.1, radio, (n % 2) * radio), radio, random, ruido, limon)
}

function mango(malla, random, ruido) {
  for (let n = 0; n < 2; n++) frutoDeMango(malla, vector((n - 0.5) * 0.1, 0.11, 0), 0.12, random, ruido)
}

function aguacate(malla, random, ruido) {
  for (let n = 0; n < 2; n++) frutoDeAguacate(malla, vector((n - 0.5) * 0.1, 0.12, 0), 0.075, random, ruido)
}

function papaya(malla, random, ruido) {
  frutoDePapaya(malla, vector(-0.13, 0.065, 0), vector(1, 0, 0), 0.28, 0.6, ruido)
}

function chayote(malla, random, ruido) {
  for (let n = 0; n < 3; n++) frutoDeChayote(malla, vector((n - 1) * 0.11, 0.14, (n % 2) * 0.05), 0.14, random, ruido)
}

function melon(malla, random, ruido) {
  frutoDeMelon(malla, vector(0, 0.085, 0), 0.09, false, random, ruido)
}

function sandia(malla, random, ruido) {
  frutoDeMelon(malla, vector(0, 0.15, 0), 0.17, true, random, ruido)
}

function coco(malla, random, ruido) {
  frutoDeCoco(malla, vector(-0.13, 0.12, 0), vector(1, 0.1, 0).normalize(), 0.12, false, ruido)
  frutoDeCoco(malla, vector(0.14, 0.12, 0.05), vector(0.8, 0.2, 0.3).normalize(), 0.11, true, ruido)
}

function pejibaye(malla, random, ruido) {
  racimoDePejibaye(malla, vector(0, 0.5, 0), random, ruido)
}

export const COSECHAS = {
  banano, yuca, pina, cafe, cana, maiz, frijol, tomate, arroz, papa, chile, cacao, palma,
  naranja, mango, aguacate, papaya, chayote, melon, sandia, coco, pejibaye,
}

