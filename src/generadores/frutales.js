import * as THREE from 'three'
import { ARRIBA, CONTORNOS, PERFILES, aclarar, celdas, columna, cuerpo, girar, hoja, hojaLarga, mezclar, suelo, transicion, vector } from './botanica.js'

// Frutales y hortalizas de Costa Rica que no son arboles de ramas: la papaya,
// el chayote en su ramada, el melon y la sandia en el suelo, y las palmas de
// coco y de pejibaye; y los frutos de cada uno (tambien los de la naranja, el
// mango y el aguacate), que se usan en la planta y solos, como cosecha.

// Direccion que sale hacia "azimut" subiendo "grados" sobre el horizonte.
function haciaAfuera(azimut, grados) {
  const subida = THREE.MathUtils.degToRad(grados)
  return vector(Math.cos(azimut) * Math.cos(subida), Math.sin(subida), Math.sin(azimut) * Math.cos(subida))
}

// ---------- Frutos ----------

// Naranja: esferica, con la cascara llena de poros (las glandulas de aceite),
// el ombligo abajo y el pedunculo arriba; las de Costa Rica suelen estar
// verdes o pintonas aunque esten maduras.
export function frutoDeNaranja(malla, centro, radio, random, ruido, limon = false) {
  const color = limon ? [92, 150, 50] : mezclar([236, 148, 30], [150, 168, 52], random() * 0.6)
  const semilla = random() * 100
  cuerpo(
    malla,
    centro.clone().addScaledVector(ARRIBA, -radio),
    centro.clone().addScaledVector(ARRIBA, radio * (limon ? 1.15 : 0.96)),
    radio,
    PERFILES.esfera,
    (u, a, p) => {
      const poro = ruido(p.x * 900 + semilla, p.y * 900, p.z * 900, 1)
      let c = aclarar(color, 0.9 + (poro - 0.5) * 0.25 + ruido(p.x * 60, p.y * 60, p.z * 60, 2) * 0.12)
      return mezclar(c, [90, 100, 50], transicion(0.94, 0.99, u))
    },
    { forma: (u, a) => 1 - 0.012 * ruido(Math.cos(a) * 40 + semilla, u * 40, Math.sin(a) * 40, 1), nu: 26, nv: 30 },
  )
}

// Mango: ovalado y un poco aplanado, con el "pico" de un lado, verde con el
// rubor rojo y amarillo donde le dio el sol, y puntitos claros (lenticelas).
export function frutoDeMango(malla, tope, largo, random, ruido) {
  const fondo = tope.clone().addScaledVector(ARRIBA, -largo)
  cuerpo(
    malla,
    fondo,
    tope,
    largo * 0.36,
    (u) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.03 + u * 0.97)), 0.6) * (0.85 + 0.15 * u),
    (u, a, p) => {
      const sol = transicion(-0.2, 0.8, Math.cos(a) + u * 0.4)
      let c = mezclar([110, 150, 50], mezclar([235, 175, 40], [200, 50, 40], transicion(0.4, 0.9, sol)), sol)
      c = aclarar(c, 0.9 + ruido(p.x * 200, p.y * 200, p.z * 200, 2) * 0.15)
      return ruido(p.x * 700, p.y * 700, p.z * 700, 1) > 0.82 ? aclarar(c, 1.2) : c
    },
    {
      // Aplanado de costado y con el pico abajo hacia un lado.
      forma: (u, a) => (1 / Math.sqrt(Math.cos(a) ** 2 + (Math.sin(a) / 0.82) ** 2)) * (1 + 0.15 * Math.cos(a) * (1 - transicion(0, 0.35, u))),
      nu: 30,
      nv: 30,
    },
  )
}

