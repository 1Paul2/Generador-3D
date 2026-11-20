import * as THREE from 'three'
import { ARRIBA, CONTORNOS, PERFILES, aclarar, columna, cuerpo, girar, hoja, mezclar, suelo, transicion, vector } from './botanica.js'

// Plantas de hoja ancha: frijol, tomate, papa, chile dulce, cafe y cacao,
// con sus frutos (que tambien se usan solos, como cosecha).

// Direccion que sale hacia "azimut" subiendo "grados" sobre el horizonte.
function haciaAfuera(azimut, grados) {
  const subida = THREE.MathUtils.degToRad(grados)
  return vector(Math.cos(azimut) * Math.cos(subida), Math.sin(subida), Math.sin(azimut) * Math.cos(subida))
}

// Rama o tallo: un tubo que sigue una columna curvada y se afina.
function rama(malla, desde, direccion, largo, curvatura, grosor, color, ruido) {
  const eje = columna(desde, direccion, largo, curvatura, 30)
  malla.tubo(
    Math.max(8, Math.round(largo * 120)),
    8,
    (u) => eje(u).p,
    (u) => grosor * (1 - u * 0.5),
    (u, a, p) => aclarar(color, 0.85 + ruido(p.x * 150, p.y * 150, p.z * 150, 2) * 0.3),
  )
  return eje
}

// ---------- Frijol ----------

const FRIJOL = {
  tallo: [96, 128, 56],
  hoja: [70, 116, 46],
  vieja: [158, 152, 64],
  vaina: [116, 152, 62],
  vainaSeca: [192, 170, 104],
  flor: [232, 220, 240],
}

// Hoja trifoliada del frijol: un peciolo y tres foliolos acuminados, el del
// centro en un peciolulo mas largo.
function trifoliada(malla, nodo, azimut, tamano, colorHoja, random, ruido) {
  const peciolo = rama(malla, nodo, haciaAfuera(azimut, 40 + random() * 20), 0.08 * tamano, 0.7, 0.0016, FRIJOL.tallo, ruido)
  const punta = peciolo(1).p
  const frente = vector(Math.cos(azimut), 0, Math.sin(azimut))
  for (const lado of [-1, 1]) {
    hoja(malla, {
      base: punta,
      direccion: girar(frente, ARRIBA, lado * 1.35).addScaledVector(ARRIBA, -0.15).normalize(),
      largo: 0.075 * tamano,
      ancho: 0.03 * tamano,
      contorno: CONTORNOS.acuminada,
      curvatura: 0.5,
      abolladura: 0.04,
      nervios: 6,
      color: () => colorHoja,
      ruido,
      semilla: random() * 100,
    })
  }
  const centro = punta.clone().addScaledVector(frente, 0.025 * tamano)
  malla.tubo(4, 4, (u) => punta.clone().lerp(centro, u), () => 0.0012, () => FRIJOL.tallo)
  hoja(malla, {
    base: centro,
    direccion: frente.clone().addScaledVector(ARRIBA, 0.1).normalize(),
    largo: 0.09 * tamano,
    ancho: 0.034 * tamano,
    contorno: CONTORNOS.acuminada,
    curvatura: 0.6,
    abolladura: 0.04,
    nervios: 7,
    color: () => colorHoja,
    ruido,
    semilla: random() * 100,
  })
}

// Vaina de frijol: aplanada, un poco curva, con el bulto de cada grano y el
// pico en la punta.
export function vainaDeFrijol(malla, desde, direccion, largo, seca, ruido) {
  const eje = columna(desde, direccion, largo, 0.9, 20)
  const granos = 5
  malla.tubo(
    40,
    14,
    (u) => eje(u).p,
    (u, a) => {
      const grosor = 0.0075 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + u * 1.02)), 0.35)
      const bulto = 1 + 0.18 * Math.pow(Math.abs(Math.sin(u * granos * Math.PI)), 2) * (u < 0.92 ? 1 : 0)
      // Seccion aplanada (elipse).
      const plana = 1 / Math.sqrt(Math.cos(a) ** 2 + (Math.sin(a) / 0.55) ** 2)
      return grosor * bulto * plana * (u > 0.94 ? 0.5 : 1)
    },
    (u, a, p) => {
      const c = seca ? FRIJOL.vainaSeca : FRIJOL.vaina
      return aclarar(c, 0.85 + ruido(p.x * 400, p.y * 400, p.z * 400, 2) * 0.25 + 0.06 * Math.cos(a * 2))
    },
  )
}

