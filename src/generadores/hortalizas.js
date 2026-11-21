import * as THREE from 'three'
import { ARRIBA, PERFILES, aclarar, columna, cuerpo, girar, hoja, mezclar, suelo, transicion, vector } from './botanica.js'

// Hortalizas del Valle Central (Cartago, Zarcero): lechuga, repollo,
// zanahoria y cebolla, la mata en su era de tierra y lo que se cosecha.

// Direccion que sale hacia "azimut" subiendo "grados" sobre el horizonte.
function haciaAfuera(azimut, grados) {
  const subida = THREE.MathUtils.degToRad(grados)
  return vector(Math.cos(azimut) * Math.cos(subida), Math.sin(subida), Math.sin(azimut) * Math.cos(subida))
}

// ---------- Lechuga ----------

// Lechuga: una roseta de hojas rizadas, las de afuera abiertas y mas oscuras,
// las de adentro erguidas, claras y apretadas.
export function cabezaDeLechuga(malla, base, random, ruido) {
  const hojas = 34
  for (let h = 0; h < hojas; h++) {
    const t = h / hojas
    const az = h * 2.39996
    hoja(malla, {
      base: base.clone().addScaledVector(ARRIBA, t * 0.03),
      direccion: haciaAfuera(az, 20 + t * 60),
      largo: 0.17 - t * 0.07,
      ancho: 0.13 - t * 0.05,
      contorno: (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.5)), 0.7),
      curvatura: 1.1 - t * 1.6,
      pliegue: 0.3,
      abolladura: 0.05,
      onda: 0.08,
      nervios: 6,
      color: (u) => mezclar(mezclar([70, 130, 50], [190, 220, 120], t), [225, 235, 190], (1 - u) * 0.5),
      ruido,
      semilla: random() * 100,
      nu: 18,
      nv: 10,
    })
  }
}

export function lechuga(malla, random, ruido) {
  suelo(malla, 0.3, 0.05, ruido)
  cabezaDeLechuga(malla, vector(0, 0.04, 0), random, ruido)
}

// ---------- Repollo ----------

// Cabeza de repollo: hojas apretadas sobre una esfera, con las venas claras
// que bajan del centro; la envuelven hojas abiertas, grandes y cerosas.
export function cabezaDeRepollo(malla, centro, radio, abiertas, random, ruido) {
  cuerpo(
    malla,
    centro.clone().addScaledVector(ARRIBA, -radio * 0.9),
    centro.clone().addScaledVector(ARRIBA, radio * 0.9),
    radio,
    PERFILES.esfera,
    (u, a, p) => {
      // Bordes de las hojas que envuelven la cabeza, en espiral.
      const borde = Math.pow(Math.abs(Math.sin(a * 1.5 + u * 4 + ruido(p.x * 8, p.y * 8, p.z * 8, 2) * 2)), 30)
      const vena = Math.pow(Math.abs(Math.sin(a * 9 + u * 2)), 40)
      let c = aclarar([182, 208, 150], 0.88 + ruido(p.x * 80, p.y * 80, p.z * 80, 2) * 0.15)
      c = aclarar(c, 1 - 0.15 * borde)
      return mezclar(c, [225, 235, 205], vena * 0.6)
    },
    { forma: (u, a) => 1 + 0.02 * Math.sin(a * 1.5 + u * 4), nu: 30, nv: 36 },
  )
  for (let h = 0; h < abiertas; h++) {
    const az = h * 2.39996 + random()
    hoja(malla, {
      // Las hojas de afuera nacen abajo, suben pegadas a la cabeza y se abren
      // arriba (la curvatura las vuelca hacia afuera).
      base: centro.clone().addScaledVector(ARRIBA, -radio * 0.8).add(vector(Math.cos(az), 0, Math.sin(az)).multiplyScalar(radio * 0.75)),
      direccion: haciaAfuera(az, 72 + random() * 10),
      largo: radio * 2,
      ancho: radio * 1.5,
      contorno: (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.6)), 0.6),
      curvatura: 1.5,
      pliegue: 0.05,
      abolladura: 0.02,
      onda: 0,
      nervios: 6,
      color: (u, s) => mezclar([88, 130, 110], [150, 175, 160], Math.abs(s) * 0.3 + u * 0.2),
      ruido,
      semilla: random() * 100,
      nu: 18,
      nv: 12,
    })
  }
}

export function repollo(malla, random, ruido) {
  suelo(malla, 0.42, 0.05, ruido)
  cabezaDeRepollo(malla, vector(0, 0.15, 0), 0.1, 11, random, ruido)
}

// ---------- Zanahoria ----------

// Hoja de zanahoria: un peciolo largo con foliolos finamente divididos, como
// una pluma.
function hojaDeZanahoria(malla, base, azimut, random, ruido) {
  const raquis = columna(base, haciaAfuera(azimut, 65 + random() * 15), 0.3 + random() * 0.1, 1.2, 12)
  malla.tubo(14, 4, (u) => raquis(u).p, () => 0.0018, () => [92, 130, 60])
  for (let f = 0; f < 9; f++) {
    const { p, tangente } = raquis(0.3 + f * 0.075)
    for (const lado of [-1, 1]) {
      hoja(malla, {
        base: p,
        direccion: girar(tangente, ARRIBA, lado * 1.1),
        largo: 0.045 * (1 - f * 0.06),
        ancho: 0.02,
        contorno: (u) => Math.pow(Math.sin(Math.PI * u), 0.8) * (0.4 + 0.6 * Math.abs(Math.sin(u * Math.PI * 4))),
        curvatura: 0.4,
        pliegue: 0,
        nervios: 3,
        color: () => [56, 110, 40],
        ruido,
        nu: 8,
        nv: 2,
      })
    }
  }
}