// Aguacate: en forma de pera, la cascara verde oscura y granulada.
export function frutoDeAguacate(malla, tope, largo, random, ruido) {
  cuerpo(
    malla,
    tope.clone().addScaledVector(ARRIBA, -largo * 1.6),
    tope,
    largo * 0.48,
    (u) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.02 + u * 0.98)), 0.6) * (1.15 - 0.55 * transicion(0.3, 0.9, u)),
    (u, a, p) => aclarar([44, 76, 32], 0.82 + ruido(p.x * 500, p.y * 500, p.z * 500, 2) * 0.3),
    { forma: (u, a) => 1 + 0.015 * ruido(Math.cos(a) * 30, u * 30, Math.sin(a) * 30, 2), nu: 30, nv: 28 },
  )
}

// Papaya: alargada, con cinco costillas suaves, verde que se pone amarilla y
// naranja de la punta hacia el pedunculo.
export function frutoDePapaya(malla, desde, direccion, largo, madurez, ruido) {
  cuerpo(
    malla,
    desde,
    desde.clone().addScaledVector(direccion, largo),
    largo * 0.28,
    (u) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.03 + u * 0.97)), 0.5) * (0.75 + 0.25 * transicion(0, 0.6, u)),
    (u, a, p) => {
      let c = mezclar([70, 120, 40], [240, 160, 40], transicion(1 - madurez, 1.2 - madurez * 0.6, u))
      c = aclarar(c, 0.88 + ruido(p.x * 200, p.y * 200, p.z * 200, 2) * 0.18 + 0.05 * Math.cos(a * 5))
      return mezclar(c, [90, 110, 50], transicion(0.97, 1, u))
    },
    { forma: (u, a) => 1 + 0.05 * Math.cos(a * 5), nu: 30, nv: 30 },
  )
}

// Chayote: en forma de pera arrugada, con surcos a lo largo, verde palido y
// algunas espinitas blandas.
export function frutoDeChayote(malla, tope, largo, random, ruido) {
  cuerpo(
    malla,
    tope.clone().addScaledVector(ARRIBA, -largo),
    tope,
    largo * 0.42,
    (u) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + u * 0.96)), 0.55) * (1.1 - 0.4 * transicion(0.4, 1, u)),
    (u, a, p) => {
      const surco = Math.pow(Math.abs(Math.cos(a * 2.5)), 6)
      let c = aclarar([168, 200, 110], 0.88 + ruido(p.x * 300, p.y * 300, p.z * 300, 2) * 0.15)
      return aclarar(c, 1 - 0.18 * surco)
    },
    {
      // Cinco lomos y los pliegues de la base (la "boca" del chayote).
      forma: (u, a) => 1 - 0.1 * Math.pow(Math.abs(Math.cos(a * 2.5)), 6) - 0.12 * (1 - transicion(0, 0.15, u)) * Math.abs(Math.sin(a * 3)),
      nu: 30,
      nv: 40,
    },
  )
}

// Melon (cantalupo): esferico, con la red de corcho clara sobre la cascara
// verde amarillenta; la sandia: verde oscura con franjas claras.
export function frutoDeMelon(malla, centro, radio, sandia, random, ruido) {
  const semilla = random() * 100
  cuerpo(
    malla,
    centro.clone().addScaledVector(ARRIBA, -radio * (sandia ? 0.85 : 0.95)),
    centro.clone().addScaledVector(ARRIBA, radio * (sandia ? 0.85 : 0.95)),
    radio,
    PERFILES.esfera,
    (u, a, p) => {
      if (sandia) {
        const franja = transicion(0.4, 0.6, Math.sin(a * 9 + ruido(p.x * 12 + semilla, p.y * 12, p.z * 12, 3) * 4))
        const c = mezclar([40, 80, 34], [120, 160, 80], franja * 0.7)
        // Mancha amarilla donde se apoyo en el suelo.
        return mezclar(aclarar(c, 0.9 + ruido(p.x * 200, p.y * 200, p.z * 200, 2) * 0.15), [220, 200, 100], (1 - transicion(0, 0.12, u)) * 0.8)
      }
      // La red: lineas claras entre celdas irregulares.
      const { d1, d2 } = celdas(u, a + ruido(p.x * 8, p.y * 8, p.z * 8, 2), 220, radio * 2, radio)
      const red = 1 - transicion(0, 0.006, d2 - d1)
      const c = aclarar([168, 172, 92], 0.85 + ruido(p.x * 100, p.y * 100, p.z * 100, 2) * 0.2)
      return mezclar(c, [222, 210, 170], red * 0.85)
    },
    { forma: (u, a) => (sandia ? 1.12 : 1) * (1 + (sandia ? 0 : 0.012 * Math.cos(a * 10))), nu: sandia ? 30 : 70, nv: sandia ? 36 : 90 },
  )
}