// Mata de frijol (de arbusto): un tallo que se ramifica, hojas trifoliadas,
// las vainas colgando y algunas flores blancas.
export function frijol(malla, random, ruido) {
  suelo(malla, 0.4, 0.06, ruido)
  const principal = rama(malla, vector(0, -0.02, 0), haciaAfuera(random() * 6, 80), 0.42, 0.3, 0.005, FRIJOL.tallo, ruido)
  const nodos = []
  for (let r = 0; r < 5; r++) {
    const { p } = principal(0.2 + r * 0.14)
    const eje = rama(malla, p, haciaAfuera(r * 2.39996, 35 + random() * 20), 0.2 + random() * 0.1, 0.6, 0.0035, FRIJOL.tallo, ruido)
    for (let n = 1; n <= 3; n++) nodos.push({ p: eje(n / 3).p, az: r * 2.39996 + n * 1.5 })
  }
  for (let n = 1; n <= 4; n++) nodos.push({ p: principal(n / 4).p, az: n * 2.39996 })

  for (const { p, az } of nodos) {
    const vieja = random() < 0.12
    trifoliada(malla, p, az, 0.85 + random() * 0.4, vieja ? FRIJOL.vieja : mezclar(FRIJOL.hoja, [95, 140, 60], random() * 0.4), random, ruido)
    // Vainas colgando del nodo.
    if (random() < 0.7) {
      for (let v = 0; v < 1 + Math.floor(random() * 3); v++) {
        const dir = vector(Math.cos(az + v), -1.6, Math.sin(az + v)).normalize()
        vainaDeFrijol(malla, p, dir, 0.09 + random() * 0.04, random() < 0.2, ruido)
      }
    } else {
      // Flor blanca.
      flor(malla, p, FRIJOL.flor, 0.008, random, ruido)
    }
  }
}

// ---------- Tomate ----------

const TOMATE = {
  tallo: [98, 132, 58],
  hoja: [60, 104, 42],
  maduro: [205, 38, 28],
  pinton: [228, 120, 40],
  verde: [128, 160, 64],
  madera: [138, 108, 74],
  amarre: [205, 190, 150],
  flor: [245, 205, 40],
}

// Tomate: achatado, con hombros marcados, el caliz verde en estrella y la
// cicatriz del pedunculo. madurez: 0 (verde) a 1 (rojo).
export function frutoDeTomate(malla, centro, radio, madurez, random, ruido) {
  const color = madurez > 0.5 ? mezclar(TOMATE.pinton, TOMATE.maduro, (madurez - 0.5) * 2) : mezclar(TOMATE.verde, TOMATE.pinton, madurez * 2)
  cuerpo(
    malla,
    centro.clone().addScaledVector(ARRIBA, -radio * 0.82),
    centro.clone().addScaledVector(ARRIBA, radio * 0.82),
    radio,
    PERFILES.esfera,
    (u, a, p) => {
      let c = aclarar(color, 0.88 + ruido(p.x * 300, p.y * 300, p.z * 300, 2) * 0.18)
      // Hombros mas verdes en los que no estan del todo maduros, y el brillo de la piel.
      c = mezclar(c, TOMATE.verde, transicion(0.75, 1, u) * (1 - madurez) * 0.6)
      return aclarar(c, 1 + 0.15 * transicion(0.55, 0.75, u) * (1 - transicion(0.75, 0.9, u)))
    },
    { forma: (u, a) => 1 + 0.045 * Math.cos(a * 5) * transicion(0.45, 0.95, u) - 0.25 * transicion(0.93, 1, u), nu: 26, nv: 30 },
  )
  // Caliz: cinco sepalos finos que se abren desde arriba.
  const tope = centro.clone().addScaledVector(ARRIBA, radio * 0.8)
  for (let s = 0; s < 5; s++) {
    hoja(malla, {
      base: tope,
      direccion: haciaAfuera(s * 1.2566 + random(), 15),
      largo: radio * 0.9,
      ancho: radio * 0.16,
      curvatura: 1.6,
      pliegue: 0.3,
      nervios: 2,
      color: () => [70, 112, 46],
      ruido,
      nu: 8,
      nv: 4,
    })
  }
  return tope
}

