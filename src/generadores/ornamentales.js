import * as THREE from 'three'
import { ARRIBA, CONTORNOS, aclarar, columna, girar, hoja, hojaLarga, mezclar, suelo, transicion, vector } from './botanica.js'

// Ornamentales y helechos: la cana india (dracaena), el helecho hoja de cuero
// (Costa Rica es su principal exportador) y el helecho arborescente o "rabo
// de mico" de los bosques nubosos.

// Direccion que sale hacia "azimut" subiendo "grados" sobre el horizonte.
function haciaAfuera(azimut, grados) {
  const subida = THREE.MathUtils.degToRad(grados)
  return vector(Math.cos(azimut) * Math.cos(subida), Math.sin(subida), Math.sin(azimut) * Math.cos(subida))
}

// ---------- Cana india ----------

// Cana india (Dracaena fragrans): tallos de distinta altura con las
// cicatrices de las hojas en anillos, y en la punta un penacho de hojas
// acintadas que se arquean, con la franja central amarilla.
export function canaIndia(malla, random, ruido) {
  suelo(malla, 0.45, 0.06, ruido)
  for (let t = 0; t < 3; t++) {
    const alto = 1 + t * 0.6 + random() * 0.3
    const az = t * 2.1
    const base = vector(Math.cos(az) * 0.05, -0.02, Math.sin(az) * 0.05)
    const tope = base.clone().add(vector(Math.cos(az) * 0.15, alto, Math.sin(az) * 0.15))
    malla.tubo(
      Math.round(alto * 50),
      10,
      (u) => base.clone().lerp(tope, u),
      (u) => 0.028 * (1 - u * 0.3),
      (u, a, p) => aclarar([150, 138, 112], 1 - 0.3 * Math.pow(Math.abs(Math.sin(u * alto * 60)), 20) + (ruido(p.x * 90, p.y * 20, p.z * 90, 2) - 0.5) * 0.2),
    )
    for (let h = 0; h < 22; h++) {
      const t2 = h / 22
      hojaLarga(malla, {
        base: tope.clone().addScaledVector(ARRIBA, -t2 * 0.1),
        direccion: haciaAfuera(h * 2.39996, 75 - t2 * 55),
        largo: 0.5 + random() * 0.2,
        ancho: 0.04,
        curvatura: 1.4 + t2,
        giro: (random() - 0.5),
        nervio: 0,
        color: (u, s) => mezclar([46, 96, 40], [210, 200, 80], (1 - transicion(0.1, 0.3, Math.abs(s))) * 0.85),
        ruido,
        nu: 16,
        nv: 6,
        semilla: random() * 100,
      })
    }
  }
}

// ---------- Helechos ----------

// Fronda de helecho: un raquis que se arquea con pinas a los dos lados; cada
// pina es una hoja dentada que se achica hacia la punta (fronda triangular).
function fronda(malla, base, direccion, largo, color, random, ruido, opciones = {}) {
  const { pinas = 14, anchoPina = 0.25, curvatura = 1.1 } = opciones
  const raquis = columna(base, direccion, largo, curvatura, 20)
  malla.tubo(24, 5, (u) => raquis(u).p, (u) => 0.004 * largo * (1 - u * 0.7) * 3, () => aclarar(color, 0.8))
  for (let p = 0; p < pinas; p++) {
    const t = 0.12 + (p / pinas) * 0.84
    const { p: punto, tangente } = raquis(t)
    const tamano = largo * anchoPina * Math.pow(1 - t, 0.7)
    for (const lado of [-1, 1]) {
      hoja(malla, {
        base: punto,
        direccion: girar(tangente, ARRIBA, lado * 1.25).addScaledVector(tangente, 0.25).normalize(),
        largo: tamano,
        ancho: tamano * 0.35,
        contorno: CONTORNOS.eliptica,
        curvatura: 0.5,
        pliegue: 0.05,
        dientes: 14,
        nervios: 8,
        angulo: 1,
        color: () => color,
        ruido,
        nu: 8,
        nv: 3,
        semilla: random() * 100,
      })
    }
  }
}

// Helecho hoja de cuero: una mata de frondas triangulares, firmes y de un
// verde oscuro brillante, como se cultiva bajo sarán.
export function helechoCuero(malla, random, ruido) {
  suelo(malla, 0.5, 0.05, ruido)
  for (let f = 0; f < 12; f++) {
    fronda(malla, vector(0, 0.03, 0), haciaAfuera(f * 2.39996, 50 + random() * 25), 0.55 + random() * 0.2, mezclar([28, 76, 34], [52, 104, 44], random() * 0.4), random, ruido, { pinas: 13, anchoPina: 0.3 })
  }
}

// Helecho arborescente: un tronco fibroso y cafe con las cicatrices de las
// frondas caidas, la corona de frondas enormes que se arquean y los baculos
// (frondas nuevas todavia enrolladas, el "rabo de mico").
export function helechoArborescente(malla, random, ruido) {
  suelo(malla, 0.8, 0.06, ruido)
  const alto = 4
  const tronco = (u) => vector(Math.sin(u * 2) * 0.1, -0.05 + u * alto, 0)
  malla.tubo(
    120,
    20,
    tronco,
    (u, a) => 0.13 * (1 + 0.3 * Math.exp(-u * 8)) + 0.012 * Math.pow(Math.max(0, Math.cos(a * 4 + u * 60)), 6),
    (u, a, p) => aclarar([88, 66, 46], 0.7 + ruido(p.x * 60, p.y * 60, p.z * 60, 3) * 0.5),
  )
  const tope = tronco(1)
  for (let f = 0; f < 14; f++) {
    fronda(malla, tope, haciaAfuera(f * 2.39996, 45 + random() * 25), 2.2 + random() * 0.6, mezclar([60, 110, 46], [90, 140, 60], random() * 0.4), random, ruido, { pinas: 18, anchoPina: 0.22, curvatura: 1.5 })
  }
  // Baculos: espirales enrolladas, peludas y cafes.
  for (let b = 0; b < 4; b++) {
    const az = b * 1.6
    const base = tope.clone().addScaledVector(ARRIBA, 0.05)
    malla.tubo(
      40,
      8,
      (u) => {
        const subida = base.clone().add(vector(Math.cos(az) * 0.1, 0.35 * Math.min(1, u * 1.6), Math.sin(az) * 0.1))
        const giro = Math.max(0, u - 0.55) / 0.45
        const radio = 0.07 * (1 - giro * 0.8)
        return subida.add(vector(Math.cos(az) * Math.sin(giro * 9) * radio, Math.cos(giro * 9) * radio - radio, Math.sin(az) * Math.sin(giro * 9) * radio))
      },
      (u) => 0.012 * (1 - u * 0.5),
      (u, a, p) => aclarar([150, 110, 70], 0.8 + ruido(p.x * 300, p.y * 300, p.z * 300, 2) * 0.3),
    )
  }
}