// Coco: con su cascara verde (o amarilla), de tres caras, y el casquete
// donde se une al racimo.
export function frutoDeCoco(malla, centro, eje, radio, maduro, ruido) {
  cuerpo(
    malla,
    centro.clone().addScaledVector(eje, -radio * 1.1),
    centro.clone().addScaledVector(eje, radio * 1.1),
    radio,
    PERFILES.huevo,
    (u, a, p) => {
      let c = maduro ? [190, 150, 60] : [96, 132, 46]
      c = aclarar(c, 0.88 + ruido(p.x * 150, p.y * 150, p.z * 150, 2) * 0.15 + 0.06 * Math.cos(a * 3))
      return mezclar(c, [120, 90, 50], transicion(0.88, 0.95, u))
    },
    { forma: (u, a) => 1 + 0.05 * Math.cos(a * 3), nu: 20, nv: 24 },
  )
}

// ---------- Papaya ----------

// Mata de papaya: un tallo sin ramas con las cicatrices de las hojas caidas,
// la corona de hojas palmeadas enormes en peciolos largos y huecos, y las
// papayas pegadas al tallo debajo de las hojas.
export function papaya(malla, random, ruido) {
  suelo(malla, 0.6, 0.08, ruido)
  const alto = 2.4
  const tallo = (u) => vector(Math.sin(u * 2) * 0.05, -0.03 + u * alto, 0)
  malla.tubo(
    120,
    20,
    tallo,
    (u, a) => {
      const f = (u * 40) % 1
      const cicatriz = Math.exp(-((f - 0.5) ** 2) / 0.02) * Math.max(0, Math.cos(a - u * 40 * 2.39996)) ** 4
      return 0.09 * (1 - u * 0.45) + 0.012 * cicatriz
    },
    (u, a, p) => {
      const f = (u * 40) % 1
      let c = aclarar([140, 140, 112], 0.82 + ruido(p.x * 60, p.y * 20, p.z * 60, 3) * 0.35)
      c = mezclar(c, [90, 80, 60], Math.exp(-((f - 0.5) ** 2) / 0.01) * Math.max(0, Math.cos(a - u * 40 * 2.39996)) ** 6 * 0.8)
      return mezclar(c, [120, 140, 70], transicion(0.8, 0.95, u))
    },
  )
  const tope = tallo(1)
  // Hojas: peciolo largo y la lamina con siete lobulos profundos.
  for (let h = 0; h < 18; h++) {
    const edad = 1 - h / 17
    const az = h * 2.39996
    const peciolo = columna(tope.clone().addScaledVector(ARRIBA, -0.25 * edad), haciaAfuera(az, 70 - edad * 55), 0.7, 0.6 + edad * 0.6, 16)
    malla.tubo(16, 6, (u) => peciolo(u).p, () => 0.008, () => mezclar([150, 170, 90], [200, 180, 100], edad * 0.5))
    const centro = peciolo(1)
    const color = mezclar([60, 110, 42], [170, 160, 60], edad > 0.85 ? 0.7 : 0)
    for (let l = 0; l < 7; l++) {
      const giro = (l / 6 - 0.5) * 3.4
      hoja(malla, {
        base: centro.p,
        direccion: girar(centro.tangente, ARRIBA, giro).addScaledVector(ARRIBA, -0.1).normalize(),
        largo: 0.32 * (0.6 + 0.4 * Math.cos(giro * 0.4)),
        ancho: 0.1,
        contorno: CONTORNOS.ovada,
        curvatura: 0.9,
        dientes: 6,
        nervios: 5,
        color: () => color,
        ruido,
        nu: 10,
        nv: 4,
      })
    }
  }
  // Papayas alrededor del tallo, debajo de la corona.
  for (let f = 0; f < 7; f++) {
    const az = f * 2.39996
    const fuera = vector(Math.cos(az), 0, Math.sin(az))
    const desde = tallo(0.78 + (f % 3) * 0.05).addScaledVector(fuera, 0.07)
    frutoDePapaya(malla, desde, fuera.clone().multiplyScalar(0.35).addScaledVector(ARRIBA, -1).normalize(), 0.24 + random() * 0.06, random() * 0.6, ruido)
  }
}