// Hoja compuesta del tomate: foliolos opuestos rugosos y dentados, con
// foliolos chiquitos entre ellos, y uno en la punta.
function hojaDeTomate(malla, nodo, azimut, tamano, random, ruido) {
  const raquis = rama(malla, nodo, haciaAfuera(azimut, 30 + random() * 15), 0.24 * tamano, 0.9, 0.0022, TOMATE.tallo, ruido)
  const colorHoja = mezclar(TOMATE.hoja, [85, 128, 52], random() * 0.4)
  const pares = [0.3, 0.52, 0.74]
  for (const t of [...pares, 0.42, 0.63]) {
    const chico = !pares.includes(t)
    const { p, tangente } = raquis(t)
    for (const lado of [-1, 1]) {
      hoja(malla, {
        base: p,
        direccion: girar(tangente, ARRIBA, lado * 1.1).addScaledVector(ARRIBA, -0.1).normalize(),
        largo: (chico ? 0.022 : 0.065) * tamano,
        ancho: (chico ? 0.01 : 0.03) * tamano,
        contorno: CONTORNOS.ovada,
        curvatura: 0.5,
        abolladura: 0.09,
        onda: 0.05,
        dientes: 9,
        nervios: 5,
        color: () => colorHoja,
        ruido,
        semilla: random() * 100,
        nu: chico ? 8 : 18,
        nv: chico ? 4 : 8,
      })
    }
  }
  const { p, tangente } = raquis(1)
  hoja(malla, {
    base: p,
    direccion: tangente,
    largo: 0.07 * tamano,
    ancho: 0.032 * tamano,
    contorno: CONTORNOS.ovada,
    curvatura: 0.5,
    abolladura: 0.09,
    onda: 0.05,
    dientes: 9,
    nervios: 5,
    color: () => colorHoja,
    ruido,
    semilla: random() * 100,
  })
}

// Mata de tomate tutorada: el tallo en zigzag amarrado a una estaca de
// madera, las hojas compuestas y los racimos de tomates, maduros abajo y
// verdes arriba, con flores amarillas en el racimo mas nuevo.
export function tomate(malla, random, ruido) {
  suelo(malla, 0.45, 0.07, ruido)
  // Estaca de madera de seccion cuadrada, con la veta a lo largo.
  const estaca = vector(0.07, 0, 0)
  malla.tubo(
    40,
    16,
    (u) => vector(estaca.x, -0.05 + u * 1.75, estaca.z),
    (u, a) => (0.018 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)))) * 0.85 * (u > 0.99 ? 0.6 : 1),
    (u, a, p) => aclarar(TOMATE.madera, 0.75 + ruido(p.x * 60, p.y * 3, p.z * 60, 3) * 0.45),
  )
  const alto = 1.55
  const tallo = (u) => vector(Math.sin(u * 9) * 0.018, -0.02 + u * alto, Math.cos(u * 7) * 0.018)
  malla.tubo(
    150,
    10,
    tallo,
    (u) => 0.008 * (1 - u * 0.5),
    (u, a, p) => aclarar(TOMATE.tallo, 0.85 + ruido(p.x * 600, p.y * 600, p.z * 600, 2) * 0.3),
  )
  // Amarres de pita entre el tallo y la estaca.
  for (const y of [0.35, 0.75, 1.15]) {
    const u = y / alto
    const centroAmarre = tallo(u).lerp(vector(estaca.x, y, 0), 0.5)
    malla.tubo(
      30,
      5,
      (s) => centroAmarre.clone().add(vector(Math.cos(s * Math.PI * 2) * 0.05, Math.sin(s * 9) * 0.003, Math.sin(s * Math.PI * 2) * 0.025)),
      () => 0.0015,
      () => TOMATE.amarre,
    )
  }

  // Hojas alternas cada pocos centimetros.
  let azimut = random() * 6
  for (let y = 0.1; y < alto - 0.05; y += 0.1) {
    azimut += 2.39996
    hojaDeTomate(malla, tallo(y / alto), azimut, 1.7 - (y / alto) * 0.6, random, ruido)
  }

  // Racimos: los de abajo maduros, los de arriba verdes; el ultimo en flor.
  const racimos = [0.3, 0.55, 0.8, 1.05, 1.32]
  racimos.forEach((y, r) => {
    const az = r * 2.6 + 1
    const desde = tallo(y / alto)
    const eje = rama(malla, desde, haciaAfuera(az, 10), 0.2, 1.6, 0.0025, TOMATE.tallo, ruido)
    const ultimo = r === racimos.length - 1
    const frutos = ultimo ? 0 : 3 + Math.floor(random() * 3)
    for (let f = 0; f < frutos; f++) {
      const { p } = eje(0.25 + f * 0.19)
      const radio = 0.022 + random() * 0.008
      const madurez = Math.min(1, Math.max(0, 1 - r * 0.32 + (random() - 0.5) * 0.3))
      const costado = vector(Math.cos(az + f * 2.2), 0, Math.sin(az + f * 2.2)).multiplyScalar(radio * 0.9)
      const centro = p.clone().addScaledVector(ARRIBA, -radio * 1.2).add(costado)
      frutoDeTomate(malla, centro, radio, madurez, random, ruido)
    }
    if (ultimo) {
      for (let f = 0; f < 5; f++) flor(malla, eje(0.2 + f * 0.18).p, TOMATE.flor, 0.012, random, ruido)
    }
  })
}

