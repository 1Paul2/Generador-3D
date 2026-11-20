import * as THREE from 'three'
import { ARRIBA, CONTORNOS, aclarar, columna, cuerpo, girar, hoja, mezclar, suelo, transicion, vector } from './botanica.js'
import { frutoDeAguacate, frutoDeMango, frutoDeNaranja } from './frutales.js'

// Arboles de Costa Rica (los del bosque y los de plantacion forestal) y los
// frutales, armados por especie: cada una tiene su arquitectura (como se
// abren y hacia donde van las ramas), su corteza, su tipo de hoja, sus flores
// y sus frutos. Las medidas estan en metros.
//
// La copa se arma por ramificacion: el tronco se divide en ramas, cada rama
// en otras mas cortas y delgadas (el grosor de las hijas sigue la regla de
// Leonardo: el area de la madre se reparte entre las hijas), y en las puntas
// crecen las hojas, las flores o los frutos.
//   elevacion: cuantos grados suben las ramas de cada nivel (pocos = copa
//     ancha y plana como el guanacaste; muchos = copa angosta como la teca).
//   abanico: cuanto se apartan las hijas de la direccion de la madre.

const CORTEZAS = {
  // Gris clara con liquenes (ceiba, guanacaste).
  lisa: { color: [128, 122, 112], fisura: 0, liquen: 0.6 },
  // Cafe con fisuras a lo largo (cedro, roble, teca).
  fisurada: { color: [104, 86, 68], fisura: 1, liquen: 0.3 },
  // Con anillos (guarumo).
  anillada: { color: [168, 166, 150], fisura: 0, anillos: 1, liquen: 0.2 },
  // Roja y brillante que se pela en laminas (indio desnudo).
  roja: { color: [168, 82, 58], fisura: 0, pelada: 1, liquen: 0 },
}