// ---------- Chayote ----------

// Chayotera en su ramada: postes de madera, la malla de alambre a dos
// metros y encima la guia del chayote, con hojas acorazonadas y lobuladas,
// zarcillos, y los chayotes colgando por debajo.
export function chayote(malla, random, ruido) {
  suelo(malla, 1.6, 0.05, ruido)
  const altura = 2
  const lado = 1.3
  // Postes en las esquinas y en el centro de cada lado.
  for (const x of [-lado, 0, lado]) {
    for (const z of [-lado, 0, lado]) {
      if (x === 0 && z === 0) continue
      malla.tubo(
        12,
        8,
        (u) => vector(x, -0.05 + u * (altura + 0.05), z),
        () => 0.05,
        (u, a, p) => aclarar([120, 96, 70], 0.75 + ruido(p.x * 30, p.y * 3, p.z * 30, 3) * 0.45),
      )
    }
  }
  // Alambres.
  for (let k = -4; k <= 4; k++) {
    const t = (k / 4) * lado
    malla.tubo(8, 3, (u) => vector(-lado + u * lado * 2, altura, t), () => 0.004, () => [150, 150, 145])
    malla.tubo(8, 3, (u) => vector(t, altura, -lado + u * lado * 2), () => 0.004, () => [150, 150, 145])
  }
  // La guia sube por el poste del medio de un lado y se extiende sobre la ramada.
  malla.tubo(30, 6, (u) => vector(-0.05 + Math.sin(u * 20) * 0.04, u * altura, -lado + 0.05), () => 0.01, () => [96, 128, 56])
  for (let h = 0; h < 170; h++) {
    const x = (random() * 2 - 1) * lado * 1.05
    const z = (random() * 2 - 1) * lado * 1.05
    const base = vector(x, altura + 0.02 + random() * 0.08, z)
    const color = mezclar([64, 112, 46], [110, 150, 70], random() * 0.4)
    hoja(malla, {
      base,
      direccion: haciaAfuera(random() * 6, -10 + random() * 30),
      largo: 0.17 + random() * 0.05,
      ancho: 0.11,
      contorno: (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.55)), 0.9) * (1 + 0.15 * Math.sin(u * Math.PI * 5)),
      curvatura: 0.6,
      abolladura: 0.05,
      nervios: 4,
      color: () => color,
      ruido,
      nu: 8,
      nv: 4,
    })
  }
  // Chayotes colgando por debajo de la ramada.
  for (let f = 0; f < 16; f++) {
    const x = (random() * 2 - 1) * lado * 0.9
    const z = (random() * 2 - 1) * lado * 0.9
    const desde = vector(x, altura, z)
    const fin = desde.clone().addScaledVector(ARRIBA, -0.1 - random() * 0.15)
    malla.tubo(6, 4, (u) => desde.clone().lerp(fin, u), () => 0.004, () => [96, 128, 56])
    frutoDeChayote(malla, fin, 0.14 + random() * 0.03, random, ruido)
  }
}

// ---------- Melon y sandia ----------