// Flor chica de cinco petalos en estrella con el centro en cono.
function flor(malla, centro, color, tamano, random, ruido) {
  for (let s = 0; s < 5; s++) {
    hoja(malla, {
      base: centro,
      direccion: haciaAfuera(s * 1.2566 + random(), -40),
      largo: tamano,
      ancho: tamano * 0.3,
      curvatura: -0.8,
      pliegue: 0,
      nervios: 1,
      color: () => color,
      ruido,
      nu: 6,
      nv: 3,
    })
  }
  cuerpo(malla, centro, centro.clone().addScaledVector(ARRIBA, -tamano * 0.8), tamano * 0.18, (u) => 1 - u, () => [235, 200, 40], { nu: 4, nv: 6 })
}

// ---------- Papa ----------

const PAPA = {
  tallo: [92, 118, 54],
  hoja: [62, 100, 46],
  piel: [184, 148, 104],
  ojo: [120, 88, 60],
  flor: [196, 170, 225],
}

// Papa (tuberculo): un ovoide irregular, con bultos, los ojos hundidos en
// espiral, la piel con pecas y restos de tierra.
export function tuberculoDePapa(malla, centro, eje, tamano, random, ruido) {
  const semilla = random() * 100
  const ojos = 9
  cuerpo(
    malla,
    centro.clone().addScaledVector(eje, -tamano * 0.6),
    centro.clone().addScaledVector(eje, tamano * 0.6),
    tamano * 0.42,
    PERFILES.huevo,
    (u, a, p) => {
      let c = aclarar(PAPA.piel, 0.82 + ruido(p.x * 400 + semilla, p.y * 400, p.z * 400, 3) * 0.28)
      c = mezclar(c, [110, 82, 58], transicion(0.62, 0.7, ruido(p.x * 50 + semilla, p.y * 50, p.z * 50, 3)) * 0.6)
      const ojo = cercaDeOjo(u, a, ojos)
      return mezclar(c, PAPA.ojo, ojo * 0.8)
    },
    {
      forma: (u, a) =>
        0.88 + 0.24 * ruido(Math.cos(a) * 1.5 + semilla, u * 2.5, Math.sin(a) * 1.5, 3) - 0.08 * cercaDeOjo(u, a, ojos),
      nu: 40,
      nv: 40,
    },
  )
}

// Cuanto esta un punto dentro de uno de los ojos de la papa (0 a 1).
function cercaDeOjo(u, a, ojos) {
  let cerca = 0
  for (let o = 0; o < ojos; o++) {
    const uo = 0.12 + (o / ojos) * 0.82
    const ao = o * 2.39996
    const d = Math.hypot((u - uo) * 3, Math.atan2(Math.sin(a - ao), Math.cos(a - ao)) * 0.5)
    cerca = Math.max(cerca, Math.max(0, 1 - d / 0.08))
  }
  return cerca
}