// Especies. alto y radio son los del fuste (hasta la primera horqueta).
// Proporciones: en un arbol real la copa ocupa mas o menos la mitad de la
// altura; solo la ceiba tiene un fuste mucho mas alto que su copa. Las hojas
// se dibujan mas grandes que las reales: un arbol tiene cientos de miles y
// aca hay unos miles, asi que cada una cubre lo que cubririan varias.
export const ARBOLES = {
  guanacaste: {
    alto: 3, radio: 0.55, largo: 5, niveles: 5, ramas: 3, elevacion: [38, 24, 16, 12, 10], abanico: 50, caida: 0.3,
    corteza: 'lisa', hoja: { tipo: 'bipinnada', largo: 0.8, color: [58, 102, 40], porPunta: 2 }, fruto: 'oreja',
  },
  ceiba: {
    alto: 13, radio: 0.75, largo: 8, niveles: 5, ramas: 3, elevacion: [14, 10, 16, 20, 25], abanico: 45, caida: 0.15,
    corteza: 'lisa', gambas: 6, hoja: { tipo: 'palmada', largo: 0.6, lobulos: 6, color: [66, 108, 44], pocas: true },
  },
  cortez: {
    alto: 2.2, radio: 0.26, largo: 3, niveles: 5, ramas: 3, elevacion: [62, 45, 32, 25, 20], abanico: 45, caida: 0.2,
    corteza: 'fisurada', flor: { color: [246, 200, 20], cantidad: 5, tamano: 1.8 }, hoja: null,
  },
  roble: {
    alto: 2.8, radio: 0.3, largo: 3.4, niveles: 5, ramas: 3, elevacion: [72, 62, 52, 44, 38], abanico: 40, caida: 0.12,
    corteza: 'fisurada', flor: { color: [236, 160, 196], cantidad: 3, tamano: 1.8 }, hoja: { tipo: 'palmada', largo: 0.4, lobulos: 5, color: [70, 112, 46], pocas: true, porPunta: 4 },
  },
  teca: {
    alto: 5, radio: 0.26, largo: 2.6, niveles: 4, ramas: 3, elevacion: [76, 66, 56, 48], abanico: 35, caida: 0.1,
    corteza: 'fisurada', hoja: { tipo: 'grande', largo: 1, ancho: 0.55, color: [72, 112, 46] },
  },
  melina: {
    alto: 4, radio: 0.24, largo: 2.8, niveles: 4, ramas: 3, elevacion: [72, 60, 50, 42], abanico: 40, caida: 0.15,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.5, ancho: 0.34, contorno: 'ovada', color: [70, 116, 48], porPunta: 7 },
  },
  poro: {
    alto: 1.8, radio: 0.22, largo: 2.6, niveles: 4, ramas: 3, elevacion: [70, 58, 48, 40], abanico: 45, caida: 0.15,
    corteza: 'lisa', flor: { color: [236, 92, 36], cantidad: 6, espiga: true, tamano: 2 }, hoja: { tipo: 'trifoliada', largo: 0.36, color: [74, 118, 50], pocas: true },
  },
  cedro: {
    alto: 5, radio: 0.4, largo: 4.2, niveles: 4, ramas: 3, elevacion: [68, 56, 46, 40], abanico: 45, caida: 0.15,
    corteza: 'fisurada', hoja: { tipo: 'pinnada', largo: 0.9, color: [66, 108, 44] },
  },
  guarumo: {
    alto: 6, radio: 0.16, largo: 3, niveles: 2, ramas: 4, elevacion: [42, 70], abanico: 40, caida: -0.4,
    corteza: 'anillada', hoja: { tipo: 'palmada', largo: 0.7, lobulos: 9, color: [78, 112, 60], plata: true, porPunta: 6 },
  },
  indio: {
    alto: 1.8, radio: 0.32, largo: 3.4, niveles: 4, ramas: 3, elevacion: [52, 40, 32, 26], abanico: 55, caida: 0.25, torcido: 1,
    corteza: 'roja', hoja: { tipo: 'pinnada', largo: 0.5, color: [84, 124, 52], pocas: true },
  },
  // Frutales.
  naranja: {
    alto: 0.8, radio: 0.13, largo: 1.6, niveles: 5, ramas: 3, elevacion: [66, 56, 46, 38, 32], abanico: 55, caida: 0.35,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.14, ancho: 0.065, color: [36, 84, 32], porPunta: 7 }, fruto: 'naranja',
  },
  mango: {
    alto: 1.6, radio: 0.35, largo: 3.6, niveles: 5, ramas: 3, elevacion: [64, 54, 44, 36, 30], abanico: 55, caida: 0.35,
    corteza: 'fisurada', hoja: { tipo: 'simple', largo: 0.38, ancho: 0.085, contorno: 'eliptica', color: [36, 78, 34], porPunta: 6, brote: [150, 70, 60] }, fruto: 'mango',
  },
  aguacate: {
    alto: 1.8, radio: 0.3, largo: 3.2, niveles: 5, ramas: 3, elevacion: [70, 60, 50, 42, 36], abanico: 45, caida: 0.25,
    corteza: 'fisurada', hoja: { tipo: 'simple', largo: 0.28, ancho: 0.12, contorno: 'eliptica', color: [52, 96, 40], porPunta: 6 }, fruto: 'aguacate',
  },
}

// Direccion que sale hacia "azimut" subiendo "grados" sobre el horizonte.
function haciaAfuera(azimut, grados) {
  const subida = THREE.MathUtils.degToRad(grados)
  return vector(Math.cos(azimut) * Math.cos(subida), Math.sin(subida), Math.sin(azimut) * Math.cos(subida))
}

// Color de la corteza en un punto, con sus fisuras, anillos y liquenes.
function colorDeCorteza(tipo, p, u, a, ruido) {
  const corteza = CORTEZAS[tipo]
  let c = aclarar(corteza.color, 0.78 + ruido(p.x * 20, p.y * 6, p.z * 20, 3) * 0.4)
  if (corteza.fisura) {
    const fisura = transicion(0.55, 0.68, ruido(Math.cos(a) * 5 + p.x * 3, p.y * 1.2, Math.sin(a) * 5 + p.z * 3, 3))
    c = aclarar(c, 1 - 0.45 * fisura)
  }
  if (corteza.anillos) c = aclarar(c, 1 - 0.25 * Math.pow(Math.abs(Math.sin(p.y * 9)), 30))
  if (corteza.pelada) {
    // Laminas de corteza vieja, verdosas y papiraceas, sobre la roja.
    c = mezclar(c, [150, 160, 120], transicion(0.6, 0.66, ruido(p.x * 8, p.y * 3, p.z * 8, 3)) * 0.8)
    c = aclarar(c, 1 + 0.12 * Math.pow(Math.max(0, Math.cos(a)), 6))
  }
  return mezclar(c, [180, 186, 160], transicion(0.62, 0.7, ruido(p.x * 12 + 5, p.y * 12, p.z * 12, 3)) * corteza.liquen)
}

