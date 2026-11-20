import { aclarar, columna, hojaLarga, mezclar, suelo, transicion, vector } from './botanica.js'

// Pastos de la ganaderia: brachiaria (macollas altas de la ganaderia de
// carne), estrella africana (estolones que corren por el suelo, con espigas
// en estrella) y kikuyo (cesped tupido y bajo de la lecheria de altura).
// Cada uno cubre un parche de potrero de unos dos metros.

// Una hoja de pasto: acintada, se arquea y cae.
function brizna(malla, base, azimut, subida, largo, ancho, color, random, ruido) {
  const s = (subida * Math.PI) / 180
  hojaLarga(malla, {
    base,
    direccion: vector(Math.cos(azimut) * Math.cos(s), Math.sin(s), Math.sin(azimut) * Math.cos(s)),
    largo,
    ancho,
    curvatura: 1.2 + random() * 0.8,
    giro: (random() - 0.5) * 2,
    nervio: 0.25,
    color: (u) => mezclar(color, [175, 160, 95], transicion(0.82, 1, u) * 0.7),
    ruido,
    nu: 10,
    nv: 2,
    semilla: random() * 100,
  })
}

// Espiga: un tallo fino que sale de la macolla con racimos de espiguillas.
function espiga(malla, base, alto, racimos, enEstrella, color, random, ruido) {
  const tope = base.clone().add(vector((random() - 0.5) * 0.1, alto, (random() - 0.5) * 0.1))
  malla.tubo(16, 4, (u) => base.clone().lerp(tope, u), () => 0.0016, () => [120, 140, 70])
  for (let r = 0; r < racimos; r++) {
    const az = r * 2.39996 + random()
    const desde = enEstrella ? tope : base.clone().lerp(tope, 0.7 + (r / racimos) * 0.3)
    const dir = vector(Math.cos(az), enEstrella ? 0.35 : 0.6, Math.sin(az)).normalize()
    const eje = columna(desde, dir, 0.07 + random() * 0.03, 0.8, 10)
    malla.tubo(14, 4, (u) => eje(u).p, (u) => 0.0028 * (1 + 0.6 * Math.max(0, Math.sin(u * 60))), (u, a, p) =>
      aclarar(color, 0.85 + ruido(p.x * 500, p.y * 500, p.z * 500, 1) * 0.3),
    )
  }
}

// Correccion - Poll: no se podian generar los pastos de la ganaderia
export function pasto(malla, random, ruido, tipo) {
  suelo(malla, 1, 0.03, ruido)
  if (tipo === 'brachiaria') {
    // Macollas de hojas anchas y erguidas, de casi un metro, con espigas.
    for (let m = 0; m < 9; m++) {
      const centro = vector((random() - 0.5) * 1.4, 0.02, (random() - 0.5) * 1.4)
      for (let h = 0; h < 30; h++) {
        brizna(malla, centro.clone().add(vector((random() - 0.5) * 0.06, 0, (random() - 0.5) * 0.06)), random() * 6, 55 + random() * 30, 0.4 + random() * 0.35, 0.014, mezclar([64, 118, 44], [96, 140, 60], random() * 0.5), random, ruido)
      }
      for (let e = 0; e < 3; e++) espiga(malla, centro, 0.8 + random() * 0.3, 4, false, [140, 120, 90], random, ruido)
    }
  } else if (tipo === 'estrella') {
    // Estolones que corren por el suelo y echan hojas en cada nudo.
    for (let e = 0; e < 26; e++) {
      const desde = vector((random() - 0.5) * 1.6, 0.025, (random() - 0.5) * 1.6)
      const az = random() * Math.PI * 2
      const largo = 0.4 + random() * 0.4
      const punto = (u) => desde.clone().add(vector(Math.cos(az + Math.sin(u * 4) * 0.3) * largo * u, 0.01, Math.sin(az + Math.sin(u * 4) * 0.3) * largo * u))
      malla.tubo(16, 4, punto, () => 0.0025, () => [130, 110, 80])
      for (let n = 1; n <= 5; n++) {
        const nudo = punto(n / 5)
        for (let h = 0; h < 4; h++) brizna(malla, nudo, random() * 6, 35 + random() * 35, 0.12 + random() * 0.12, 0.006, mezclar([70, 124, 48], [110, 150, 60], random() * 0.5), random, ruido)
        if (random() < 0.3) espiga(malla, nudo, 0.25 + random() * 0.1, 5, true, [120, 70, 90], random, ruido)
      }
    }
  } else {
    // Kikuyo: un colchon de hojas cortas y muy tupidas.
    for (let h = 0; h < 650; h++) {
      const base = vector((random() - 0.5) * 1.7, 0.02, (random() - 0.5) * 1.7)
      if (Math.hypot(base.x, base.z) > 0.95) continue
      brizna(malla, base, random() * 6, 40 + random() * 40, 0.08 + random() * 0.08, 0.006, mezclar([62, 120, 44], [100, 150, 60], random() * 0.6), random, ruido)
    }
  }
}