// Mata de papa aporcada: varios tallos, hojas compuestas (foliolos grandes
// alternando con chiquitos), racimos de flores lilas con el centro amarillo
// y algunas papas que asoman del monticulo de tierra.
export function papa(malla, random, ruido) {
  suelo(malla, 0.42, 0.1, ruido)
  for (let s = 0; s < 4; s++) {
    const az = s * 1.57 + random()
    const tallo = rama(malla, vector(Math.cos(az) * 0.04, 0.1, Math.sin(az) * 0.04), haciaAfuera(az, 65), 0.5, 0.5, 0.006, PAPA.tallo, ruido)
    for (let h = 0; h < 6; h++) {
      const t = 0.15 + h * 0.14
      const raquis = rama(malla, tallo(t).p, haciaAfuera(az + h * 2.39996, 30), 0.17, 0.8, 0.0018, PAPA.tallo, ruido)
      for (let f = 0; f < 4; f++) {
        const { p, tangente } = raquis(0.25 + f * 0.2)
        const grande = f % 2 === 0
        for (const lado of [-1, 1]) {
          hoja(malla, {
            base: p,
            direccion: girar(tangente, ARRIBA, lado * 1.2),
            largo: grande ? 0.055 : 0.018,
            ancho: grande ? 0.028 : 0.01,
            contorno: CONTORNOS.ovada,
            curvatura: 0.5,
            abolladura: 0.07,
            nervios: 5,
            color: () => PAPA.hoja,
            ruido,
            semilla: random() * 100,
            nu: grande ? 16 : 8,
            nv: grande ? 8 : 4,
          })
        }
      }
      const { p, tangente } = raquis(1)
      hoja(malla, { base: p, direccion: tangente, largo: 0.06, ancho: 0.03, contorno: CONTORNOS.ovada, abolladura: 0.07, color: () => PAPA.hoja, ruido })
    }
    // Racimo de flores en la punta del tallo.
    const tope = tallo(1).p
    for (let f = 0; f < 5; f++) {
      const p = tope.clone().add(vector(Math.cos(f * 1.3) * 0.03, 0.02 + random() * 0.03, Math.sin(f * 1.3) * 0.03))
      flor(malla, p, mezclar(PAPA.flor, [245, 245, 240], random() * 0.5), 0.016, random, ruido)
    }
  }
  // Papas asomando del monticulo.
  for (let t = 0; t < 3; t++) {
    const az = t * 2.2 + random()
    const r = 0.18 + random() * 0.08
    const y = 0.1 * (1 - (r / 0.42) ** 2) - 0.01
    tuberculoDePapa(malla, vector(Math.cos(az) * r, y, Math.sin(az) * r), vector(Math.cos(az + 1.5), 0.2, Math.sin(az + 1.5)).normalize(), 0.08, random, ruido)
  }
}

// ---------- Chile dulce ----------

const CHILE = {
  tallo: [90, 124, 54],
  hoja: [38, 92, 34],
  rojo: [182, 24, 20],
  verde: [52, 110, 34],
  flor: [245, 245, 235],
}

// Chile dulce (pimiento): cuadrado, con tres o cuatro lobulos abajo, la piel
// brillante y el pedunculo grueso con su caliz.
export function frutoDeChile(malla, punta, largo, maduro, random, ruido) {
  const color = maduro ? CHILE.rojo : CHILE.verde
  const lobulos = random() < 0.5 ? 3 : 4
  const fondo = punta.clone().addScaledVector(ARRIBA, -largo)
  cuerpo(
    malla,
    fondo,
    punta,
    largo * 0.45,
    (u) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + u * 0.94)), 0.2) * (0.88 + 0.12 * u),
    (u, a, p) => {
      const lobulo = Math.cos(a * lobulos)
      let c = aclarar(color, 0.85 + ruido(p.x * 300, p.y * 300, p.z * 300, 2) * 0.15 + 0.12 * lobulo)
      // Reflejo de la piel encerada a lo largo de cada lobulo.
      return aclarar(c, 1 + 0.25 * Math.pow(Math.max(0, lobulo), 8) * Math.sin(Math.PI * u))
    },
    {
      // Lobulos marcados, mas abajo (las puntas del fondo), y los hombros planos arriba.
      forma: (u, a) => (1 + 0.16 * Math.cos(a * lobulos) * (0.5 + 0.5 * (1 - u))) * (1 - 0.35 * transicion(0.88, 1, u)),
      nu: 30,
      nv: 36,
    },
  )
  // Pedunculo con su caliz.
  malla.tubo(10, 8, (u) => punta.clone().addScaledVector(ARRIBA, -largo * 0.08 + u * largo * 0.35), (u) => 0.006 * (1 + (1 - u) * 0.8), () => [70, 110, 50])
}