// Hojas en la punta de una ramita, segun el tipo de hoja de la especie.
function hojasDePunta(malla, punta, dir, especie, random, ruido) {
  const h = especie.hoja
  // Brote nuevo (rojizo en el mango) en pocas puntas.
  const brote = random() < 0.12
  const cantidad = (h.porPunta ?? 5) * (h.pocas ? 0.5 : 1)
  for (let k = 0; k < cantidad; k++) {
    const azimut = k * 2.39996 + random()
    const salida = dir.clone().multiplyScalar(0.6).add(haciaAfuera(azimut, -10 + random() * 40)).normalize()
    const desde = punta.clone().addScaledVector(dir, -0.04 * k)
    const color = mezclar(h.color, h.brote ?? [100, 140, 60], h.brote && brote && k < 3 ? 0.8 : random() * 0.25)
    const largo = h.largo * (0.75 + random() * 0.5)
    if (h.tipo === 'simple' || h.tipo === 'grande') {
      hoja(malla, {
        base: desde,
        direccion: salida,
        largo,
        ancho: (h.ancho ?? h.largo * 0.45) * (0.8 + random() * 0.4),
        contorno: CONTORNOS[h.contorno ?? 'ovada'],
        curvatura: h.tipo === 'grande' ? 1.2 : 0.8,
        pliegue: 0.12,
        abolladura: h.tipo === 'grande' ? 0.05 : 0.02,
        nervios: h.tipo === 'grande' ? 10 : 6,
        color: () => color,
        ruido,
        semilla: random() * 100,
        nu: h.tipo === 'grande' ? 12 : 6,
        nv: h.tipo === 'grande' ? 6 : 3,
      })
    } else if (h.tipo === 'palmada') {
      // Hoja palmeada: un peciolo y los lobulos (o foliolos) en abanico.
      const centro = desde.clone().addScaledVector(salida, largo * 0.5)
      const lobulos = h.lobulos
      for (let l = 0; l < lobulos; l++) {
        const giro = (l / (lobulos - 1) - 0.5) * (h.lobulos > 7 ? 5.5 : 3.2)
        hoja(malla, {
          base: centro,
          direccion: girar(salida, ARRIBA, giro).addScaledVector(ARRIBA, -0.2).normalize(),
          largo: largo * (0.55 + 0.45 * Math.cos(giro * 0.4)),
          ancho: largo * 0.18,
          contorno: CONTORNOS.eliptica,
          curvatura: 0.9,
          nervios: 5,
          color: (u, s) => (h.plata ? mezclar(color, [190, 198, 186], 0.25 * Math.abs(s)) : color),
          ruido,
          nu: 6,
          nv: 3,
        })
      }
    } else if (h.tipo === 'trifoliada') {
      const centro = desde.clone().addScaledVector(salida, largo * 0.4)
      for (const giro of [-1.2, 0, 1.2]) {
        hoja(malla, {
          base: centro,
          direccion: girar(salida, ARRIBA, giro),
          largo: largo * (giro ? 0.8 : 1),
          ancho: largo * 0.75,
          contorno: CONTORNOS.ovada,
          curvatura: 0.8,
          nervios: 5,
          color: () => color,
          ruido,
          nu: 6,
          nv: 4,
        })
      }
    } else {
      // Compuesta (pinnada) o bipinnada (guanacaste): un raquis con foliolos
      // chiquitos a los dos lados; en la bipinnada cada pina es una tira de
      // foliolos diminutos, que de lejos se ve como una pluma.
      const raquis = columna(desde, salida, largo, 0.9, 10)
      const pares = h.tipo === 'bipinnada' ? 5 : 6
      for (let f = 0; f < pares; f++) {
        const { p, tangente } = raquis(0.2 + (f / pares) * 0.75)
        for (const lado of [-1, 1]) {
          const lateral = girar(tangente, ARRIBA, lado * 1.1)
          hoja(malla, {
            base: p,
            direccion: lateral,
            largo: largo * (h.tipo === 'bipinnada' ? 0.32 : 0.22),
            ancho: largo * (h.tipo === 'bipinnada' ? 0.05 : 0.07),
            contorno: CONTORNOS.eliptica,
            curvatura: 0.4,
            pliegue: 0,
            nervios: h.tipo === 'bipinnada' ? 14 : 4,
            angulo: h.tipo === 'bipinnada' ? 0 : 0.5,
            color: (u) => (h.tipo === 'bipinnada' ? aclarar(color, 0.85 + 0.25 * Math.abs(Math.sin(u * 40))) : color),
            ruido,
            nu: h.tipo === 'bipinnada' ? 8 : 5,
            nv: 2,
          })
        }
      }
    }
  }
}