// Raiz de zanahoria: conica y naranja, con anillos finos y raicillas.
// Correccion - Poll: el hombro de la raiz quedaba abierto
export function raizDeZanahoria(malla, tope, direccion, largo, ruido) {
  const fin = tope.clone().addScaledVector(direccion, largo)
  malla.tubo(
    40,
    16,
    (u) => tope.clone().lerp(fin, u),
    (u) => largo * 0.13 * Math.pow(1 - u, 0.8) * (u < 0.04 ? 0.6 + u * 10 : 1),
    (u, a, p) => {
      const anillo = Math.pow(Math.abs(Math.sin(u * 120)), 30)
      const c = aclarar([232, 112, 28], 0.88 + ruido(p.x * 200, p.y * 200, p.z * 200, 2) * 0.15)
      return mezclar(aclarar(c, 1 - 0.2 * anillo), [120, 140, 60], 1 - transicion(0, 0.04, u))
    },
    { tapas: true },
  )
}

export function zanahoria(malla, random, ruido) {
  suelo(malla, 0.3, 0.04, ruido)
  // El hombro de la raiz asoma de la tierra.
  raizDeZanahoria(malla, vector(0, 0.05, 0), vector(0, -1, 0), 0.2, ruido)
  for (let h = 0; h < 9; h++) hojaDeZanahoria(malla, vector(0, 0.05, 0), h * 2.39996, random, ruido)
}

// ---------- Cebolla ----------

// Bulbo de cebolla: redondo, con la cascara seca dorada en capas, el cuello
// y las raicillas abajo.
export function bulboDeCebolla(malla, centro, radio, morada, random, ruido) {
  const color = morada ? [130, 50, 80] : [196, 140, 70]
  cuerpo(
    malla,
    centro.clone().addScaledVector(ARRIBA, -radio * 0.85),
    centro.clone().addScaledVector(ARRIBA, radio * 1.2),
    radio,
    (u) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.02 + u * 0.98)), 0.7) * (1 - 0.65 * transicion(0.55, 1, u)),
    (u, a, p) => {
      // Vetas a lo largo, del cuello a la base, y la cascara que se pela.
      const veta = Math.pow(Math.abs(Math.sin(a * 18)), 20)
      let c = aclarar(color, 0.85 + ruido(p.x * 300, p.y * 60, p.z * 300, 2) * 0.2)
      c = aclarar(c, 1 - 0.15 * veta)
      return mezclar(c, morada ? [230, 210, 220] : [235, 215, 170], transicion(0.62, 0.68, ruido(p.x * 30, p.y * 30, p.z * 30, 3)) * 0.6)
    },
    { nu: 28, nv: 36 },
  )
  // Raicillas.
  const fondo = centro.clone().addScaledVector(ARRIBA, -radio * 0.85)
  for (let r = 0; r < 14; r++) {
    const ang = random() * Math.PI * 2
    const fin = fondo.clone().add(vector(Math.cos(ang) * 0.02, -0.02 - random() * 0.02, Math.sin(ang) * 0.02))
    malla.tubo(6, 3, (u) => fondo.clone().lerp(fin, u), () => 0.0008, () => [200, 180, 140])
  }
}

export function cebolla(malla, random, ruido) {
  suelo(malla, 0.3, 0.03, ruido)
  bulboDeCebolla(malla, vector(0, 0.04, 0), 0.045, false, random, ruido)
  // Hojas huecas y cilindricas que salen del cuello y se doblan.
  const cuello = vector(0, 0.09, 0)
  for (let h = 0; h < 8; h++) {
    const eje = columna(cuello, haciaAfuera(h * 2.39996, 72 + random() * 12), 0.35 + random() * 0.15, 0.9, 16)
    malla.tubo(24, 8, (u) => eje(u).p, (u) => 0.006 * Math.pow(1 - u, 0.6), (u, a, p) =>
      mezclar(aclarar([70, 120, 80], 0.88 + ruido(p.x * 200, p.y * 200, p.z * 200, 2) * 0.2), [170, 160, 100], transicion(0.88, 1, u) * 0.7),
    )
  }
}

// ---------- Cosechas ----------

export const COSECHAS_DE_HORTALIZAS = {
  lechuga: (malla, random, ruido) => cabezaDeLechuga(malla, vector(0, 0, 0), random, ruido),
  repollo: (malla, random, ruido) => cabezaDeRepollo(malla, vector(0, 0.1, 0), 0.1, 3, random, ruido),
  zanahoria: (malla, random, ruido) => {
    for (let z = 0; z < 3; z++) {
      const tope = vector(-0.1, 0.025, (z - 1) * 0.06)
      raizDeZanahoria(malla, tope, vector(1, 0, (z - 1) * 0.1).normalize(), 0.18 + z * 0.02, ruido)
      for (let h = 0; h < 3; h++) {
        const raquis = columna(tope, vector(-1, 0.3, (h - 1) * 0.3).normalize(), 0.18, 0.4, 8)
        malla.tubo(8, 3, (u) => raquis(u).p, () => 0.0018, () => [92, 130, 60])
      }
    }
  },
  cebolla: (malla, random, ruido) => {
    for (let c = 0; c < 3; c++) bulboDeCebolla(malla, vector((c - 1) * 0.1, 0.04, (c % 2) * 0.04), 0.042, c === 2, random, ruido)
  },
}