// Mata de chile dulce: tallo que se bifurca una y otra vez, hojas elipticas
// brillantes de un verde oscuro, chiles colgando de las horquetas y flores blancas.
export function chile(malla, random, ruido) {
  suelo(malla, 0.4, 0.06, ruido)
  const horquetas = []
  function crecer(desde, dir, largo, grosor, nivel) {
    const eje = rama(malla, desde, dir, largo, 0.2, grosor, CHILE.tallo, ruido)
    const fin = eje(1).p
    horquetas.push(fin)
    if (nivel === 0) return
    const giro = random() * Math.PI
    for (const lado of [-1, 1]) {
      const nueva = haciaAfuera(giro + (lado > 0 ? 0 : Math.PI), 55 + random() * 15)
      crecer(fin, nueva, largo * 0.78, grosor * 0.72, nivel - 1)
    }
  }
  crecer(vector(0, -0.02, 0), ARRIBA.clone(), 0.22, 0.009, 4)
  horquetas.forEach((p, i) => {
    for (let h = 0; h < 3; h++) {
      hoja(malla, {
        base: p,
        direccion: haciaAfuera(i * 2.39996 + h * 2.1, 10 + random() * 25),
        largo: 0.09 + random() * 0.04,
        ancho: 0.04,
        contorno: CONTORNOS.eliptica,
        curvatura: 0.9,
        onda: 0.04,
        nervios: 6,
        color: () => mezclar(CHILE.hoja, [70, 120, 50], random() * 0.3),
        ruido,
        semilla: random() * 100,
      })
    }
    if (i > 4 && random() < 0.35) frutoDeChile(malla, p.clone().addScaledVector(ARRIBA, -0.012), 0.075 + random() * 0.025, random() < 0.65, random, ruido)
    else if (random() < 0.3) flor(malla, p, CHILE.flor, 0.01, random, ruido)
  })
}

// ---------- Cafe ----------

const CAFE = {
  tallo: [118, 104, 84],
  bandola: [104, 112, 72],
  hoja: [32, 82, 34],
  hojaNueva: [98, 120, 52],
  verde: [112, 152, 50],
  amarillo: [214, 178, 46],
  rojo: [168, 18, 30],
  vino: [92, 18, 30],
}

// Grano (cereza) de cafe: un ovoide chico con el ombligo oscuro en la
// punta. madurez: 0 (verde), 0.5 (amarillo), 0.8 (rojo) y 1 (vino).
export function cerezaDeCafe(malla, centro, eje, radio, madurez, ruido) {
  const color =
    madurez < 0.5
      ? mezclar(CAFE.verde, CAFE.amarillo, madurez * 2)
      : madurez < 0.8
        ? mezclar(CAFE.amarillo, CAFE.rojo, (madurez - 0.5) / 0.3)
        : mezclar(CAFE.rojo, CAFE.vino, (madurez - 0.8) / 0.2)
  cuerpo(
    malla,
    centro.clone().addScaledVector(eje, -radio * 1.15),
    centro.clone().addScaledVector(eje, radio * 1.15),
    radio,
    PERFILES.esfera,
    (u, a, p) => {
      let c = aclarar(color, 0.85 + ruido(p.x * 900, p.y * 900, p.z * 900, 1) * 0.2)
      c = aclarar(c, 1 + 0.2 * transicion(0.55, 0.7, u) * (1 - transicion(0.7, 0.85, u)))
      return mezclar(c, [60, 40, 30], transicion(0.93, 0.98, u))
    },
    { nu: 9, nv: 9 },
  )
}