// Ramillete de flores en la punta de una ramita: flores de trompeta (cortez,
// roble) con cinco petalos abiertos, o una espiga de flores alargadas (poro).
function floresDePunta(malla, punta, dir, flor, random, ruido) {
  for (let k = 0; k < flor.cantidad; k++) {
    const azimut = k * 2.39996 + random()
    const salida = dir.clone().multiplyScalar(0.5).add(haciaAfuera(azimut, 10 + random() * 50)).normalize()
    const tamano = flor.tamano ?? 1
    const centro = punta.clone().addScaledVector(salida, (0.06 + random() * 0.05) * tamano)
    const color = aclarar(flor.color, 0.88 + random() * 0.2)
    if (flor.espiga) {
      cuerpo(malla, centro, centro.clone().addScaledVector(salida, 0.07 * tamano), 0.009 * tamano, (u) => Math.sin(Math.PI * Math.min(1, 0.1 + u)) ** 0.5, () => color, { nu: 5, nv: 5 })
      continue
    }
    // Tubo de la corola y cinco petalos.
    cuerpo(malla, centro.clone().addScaledVector(salida, -0.04 * tamano), centro, 0.012 * tamano, (u) => 0.35 + 0.65 * u, () => aclarar(color, 0.85), { nu: 3, nv: 6 })
    for (let p = 0; p < 5; p++) {
      hoja(malla, {
        base: centro,
        direccion: girar(salida.clone().cross(ARRIBA).normalize(), salida, p * 1.2566).addScaledVector(salida, 0.6).normalize(),
        largo: 0.035 * tamano,
        ancho: 0.03 * tamano,
        contorno: CONTORNOS.eliptica,
        curvatura: -0.6,
        pliegue: 0,
        nervios: 2,
        color: (u) => mezclar(color, [255, 245, 220], 0.25 * (1 - u)),
        ruido,
        nu: 4,
        nv: 2,
      })
    }
  }
}

// Vaina de guanacaste: una "oreja" cafe oscura enrollada en espiral.
function orejaDeGuanacaste(malla, centro, random, ruido) {
  const eje = vector(random() - 0.5, 0.2, random() - 0.5).normalize()
  const lado = eje.clone().cross(ARRIBA).normalize()
  const otro = eje.clone().cross(lado).normalize()
  malla.tubo(
    40,
    10,
    (u) => {
      const ang = u * Math.PI * 1.7
      const r = 0.05 + 0.04 * (1 - u)
      return centro.clone().addScaledVector(lado, Math.cos(ang) * r).addScaledVector(otro, Math.sin(ang) * r)
    },
    (u, a) => 0.022 * Math.sin(Math.PI * Math.min(1, 0.05 + u)) ** 0.4 / Math.sqrt(Math.cos(a) ** 2 + (Math.sin(a) / 0.3) ** 2),
    (u, a, p) => aclarar([72, 44, 30], 0.8 + ruido(p.x * 200, p.y * 200, p.z * 200, 2) * 0.4),
  )
}

const FRUTOS = {
  naranja: (malla, p, random, ruido) => frutoDeNaranja(malla, p.clone().addScaledVector(ARRIBA, -0.05), 0.04, random, ruido),
  mango: (malla, p, random, ruido) => {
    // El mango cuelga de un pedunculo largo.
    const fin = p.clone().addScaledVector(ARRIBA, -0.25)
    malla.tubo(8, 4, (u) => p.clone().lerp(fin, u), () => 0.003, () => [90, 100, 50])
    frutoDeMango(malla, fin, 0.07, random, ruido)
  },
  aguacate: (malla, p, random, ruido) => {
    const fin = p.clone().addScaledVector(ARRIBA, -0.1)
    malla.tubo(6, 4, (u) => p.clone().lerp(fin, u), () => 0.005, () => [90, 100, 50])
    frutoDeAguacate(malla, fin, 0.065, random, ruido)
  },
  oreja: (malla, p, random, ruido) => orejaDeGuanacaste(malla, p.clone().addScaledVector(ARRIBA, -0.1), random, ruido),
}