// Mata de melon o de sandia: guias que se arrastran por el suelo desde el
// centro, con hojas lobuladas y los frutos apoyados en la tierra.
export function melon(malla, random, ruido, sandia = false) {
  suelo(malla, 1.1, 0.06, ruido)
  for (let g = 0; g < 7; g++) {
    const az = (g / 7) * Math.PI * 2 + random() * 0.4
    const largo = 0.8 + random() * 0.35
    const punto = (u) => {
      const r = u * largo
      const curva = az + Math.sin(u * 3 + g) * 0.4
      return vector(Math.cos(curva) * r, 0.05 * (1 - u * u) + 0.02, Math.sin(curva) * r)
    }
    malla.tubo(30, 5, punto, () => 0.006, () => [100, 136, 64])
    for (let h = 0; h < 10; h++) {
      const u = 0.08 + h * 0.09
      const base = punto(u)
      hoja(malla, {
        base,
        direccion: haciaAfuera(az + (h % 2 ? 1.4 : -1.4), 35 + random() * 20),
        largo: sandia ? 0.15 : 0.12,
        ancho: sandia ? 0.08 : 0.1,
        contorno: sandia
          ? (s) => Math.pow(Math.sin(Math.PI * s), 0.8) * (0.55 + 0.45 * Math.abs(Math.sin(s * Math.PI * 3)))
          : (s) => Math.pow(Math.sin(Math.PI * Math.pow(s, 0.6)), 0.8) * (1 + 0.12 * Math.sin(s * Math.PI * 4)),
        curvatura: 0.7,
        abolladura: 0.06,
        nervios: 4,
        color: () => mezclar([62, 110, 44], [100, 140, 70], random() * 0.4),
        ruido,
        nu: 10,
        nv: 5,
      })
    }
  }
  for (let f = 0; f < 4; f++) {
    const az = f * 1.7 + random()
    const r = 0.3 + random() * 0.45
    const radio = sandia ? 0.16 + random() * 0.05 : 0.08 + random() * 0.02
    frutoDeMelon(malla, vector(Math.cos(az) * r, radio * (sandia ? 0.8 : 0.92), Math.sin(az) * r), radio, sandia, random, ruido)
  }
}

// ---------- Palmas de coco y de pejibaye ----------