// Cafeto: un tallo recto con pares de bandolas (ramas horizontales) que se
// cruzan en cada piso; en cada nudo un par de hojas opuestas brillantes con
// el borde ondulado, y en los nudos viejos los racimos de granos apretados
// contra la rama, maduros (rojos) y pintones.
export function cafe(malla, random, ruido) {
  suelo(malla, 0.6, 0.08, ruido)
  const alto = 1.7
  const tallo = (u) => vector((ruido(u * 3, 1, 1, 2) - 0.5) * 0.06, -0.02 + u * alto, (ruido(u * 3, 5, 1, 2) - 0.5) * 0.06)
  malla.tubo(
    120,
    12,
    tallo,
    (u) => 0.018 * (1 - u * 0.7),
    (u, a, p) => mezclar(aclarar(CAFE.tallo, 0.8 + ruido(p.x * 80, p.y * 20, p.z * 80, 3) * 0.4), [80, 110, 60], transicion(0.8, 1, u)),
  )
  const pisos = 14
  for (let k = 0; k < pisos; k++) {
    const t = k / pisos
    const y = 0.25 + t * (alto - 0.32)
    const desde = tallo(y / alto)
    for (const lado of [0, Math.PI]) {
      const az = (k * Math.PI) / 2 + lado + (random() - 0.5) * 0.3
      const largo = 0.75 * (1 - t * 0.8) + 0.1
      const bandola = rama(malla, desde, haciaAfuera(az, 12 - t * 10), largo, 0.6, 0.006 * (1 - t * 0.5), CAFE.bandola, ruido)
      const nudos = Math.max(2, Math.floor(largo / 0.06))
      for (let n = 1; n <= nudos; n++) {
        const s = n / nudos
        const { p, tangente } = bandola(s)
        const lateral = tangente.clone().cross(ARRIBA).normalize()
        // Par de hojas opuestas; las de la punta son nuevas y mas claras.
        for (const signo of [-1, 1]) {
          hoja(malla, {
            base: p,
            direccion: girar(lateral.clone().multiplyScalar(signo), tangente, (random() - 0.5) * 1.4)
              .addScaledVector(tangente, 0.2 + random() * 0.5)
              .addScaledVector(ARRIBA, -0.15)
              .normalize(),
            largo: 0.14 + random() * 0.04 - s * 0.03,
            ancho: 0.05,
            contorno: CONTORNOS.acuminada,
            curvatura: 1.2 + random() * 0.5,
            giro: (random() - 0.5) * 0.8,
            pliegue: 0.18,
            onda: 0.1,
            abolladura: 0.05,
            nervios: 9,
            color: () => mezclar(CAFE.hoja, CAFE.hojaNueva, transicion(0.85, 1, s) * 0.6),
            ruido,
            semilla: random() * 100,
          })
        }
        // Racimo de granos en los nudos de la mitad vieja de la bandola.
        if (s < 0.65 && random() < 0.75) {
          const granos = 5 + Math.floor(random() * 7)
          for (let g = 0; g < granos; g++) {
            const ang = (g / granos) * Math.PI * 2
            const fuera = lateral.clone().applyAxisAngle(tangente, ang)
            const centro = p.clone().addScaledVector(fuera, 0.013).addScaledVector(tangente, (random() - 0.5) * 0.014).addScaledVector(ARRIBA, -0.006)
            const madurez = Math.min(1, Math.max(0, 0.75 - s * 0.6 + (random() - 0.4) * 0.5))
            cerezaDeCafe(malla, centro, tangente, 0.0085, madurez, ruido)
          }
        }
      }
    }
  }
}

// ---------- Cacao ----------

const CACAO = {
  corteza: [112, 100, 86],
  liquen: [178, 182, 160],
  hoja: [44, 88, 38],
  brote: [178, 98, 92],
  seca: [128, 92, 56],
  amarillo: [214, 168, 42],
  rojo: [150, 42, 40],
}

// Mazorca de cacao: alargada y en punta, con diez costillas (cinco marcadas
// y cinco suaves), la superficie verrugosa y el color que pasa del verde
// del pedunculo al amarillo o rojo.
export function mazorcaDeCacao(malla, desde, direccion, largo, rojiza, ruido) {
  const color = rojiza ? CACAO.rojo : CACAO.amarillo
  const hasta = desde.clone().addScaledVector(direccion, largo)
  cuerpo(
    malla,
    desde,
    hasta,
    largo * 0.24,
    (u) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + u * 0.96)), 0.65) * (1 - 0.22 * u),
    (u, a, p) => {
      const costilla = Math.abs(Math.cos(a * 5))
      let c = aclarar(color, 0.75 + costilla * 0.3 + ruido(p.x * 200, p.y * 200, p.z * 200, 3) * 0.15)
      c = mezclar(c, [110, 140, 50], (1 - transicion(0, 0.25, u)) * 0.7)
      return mezclar(c, [90, 60, 30], transicion(0.62, 0.7, ruido(p.x * 40, p.y * 40, p.z * 40, 3)) * 0.4)
    },
    {
      forma: (u, a) => 1 + 0.08 * Math.abs(Math.cos(a * 5)) + 0.02 * Math.abs(Math.cos(a * 10)) - 0.03 * transicion(0.97, 1, u),
      nu: 40,
      nv: 40,
    },
  )
  // Pedunculo lenoso.
  malla.tubo(6, 8, (u) => desde.clone().addScaledVector(direccion, -0.04 + u * 0.05), () => 0.008, () => [100, 90, 60])
}