// Correccion - Poll: los arboles eran matas redondas iguales para cualquier especie
export function arbol(malla, random, ruido, nombre) {
  const especie = ARBOLES[nombre]
  suelo(malla, Math.max(0.8, especie.radio * 4), 0.06, ruido)
  const puntas = []

  // Fuste: un poco torcido, mas ancho en la base y, en la ceiba, con gambas
  // (raices en tabla) que bajan al suelo.
  const torcido = (especie.torcido ?? 0.3) * 0.6
  const fuste = (u) =>
    vector((ruido(u * 2, 1, 7, 2) - 0.5) * torcido * especie.alto * 0.15, -0.05 + u * especie.alto, (ruido(u * 2, 9, 7, 2) - 0.5) * torcido * especie.alto * 0.15)
  const gambas = especie.gambas ?? 0
  malla.tubo(
    Math.max(30, Math.round(especie.alto * 12)),
    gambas ? 72 : 32,
    fuste,
    (u, a) => {
      let r = especie.radio * (1 - 0.25 * u) * (1 + 0.6 * Math.exp(-u * especie.alto * 2))
      if (gambas) r += especie.radio * 2.2 * Math.pow(Math.max(0, Math.cos(a * gambas / 2)), 12) * Math.exp(-u * especie.alto / 2.5)
      if (CORTEZAS[especie.corteza].fisura) r *= 1 - 0.03 * transicion(0.55, 0.68, ruido(Math.cos(a) * 5, u * especie.alto * 1.2, Math.sin(a) * 5, 3))
      return r
    },
    (u, a, p) => colorDeCorteza(especie.corteza, p, u, a, ruido),
  )

  // Copa: ramas que se dividen nivel por nivel.
  function crecer(desde, dir, largo, radio, nivel, azimut) {
    const curva = especie.caida * (1 - Math.max(0, dir.y)) * (nivel < 2 ? 1.5 : 1)
    const eje = columna(desde, dir, largo, curva, 16)
    malla.tubo(
      Math.max(6, Math.round(largo * 6)),
      Math.max(5, Math.min(16, Math.round(radio * 60))),
      (u) => eje(u).p,
      (u) => radio * (1 - u * 0.35),
      (u, a, p) => colorDeCorteza(especie.corteza, p, u, a, ruido),
    )
    const fin = eje(1)
    const profundidad = especie.niveles - nivel
    if (nivel === 1) puntas.push(eje(0.5))
    if (nivel === 0) {
      puntas.push(fin, eje(0.45))
      return
    }
    const hijas = especie.ramas + (random() < 0.3 ? 1 : 0) - (random() < 0.2 ? 1 : 0)
    // Regla de Leonardo: el area de la madre se reparte entre las hijas.
    const radioHija = radio * Math.pow(1 / Math.max(1, hijas), 1 / 2.4)
    for (let h = 0; h < hijas; h++) {
      const az = profundidad === 0 ? azimut + (h / hijas) * Math.PI * 2 : azimut + THREE.MathUtils.degToRad((h / Math.max(1, hijas - 1) - 0.5) * 2 * especie.abanico) + (random() - 0.5) * 0.4
      const subida = especie.elevacion[Math.min(especie.elevacion.length - 1, profundidad)] + (random() - 0.5) * 16
      const nueva = haciaAfuera(az, subida)
      const desdeHija = h === 0 ? fin.p : eje(0.6 + random() * 0.4).p
      crecer(desdeHija, nueva, largo * (0.72 + random() * 0.14), radioHija, nivel - 1, az)
    }
  }
  const tope = fuste(1)
  const largo = especie.largo
  crecer(tope, ARRIBA.clone(), largo * 0.35, especie.radio * 0.75, especie.niveles, random() * Math.PI * 2)

  // Hojas, flores y frutos en las puntas.
  for (const { p, tangente } of puntas) {
    if (especie.hoja) hojasDePunta(malla, p, tangente, especie, random, ruido)
    if (especie.flor) floresDePunta(malla, p, tangente, especie.flor, random, ruido)
    if (especie.fruto && random() < (especie.fruto === 'oreja' ? 0.12 : 0.3)) FRUTOS[especie.fruto](malla, p, random, ruido)
  }
}