// Palma de coco: el tronco delgado, curvo y anillado, la corona de hojas
// pinnadas con los foliolos colgando y el racimo de cocos. Pejibaye: varios
// tallos delgados con anillos de espinas negras y racimos de frutos rojos y
// naranja que cuelgan bajo la corona.
export function palmera(malla, random, ruido, pejibaye = false) {
  suelo(malla, 1.2, 0.08, ruido)
  const tallos = pejibaye ? 3 : 1
  for (let t = 0; t < tallos; t++) {
    const az = t * 2.1 + random()
    const alto = pejibaye ? 5 + random() * 2 : 8
    const inclinacion = pejibaye ? 0.12 + random() * 0.1 : 0.25
    const fuera = vector(Math.cos(az), 0, Math.sin(az))
    const radio = pejibaye ? 0.08 : 0.16
    const tronco = (u) =>
      vector(0, -0.05 + u * alto, 0).addScaledVector(fuera, Math.sin(u * Math.PI * 0.5) * inclinacion * alto + (pejibaye ? 0.15 : 0))
    malla.tubo(
      Math.round(alto * 30),
      pejibaye ? 24 : 20,
      tronco,
      (u, a) => {
        const anillo = Math.pow(Math.abs(Math.sin(u * alto * (pejibaye ? 12 : 9))), 20)
        // Las espinas del pejibaye: puntas en anillos alrededor del tronco.
        const espina = pejibaye ? Math.pow(anillo, 0.2) * Math.pow(Math.max(0, Math.cos(a * 11 + u * 30)), 20) * 0.05 : 0
        return radio * (1 + 0.5 * Math.exp(-u * 20)) * (1 - 0.15 * u) * (1 - 0.04 * anillo) + espina
      },
      (u, a, p) => {
        const anillo = Math.pow(Math.abs(Math.sin(u * alto * (pejibaye ? 12 : 9))), 20)
        let c = aclarar(pejibaye ? [110, 100, 80] : [150, 140, 122], 0.8 + ruido(p.x * 40, p.y * 6, p.z * 40, 3) * 0.35)
        return aclarar(c, 1 - (pejibaye ? 0.7 : 0.35) * anillo)
      },
    )
    const tope = tronco(1)
    const hojas = pejibaye ? 10 : 18
    for (let h = 0; h < hojas; h++) {
      const edad = 1 - h / (hojas - 1)
      const azH = h * 2.39996 + t
      const largo = pejibaye ? 2.5 : 4
      const raquis = columna(tope, haciaAfuera(azH, 60 - edad * 50), largo, 0.9 + edad * 0.8, 40)
      malla.tubo(40, 6, (u) => raquis(u).p, (u) => 0.035 * (1 - u * 0.85), () => [140, 140, 90])
      const foliolos = pejibaye ? 40 : 55
      for (let f = 0; f < foliolos; f++) {
        const s = 0.08 + (f / foliolos) * 0.9
        const { p, tangente } = raquis(s)
        const lado = tangente.clone().cross(ARRIBA).normalize()
        for (const signo of [1, -1]) {
          hojaLarga(malla, {
            base: p,
            direccion: lado.clone().multiplyScalar(signo).addScaledVector(tangente, 0.4).addScaledVector(ARRIBA, pejibaye ? (f % 2 ? 0.3 : -0.3) : -0.35).normalize(),
            largo: (pejibaye ? 0.55 : 0.8) * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, s * 1.1))),
            ancho: pejibaye ? 0.03 : 0.028,
            curvatura: 1.2,
            nervio: 0.3,
            color: (u) => mezclar(mezclar([62, 112, 44], [110, 140, 60], edad * 0.4), [170, 150, 90], transicion(0.88, 1, u) * edad),
            ruido,
            nu: 8,
            nv: 2,
            semilla: f,
          })
        }
      }
    }
    // Frutos bajo la corona.
    if (pejibaye) {
      for (let r = 0; r < 2; r++) racimoDePejibaye(malla, tope.clone().addScaledVector(ARRIBA, -0.3).addScaledVector(vector(Math.cos(az + r * 3), 0, Math.sin(az + r * 3)), 0.12), random, ruido)
    } else {
      for (let c = 0; c < 9; c++) {
        const ang = c * 2.39996
        const fueraCoco = vector(Math.cos(ang), -0.6, Math.sin(ang)).normalize()
        frutoDeCoco(malla, tope.clone().addScaledVector(fueraCoco, 0.32), fueraCoco, 0.12, c % 4 === 0, ruido)
      }
    }
  }
}

// Racimo de pejibaye: frutos conicos rojos y naranja, cada uno con su
// capuchon verde, apretados alrededor del raquis que cuelga.
export function racimoDePejibaye(malla, desde, random, ruido) {
  const raquis = columna(desde, vector(0.3, -1, 0).normalize(), 0.45, 0.5, 12)
  malla.tubo(12, 6, (u) => raquis(u).p, () => 0.012, () => [120, 120, 70])
  for (let f = 0; f < 40; f++) {
    const { p, tangente } = raquis(0.15 + (f / 40) * 0.8)
    const ang = f * 2.39996
    const fuera = tangente.clone().cross(ARRIBA).normalize().applyAxisAngle(tangente, ang)
    const salida = fuera.clone().addScaledVector(tangente, 0.4).normalize()
    const base = p.clone().addScaledVector(fuera, 0.02)
    const color = mezclar([210, 60, 30], [240, 150, 40], random())
    cuerpo(
      malla,
      base,
      base.clone().addScaledVector(salida, 0.05),
      0.022,
      (u) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.05 + u * 0.95)), 0.6) * (1 - 0.35 * u),
      (u, a, q) => mezclar(aclarar(color, 0.88 + ruido(q.x * 400, q.y * 400, q.z * 400, 1) * 0.2), [110, 120, 60], 1 - transicion(0.05, 0.18, u)),
      { nu: 8, nv: 8 },
    )
  }
}