// Arbol de cacao: tronco bajo que se abre en la horqueta en cuatro ramas,
// hojas grandes y caidas (las nuevas rojizas y lacias), mazorcas que nacen
// directo del tronco y de las ramas gruesas, y hojarasca en el suelo.
export function cacao(malla, random, ruido) {
  suelo(malla, 0.9, 0.08, ruido)
  // Hojarasca.
  for (let h = 0; h < 40; h++) {
    const az = random() * Math.PI * 2
    const r = 0.15 + random() * 0.7
    hoja(malla, {
      base: vector(Math.cos(az) * r, 0.02 + 0.08 * (1 - (r / 0.9) ** 2), Math.sin(az) * r),
      direccion: haciaAfuera(random() * 6, 0),
      largo: 0.2,
      ancho: 0.06,
      contorno: CONTORNOS.acuminada,
      curvatura: 0.1,
      giro: (random() - 0.5) * 0.6,
      color: () => aclarar(CACAO.seca, 0.75 + random() * 0.4),
      ruido,
      nu: 10,
      nv: 4,
    })
  }
  const colorCorteza = (u, a, p) => {
    const c = aclarar(CACAO.corteza, 0.78 + ruido(p.x * 40, p.y * 10, p.z * 40, 3) * 0.4)
    return mezclar(c, CACAO.liquen, transicion(0.62, 0.68, ruido(p.x * 20, p.y * 20, p.z * 20, 3)) * 0.7)
  }
  const altoTronco = 1.3
  const tronco = (u) => vector((ruido(u * 2, 3, 3, 2) - 0.5) * 0.15, -0.03 + u * altoTronco, (ruido(u * 2, 7, 3, 2) - 0.5) * 0.15)
  malla.tubo(60, 24, tronco, (u) => 0.075 * (1 - u * 0.25) + 0.03 * Math.exp(-u * 15), colorCorteza)
  // Mazorcas en el tronco.
  for (let m = 0; m < 3; m++) {
    const az = m * 2.3 + random()
    const p = tronco(0.35 + m * 0.18).add(vector(Math.cos(az) * 0.07, 0, Math.sin(az) * 0.07))
    mazorcaDeCacao(malla, p, vector(Math.cos(az) * 0.4, -1, Math.sin(az) * 0.4).normalize(), 0.18 + random() * 0.05, random() < 0.4, ruido)
  }

  const horqueta = tronco(1)
  for (let r = 0; r < 4; r++) {
    const az = r * 1.57 + random() * 0.5
    const eje = columna(horqueta, haciaAfuera(az, 50), 1.5, 0.7, 30)
    malla.tubo(60, 14, (u) => eje(u).p, (u) => 0.045 * (1 - u * 0.75), colorCorteza)
    if (random() < 0.6) {
      const { p, tangente } = eje(0.25)
      mazorcaDeCacao(malla, p.clone().addScaledVector(tangente.clone().cross(ARRIBA).normalize(), 0.04), vector(0, -1, 0), 0.2, random() < 0.4, ruido)
    }
    // Ramas secundarias con las hojas en las puntas.
    for (let s = 0; s < 3; s++) {
      const { p } = eje(0.45 + s * 0.22)
      const dir = haciaAfuera(az + (s - 1) * 0.9, 15 + random() * 20)
      const secundaria = rama(malla, p, dir, 0.6, 0.6, 0.015, CACAO.corteza, ruido)
      for (let h = 0; h < 14; h++) {
        const t = 0.12 + h * 0.065
        const { p: nodo, tangente } = secundaria(Math.min(1, t))
        const brote = h > 12 && random() < 0.35
        hoja(malla, {
          base: nodo,
          direccion: girar(tangente.clone().cross(ARRIBA).normalize().multiplyScalar(h % 2 ? 1 : -1), tangente, (random() - 0.5) * 1.2)
            .addScaledVector(tangente, 0.3)
            .addScaledVector(ARRIBA, -0.5)
            .normalize(),
          largo: brote ? 0.16 : 0.26 + random() * 0.1,
          ancho: 0.085,
          contorno: CONTORNOS.acuminada,
          curvatura: brote ? 2.2 : 1.2 + random() * 0.6,
          giro: (random() - 0.5) * 1.2,
          pliegue: 0.08,
          nervios: 10,
          abolladura: 0.03,
          color: () => (brote ? CACAO.brote : mezclar(CACAO.hoja, [70, 110, 50], random() * 0.3)),
          ruido,
          semilla: random() * 100,
        })
      }
    }
  }
}
