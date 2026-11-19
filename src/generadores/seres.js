import * as THREE from 'three'
import { aplicarOclusion, calcularOclusion } from './oclusion.js'

// Seres vivos armados por plan corporal: cuadrupedo, ave, pez y persona.
// Cada ser es una funcion de distancia (SDF): para cualquier punto del
// espacio dice que tan lejos esta de la superficie (negativo = adentro). Se
// arma con piezas (elipsoides para cuerpo y cabeza, capsulas que se afinan
// para patas, cuello, hocico, orejas y cola) unidas con "union suave", que
// las funde como plastilina para que no se noten las costuras.
// Despues, el algoritmo Surface Nets recorre una grilla 3D, encuentra donde
// la funcion pasa de adentro a afuera y arma la malla justo ahi.
// Cada vertice toma el color de la pieza mas cercana (cuerpo, detalles, ojos).

export const SERES = ['cuadrupedo', 'ave', 'pez', 'persona']

const MEDIDA = 12 // medida mas grande del ser armado
const DIVISIONES = 96 // celdas de la grilla en la medida mas grande

// ---------- Piezas (funciones de distancia) ----------

const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const largo = (a) => Math.hypot(a[0], a[1], a[2])

// Capsula que se afina: de "a" (radio ra) a "b" (radio rb).
function capsula(a, b, ra, rb, zona) {
  const ba = resta(b, a)
  const largoBa = punto(ba, ba)
  return {
    zona,
    caja: [Math.min(a[0], b[0]) - ra, Math.min(a[1], b[1]) - ra, Math.min(a[2], b[2]) - ra,
      Math.max(a[0], b[0]) + ra, Math.max(a[1], b[1]) + ra, Math.max(a[2], b[2]) + ra],
    distancia(p) {
      const pa = resta(p, a)
      const h = Math.min(1, Math.max(0, punto(pa, ba) / largoBa))
      return largo([pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h]) - (ra + (rb - ra) * h)
    },
  }
}

// Elipsoide con centro "c" y radios en cada eje (distancia aproximada).
function elipsoide(c, radios, zona) {
  return {
    zona,
    caja: [c[0] - radios[0], c[1] - radios[1], c[2] - radios[2], c[0] + radios[0], c[1] + radios[1], c[2] + radios[2]],
    distancia(p) {
      const q = resta(p, c)
      const k0 = largo([q[0] / radios[0], q[1] / radios[1], q[2] / radios[2]])
      const k1 = largo([q[0] / radios[0] ** 2, q[1] / radios[1] ** 2, q[2] / radios[2] ** 2])
      return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(...radios)
    },
  }
}

const esfera = (c, r, zona) => elipsoide(c, [r, r, r], zona)

// Union suave: como el minimo, pero redondea la union en un ancho "k".
function minimoSuave(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

// Pares izquierdo y derecho de una pieza (patas, orejas, ojos).
const espejo = (crear) => [crear(1), crear(-1)]

// ---------- Planes corporales ----------

// Medidas por especie. Las que falten se toman de la especie base de cada plan.
const ESPECIES = {
  // cuerpo: [largo, alto, ancho]; patas: [largo, grosor]; cuello: [largo, angulo, grosor];
  // cabeza: radio; hocico: [largo, grosor]; cola: [largo, grosor, angulo]
  perro: { cuerpo: [3.2, 1.1, 1.1], patas: [1.8, 0.28], cuello: [1, 50, 0.45], cabeza: 0.75, hocico: [0.75, 0.32], orejas: 'caidas', cola: [1.3, 0.14, 35], colores: [[150, 105, 60], [205, 175, 135], [35, 28, 24]] },
  lobo: { orejas: 'puntiagudas', cola: [1.5, 0.22, -20], colores: [[120, 115, 108], [200, 195, 185], [30, 28, 26]] },
  zorro: { cuerpo: [2.8, 0.9, 0.9], patas: [1.4, 0.2], orejas: 'puntiagudas', hocico: [0.85, 0.25], cola: [1.8, 0.35, -10], colores: [[205, 105, 40], [240, 230, 215], [35, 25, 20]] },
  gato: { cuerpo: [2.8, 0.9, 0.9], patas: [1.5, 0.22], cuello: [0.6, 55, 0.4], cabeza: 0.7, hocico: [0.25, 0.3], orejas: 'puntiagudas', cola: [2, 0.13, 60], colores: [[140, 125, 110], [225, 215, 200], [40, 35, 30]] },
  leon: { cuerpo: [3.6, 1.3, 1.2], patas: [2, 0.36], cabeza: 0.85, hocico: [0.55, 0.42], orejas: 'redondas', cola: [2, 0.12, -30], extra: 'melena', colores: [[200, 160, 100], [160, 105, 55], [40, 30, 25]] },
  tigre: { cuerpo: [3.8, 1.2, 1.2], patas: [1.9, 0.36], cabeza: 0.85, hocico: [0.5, 0.42], orejas: 'redondas', cola: [2.2, 0.14, -20], colores: [[215, 120, 45], [240, 235, 220], [30, 25, 22]] },
  oso: { cuerpo: [3.6, 1.6, 1.6], patas: [1.6, 0.55], cuello: [0.6, 30, 0.8], cabeza: 0.95, hocico: [0.55, 0.45], orejas: 'redondas', cola: [0.3, 0.2, 0], colores: [[95, 65, 45], [125, 90, 62], [25, 20, 18]] },
  caballo: { cuerpo: [4.2, 1.35, 1.2], patas: [3.2, 0.3], cuello: [2.2, 55, 0.6], cabeza: 0.65, hocico: [1.5, 0.42], orejas: 'puntiagudas', cola: [2.2, 0.25, -60], pezunas: true, colores: [[120, 75, 45], [80, 50, 32], [30, 24, 20]] },
  vaca: { cuerpo: [4.4, 1.7, 1.6], patas: [2.4, 0.4], cuello: [1.1, 25, 0.75], cabeza: 0.8, hocico: [0.9, 0.55], orejas: 'redondas', cola: [2.2, 0.1, -70], extra: 'cuernos', pezunas: true, colores: [[245, 245, 240], [45, 40, 38], [35, 30, 28]] },
  oveja: { cuerpo: [3.2, 1.6, 1.6], patas: [1.6, 0.22], cuello: [0.7, 40, 0.5], cabeza: 0.6, hocico: [0.6, 0.35], orejas: 'caidas', cola: [0.4, 0.2, -50], pezunas: true, colores: [[235, 230, 215], [45, 40, 38], [30, 28, 26]] },
  cerdo: { cuerpo: [3.4, 1.5, 1.4], patas: [1, 0.32], cuello: [0.3, 20, 0.8], cabeza: 0.85, hocico: [0.55, 0.42], orejas: 'puntiagudas', cola: [0.5, 0.08, 40], pezunas: true, colores: [[240, 180, 175], [225, 150, 150], [60, 40, 40]] },
  conejo: { cuerpo: [2.2, 1.1, 1.1], patas: [0.7, 0.3], cuello: [0.4, 60, 0.5], cabeza: 0.7, hocico: [0.3, 0.32], orejas: 'largas', cola: [0.3, 0.3, 30], colores: [[200, 185, 165], [245, 240, 230], [40, 30, 30]] },
  raton: { cuerpo: [1.8, 0.75, 0.75], patas: [0.5, 0.14], cuello: [0.3, 30, 0.35], cabeza: 0.5, hocico: [0.55, 0.25], orejas: 'redondas', cola: [2.2, 0.06, 10], colores: [[150, 145, 140], [215, 205, 200], [30, 28, 28]] },
  elefante: { cuerpo: [4.6, 2.2, 2], patas: [2.6, 0.75], cuello: [0.5, 10, 1.4], cabeza: 1.3, hocico: [0.6, 0.6], orejas: 'grandes', cola: [1.5, 0.1, -70], extra: 'trompa', colores: [[130, 125, 120], [110, 105, 100], [40, 38, 36]] },
  jirafa: { cuerpo: [3.4, 1.3, 1.1], patas: [4, 0.26], cuello: [4.2, 72, 0.4], cabeza: 0.55, hocico: [0.9, 0.3], orejas: 'puntiagudas', cola: [1.6, 0.1, -60], extra: 'osiconos', pezunas: true, colores: [[220, 170, 90], [140, 85, 45], [40, 30, 25]] },

  // Aves. cuerpo: [largo, alto, ancho]; alas: [largo, ancho]; pico: [largo, grosor]
  ave: { cuerpo: [2.6, 1.6, 1.5], cuello: [0.5, 60, 0.6], cabeza: 0.75, pico: [0.7, 0.24], alas: [2.2, 1.1], patas: [1.4, 0.1], cola: [1.4, 0.8], colores: [[120, 100, 80], [200, 180, 150], [235, 175, 40]] },
  gallina: { cuerpo: [2.8, 2, 1.8], cuello: [0.7, 65, 0.7], pico: [0.45, 0.2], cola: [1.5, 1.2], extra: 'cresta', colores: [[230, 225, 215], [200, 40, 35], [235, 180, 50]] },
  pato: { cuerpo: [3, 1.6, 1.7], cuello: [1, 70, 0.55], pico: [0.9, 0.3], patas: [0.8, 0.12], colores: [[240, 240, 235], [230, 230, 225], [240, 150, 30]] },
  aguila: { cuerpo: [2.8, 1.6, 1.4], alas: [3, 1.3], pico: [0.6, 0.28], colores: [[95, 70, 45], [240, 240, 235], [235, 190, 50]] },
  loro: { colores: [[40, 160, 60], [220, 40, 40], [40, 40, 40]] },
  pinguino: { cuerpo: [1.8, 3.2, 1.6], erguido: true, cuello: [0.2, 90, 0.8], alas: [1.8, 0.5], patas: [0.4, 0.15], cola: [0.4, 0.4], colores: [[30, 32, 38], [240, 240, 235], [235, 150, 40]] },

  // Peces. cuerpo: [largo, alto, ancho]; aleta: tamano de la cola
  pez: { cuerpo: [5, 1.8, 0.9], aleta: 1.6, colores: [[150, 160, 170], [225, 225, 220], [30, 30, 35]] },
  tiburon: { cuerpo: [7, 1.7, 1.4], aleta: 2.2, colores: [[110, 120, 130], [230, 230, 225], [25, 25, 28]] },

  // Persona. alto total aproximado
  persona: { alto: 9, colores: [[60, 90, 150], [225, 180, 150], [45, 35, 30]] },
}

const BASE = { cuadrupedo: 'perro', ave: 'ave', pez: 'pez', persona: 'persona' }

// Palabras que se refieren a una especie ya definida.
const ALIAS = {
  perra: 'perro', cachorro: 'perro', yegua: 'caballo', toro: 'vaca', cordero: 'oveja', chancho: 'cerdo',
  pajaro: 'ave', paloma: 'ave', pescado: 'pez', hombre: 'persona', mujer: 'persona', nino: 'persona',
  nina: 'persona', humano: 'persona', leona: 'leon', gata: 'gato', loba: 'lobo', osa: 'oso',
}

function cuadrupedo(e) {
  const [largoC, altoC, anchoC] = e.cuerpo
  const [largoP, grosorP] = e.patas
  const [largoCu, anguloCu, grosorCu] = e.cuello
  const alturaCuerpo = largoP + altoC * 0.35
  const piezas = [elipsoide([0, alturaCuerpo, 0], [largoC / 2, altoC / 2, anchoC / 2], 'cuerpo')]

  // Patas: delanteras y traseras, con pezunas oscuras si corresponde.
  for (const lado of [1, -1]) {
    for (const x of [largoC / 2 - grosorP * 1.6, -largoC / 2 + grosorP * 1.6]) {
      const z = lado * (anchoC / 2 - grosorP * 0.8)
      piezas.push(capsula([x, alturaCuerpo, z], [x, grosorP, z], grosorP * 1.15, grosorP * 0.85, 'pata'))
      if (e.pezunas) piezas.push(capsula([x, grosorP * 1.2, z], [x, grosorP * 0.6, z], grosorP * 0.9, grosorP * 0.9, 'oscuro'))
    }
  }

  // Cuello y cabeza, segun el angulo del cuello.
  const angulo = THREE.MathUtils.degToRad(anguloCu)
  const inicioCuello = [largoC / 2 - grosorCu * 0.6, alturaCuerpo + altoC * 0.15, 0]
  const finCuello = [inicioCuello[0] + Math.cos(angulo) * largoCu, inicioCuello[1] + Math.sin(angulo) * largoCu, 0]
  piezas.push(capsula(inicioCuello, finCuello, grosorCu, grosorCu * 0.8, 'cuerpo'))
  const cabeza = [finCuello[0] + e.cabeza * 0.4, finCuello[1] + e.cabeza * 0.2, 0]
  piezas.push(esfera(cabeza, e.cabeza, 'cuerpo'))

  // Hocico, nariz y ojos.
  const [largoH, grosorH] = e.hocico
  const puntaHocico = [cabeza[0] + e.cabeza * 0.6 + largoH, cabeza[1] - e.cabeza * 0.3, 0]
  piezas.push(capsula([cabeza[0] + e.cabeza * 0.3, cabeza[1] - e.cabeza * 0.15, 0], puntaHocico, grosorH * 1.2, grosorH, 'detalle'))
  piezas.push(esfera([puntaHocico[0] + grosorH * 0.6, puntaHocico[1] + grosorH * 0.35, 0], grosorH * 0.45, 'oscuro'))
  piezas.push(...espejo((lado) => esfera([cabeza[0] + e.cabeza * 0.62, cabeza[1] + e.cabeza * 0.32, lado * e.cabeza * 0.5], e.cabeza * 0.14, 'ojo')))

  // Orejas segun su tipo.
  const tope = [cabeza[0] - e.cabeza * 0.15, cabeza[1] + e.cabeza * 0.75]
  const r = e.cabeza
  const orejas = {
    puntiagudas: (l) => capsula([tope[0], tope[1], l * r * 0.45], [tope[0] - r * 0.1, tope[1] + r * 0.7, l * r * 0.55], r * 0.28, r * 0.05, 'cuerpo'),
    caidas: (l) => capsula([tope[0], tope[1], l * r * 0.6], [tope[0] + r * 0.1, tope[1] - r * 0.9, l * r * 0.95], r * 0.26, r * 0.22, 'detalle'),
    redondas: (l) => elipsoide([tope[0], tope[1], l * r * 0.55], [r * 0.12, r * 0.3, r * 0.3], 'cuerpo'),
    largas: (l) => capsula([tope[0], tope[1], l * r * 0.3], [tope[0] - r * 0.4, tope[1] + r * 2.2, l * r * 0.45], r * 0.22, r * 0.18, 'cuerpo'),
    grandes: (l) => elipsoide([cabeza[0] - r * 0.3, cabeza[1], l * r * 1.1], [r * 0.15, r * 1, r * 0.8], 'cuerpo'),
  }
  if (orejas[e.orejas]) piezas.push(...espejo(orejas[e.orejas]))

  // Cola.
  const [largoCo, grosorCo, anguloCo] = e.cola
  const anguloCola = THREE.MathUtils.degToRad(180 - anguloCo)
  const inicioCola = [-largoC / 2 + grosorCo, alturaCuerpo + altoC * 0.2, 0]
  piezas.push(capsula(inicioCola, [inicioCola[0] + Math.cos(anguloCola) * largoCo, inicioCola[1] + Math.sin(anguloCola) * largoCo, 0], grosorCo, grosorCo * 0.6, 'cuerpo'))

  // Rasgos propios de algunas especies.
  if (e.extra === 'melena') piezas.push(esfera([cabeza[0] - r * 0.5, cabeza[1] - r * 0.1, 0], r * 1.45, 'detalle'))
  if (e.extra === 'cuernos') {
    piezas.push(...espejo((l) => capsula([tope[0] + r * 0.2, tope[1], l * r * 0.3], [tope[0] + r * 0.3, tope[1] + r * 0.6, l * r * 0.95], r * 0.14, r * 0.05, 'claro')))
  }
  if (e.extra === 'osiconos') {
    piezas.push(...espejo((l) => capsula([tope[0] + r * 0.2, tope[1], l * r * 0.2], [tope[0] + r * 0.2, tope[1] + r * 0.6, l * r * 0.25], r * 0.1, r * 0.12, 'oscuro')))
  }
  if (e.extra === 'trompa') {
    piezas.push(capsula(puntaHocico, [puntaHocico[0] + r * 0.4, puntaHocico[1] - r * 2.2, 0], grosorH, grosorH * 0.5, 'cuerpo'))
    piezas.push(...espejo((l) => capsula([puntaHocico[0] - r * 0.3, puntaHocico[1], l * r * 0.4], [puntaHocico[0] + r * 0.6, puntaHocico[1] - r * 0.4, l * r * 0.5], r * 0.12, r * 0.08, 'claro')))
  }
  return piezas
}

function ave(e) {
  const [largoC, altoC, anchoC] = e.cuerpo
  const [largoP, grosorP] = e.patas
  const alturaCuerpo = largoP + altoC * 0.4
  // Las aves erguidas (pinguino) ya traen el cuerpo mas alto que largo.
  const piezas = [elipsoide([0, alturaCuerpo, 0], [largoC / 2, altoC / 2, anchoC / 2], 'cuerpo')]
  const frente = e.erguido ? largoC * 0.15 : largoC / 2

  // Cuello, cabeza, pico y ojos.
  const angulo = THREE.MathUtils.degToRad(e.cuello[1])
  const inicioCuello = [frente * 0.7, alturaCuerpo + altoC * 0.3, 0]
  const finCuello = [inicioCuello[0] + Math.cos(angulo) * e.cuello[0], inicioCuello[1] + Math.sin(angulo) * e.cuello[0], 0]
  piezas.push(capsula(inicioCuello, finCuello, e.cuello[2], e.cuello[2] * 0.85, 'cuerpo'))
  const cabeza = [finCuello[0] + e.cabeza * 0.2, finCuello[1] + e.cabeza * 0.5, 0]
  piezas.push(esfera(cabeza, e.cabeza, 'cuerpo'))
  const [largoPico, grosorPico] = e.pico
  piezas.push(capsula([cabeza[0] + e.cabeza * 0.7, cabeza[1] - e.cabeza * 0.1, 0], [cabeza[0] + e.cabeza * 0.7 + largoPico, cabeza[1] - e.cabeza * 0.25, 0], grosorPico, grosorPico * 0.15, 'pico'))
  piezas.push(...espejo((l) => esfera([cabeza[0] + e.cabeza * 0.45, cabeza[1] + e.cabeza * 0.25, l * e.cabeza * 0.65], e.cabeza * 0.15, 'ojo')))
  if (e.extra === 'cresta') piezas.push(elipsoide([cabeza[0], cabeza[1] + e.cabeza * 0.9, 0], [e.cabeza * 0.5, e.cabeza * 0.4, e.cabeza * 0.12], 'detalle'))

  // Alas a los costados, aplastadas y pegadas al cuerpo.
  const [largoA, anchoA] = e.alas
  piezas.push(...espejo((l) => elipsoide([-largoA * 0.1, alturaCuerpo + altoC * 0.1, l * anchoC / 2], [largoA / 2, anchoA / 2, 0.15], 'detalle')))
  // Cola aplastada hacia atras.
  piezas.push(elipsoide([-largoC / 2 * (e.erguido ? 0.3 : 1) - e.cola[0] * 0.3, alturaCuerpo - (e.erguido ? altoC * 0.4 : 0), 0], [e.cola[0] / 2, 0.12, e.cola[1] / 2], 'detalle'))
  // Patas finas con dedos.
  for (const l of [1, -1]) {
    const z = l * anchoC * 0.22
    piezas.push(capsula([0, alturaCuerpo - altoC * 0.3, z], [0, grosorP, z], grosorP * 1.6, grosorP, 'pico'))
    piezas.push(capsula([0, grosorP, z], [grosorP * 5, grosorP, z], grosorP, grosorP * 0.8, 'pico'))
  }
  return piezas
}

function pez(e) {
  const [largoC, altoC, anchoC] = e.cuerpo
  const altura = altoC * 0.8
  const piezas = [elipsoide([0, altura, 0], [largoC / 2, altoC / 2, anchoC / 2], 'cuerpo')]
  // Panza clara: un elipsoide apenas mas abajo, del color secundario.
  piezas.push(elipsoide([largoC * 0.05, altura - altoC * 0.12, 0], [largoC * 0.42, altoC * 0.38, anchoC * 0.45], 'detalle'))
  // Cola en V, aleta dorsal, aletas laterales y ojos.
  const cola = [-largoC / 2, altura, 0]
  piezas.push(capsula(cola, [cola[0] - e.aleta, cola[1] + e.aleta * 0.7, 0], 0.25, 0.08, 'cuerpo'))
  piezas.push(capsula(cola, [cola[0] - e.aleta, cola[1] - e.aleta * 0.6, 0], 0.25, 0.08, 'cuerpo'))
  piezas.push(capsula([largoC * 0.1, altura + altoC * 0.35, 0], [-largoC * 0.15, altura + altoC * 0.85, 0], 0.18, 0.05, 'cuerpo'))
  piezas.push(...espejo((l) => capsula([largoC * 0.2, altura - altoC * 0.15, l * anchoC * 0.4], [-largoC * 0.05, altura - altoC * 0.4, l * anchoC * 0.9], 0.12, 0.04, 'cuerpo')))
  piezas.push(...espejo((l) => esfera([largoC * 0.36, altura + altoC * 0.12, l * anchoC * 0.32], altoC * 0.09, 'ojo')))
  return piezas
}

function persona(e) {
  const k = e.alto / 9
  const piezas = [
    capsula([0, 5.1 * k, 0], [0, 6.9 * k, 0], 0.95 * k, 0.85 * k, 'cuerpo'), // torso
    capsula([0, 4.6 * k, 0], [0, 5.2 * k, 0], 0.85 * k, 0.9 * k, 'cuerpo'), // cadera
    capsula([0, 7.2 * k, 0], [0, 7.6 * k, 0], 0.3 * k, 0.3 * k, 'detalle'), // cuello
    esfera([0, 8.2 * k, 0], 0.62 * k, 'detalle'), // cabeza
    elipsoide([-0.08 * k, 8.4 * k, 0], [0.66 * k, 0.48 * k, 0.66 * k], 'oscuro'), // pelo
  ]
  piezas.push(...espejo((l) => esfera([0.5 * k, 8.3 * k, l * 0.22 * k], 0.08 * k, 'ojo')))
  // Brazos y manos.
  piezas.push(...espejo((l) => capsula([0, 6.9 * k, l * 1.15 * k], [0.15 * k, 4.9 * k, l * 1.35 * k], 0.3 * k, 0.24 * k, 'cuerpo')))
  piezas.push(...espejo((l) => esfera([0.18 * k, 4.6 * k, l * 1.37 * k], 0.24 * k, 'detalle')))
  // Piernas y zapatos.
  piezas.push(...espejo((l) => capsula([0, 4.6 * k, l * 0.45 * k], [0, 0.45 * k, l * 0.5 * k], 0.42 * k, 0.28 * k, 'pata')))
  piezas.push(...espejo((l) => elipsoide([0.2 * k, 0.22 * k, l * 0.5 * k], [0.45 * k, 0.22 * k, 0.26 * k], 'oscuro')))
  return piezas
}

const PLANES = { cuadrupedo, ave, pez, persona }

// ---------- Surface Nets ----------

// Recorre la grilla: en cada celda donde la funcion cambia de signo pone un
// vertice en el promedio de los cruces por cero de sus aristas; despues une
// con un cuadrado los vertices de las 4 celdas que rodean cada arista de la
// grilla que cruza la superficie.
function redesDeSuperficie(distanciaEn, minimo, paso, tam) {
  const [nx, ny, nz] = tam
  const valores = new Float32Array(nx * ny * nz)
  const idx = (x, y, z) => (z * ny + y) * nx + x
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        valores[idx(x, y, z)] = distanciaEn([minimo[0] + x * paso, minimo[1] + y * paso, minimo[2] + z * paso])
      }
    }
  }

  const posiciones = []
  const celda = new Int32Array(nx * ny * nz).fill(-1)
  const esquinas = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]
  const aristas = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
        const v = esquinas.map(([dx, dy, dz]) => valores[idx(x + dx, y + dy, z + dz)])
        if (v.every((d) => d < 0) || v.every((d) => d >= 0)) continue
        const suma = [0, 0, 0]
        let cruces = 0
        for (const [a, b] of aristas) {
          if (v[a] < 0 === v[b] < 0) continue
          const t = v[a] / (v[a] - v[b])
          for (let c = 0; c < 3; c++) suma[c] += esquinas[a][c] + (esquinas[b][c] - esquinas[a][c]) * t
          cruces++
        }
        celda[idx(x, y, z)] = posiciones.length / 3
        posiciones.push(
          minimo[0] + (x + suma[0] / cruces) * paso,
          minimo[1] + (y + suma[1] / cruces) * paso,
          minimo[2] + (z + suma[2] / cruces) * paso,
        )
      }
    }
  }

  // Cuadrados: uno por cada arista de la grilla que cruza la superficie. La
  // orientacion se corrige despues mirando hacia donde crece la distancia.
  const indices = []
  const cuadrado = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    indices.push(a, b, c, a, c, d)
  }
  for (let z = 1; z < nz - 1; z++) {
    for (let y = 1; y < ny - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const aca = valores[idx(x, y, z)] < 0
        if (x < nx - 1 && aca !== valores[idx(x + 1, y, z)] < 0) {
          cuadrado(celda[idx(x, y - 1, z - 1)], celda[idx(x, y, z - 1)], celda[idx(x, y, z)], celda[idx(x, y - 1, z)])
        }
        if (y < ny - 1 && aca !== valores[idx(x, y + 1, z)] < 0) {
          cuadrado(celda[idx(x - 1, y, z - 1)], celda[idx(x, y, z - 1)], celda[idx(x, y, z)], celda[idx(x - 1, y, z)])
        }
        if (z < nz - 1 && aca !== valores[idx(x, y, z + 1)] < 0) {
          cuadrado(celda[idx(x - 1, y - 1, z)], celda[idx(x, y - 1, z)], celda[idx(x, y, z)], celda[idx(x - 1, y, z)])
        }
      }
    }
  }

  // Cada triangulo debe mirar hacia afuera: hacia donde la distancia crece.
  const e = paso * 0.5
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]].map((i) => posiciones.slice(i * 3, i * 3 + 3))
    const normal = [
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ]
    const centro = [0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3)
    const afuera = [0, 1, 2].map((k) => {
      const mas = [...centro]
      const menos = [...centro]
      mas[k] += e
      menos[k] -= e
      return distanciaEn(mas) - distanciaEn(menos)
    })
    if (punto(normal, afuera) < 0) [indices[t + 1], indices[t + 2]] = [indices[t + 2], indices[t + 1]]
  }
  return { posiciones, indices }
}

// ---------- Armado ----------

function luminancia([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// Colores de cada zona. Si hay una foto analizada, el cuerpo toma su color
// principal y los detalles el segundo; los ojos y lo oscuro siguen oscuros.
// En una persona el "detalle" es la piel, que no se toma de la foto.
function coloresDeZonas(plan, especie, regiones, receta) {
  let [cuerpo, detalle, oscuro] = especie.colores
  if (regiones) {
    const partes = [...regiones.paleta.values()].sort((a, b) => b.peso - a.peso).map((r) => r.color)
    cuerpo = partes[0] ?? cuerpo
    if (plan !== 'persona') {
      detalle = partes.find((color, i) => i > 0 && Math.abs(luminancia(color) - luminancia(cuerpo)) > 25) ?? detalle
    }
  }
  if (receta.colorElegido) cuerpo = [1, 3, 5].map((i) => parseInt(receta.color.slice(i, i + 2), 16))
  return {
    cuerpo,
    pata: plan === 'persona' ? [55, 65, 95] : cuerpo,
    detalle,
    oscuro,
    claro: [230, 225, 210],
    pico: especie.colores[2],
    ojo: [15, 12, 12],
  }
}

export function crearSer(receta, apariencia) {
  const plan = receta.tipo
  const especie = { ...ESPECIES[BASE[plan]], ...ESPECIES[ALIAS[receta.palabra] ?? receta.palabra] }
  const piezas = PLANES[plan](especie)

  // Distancia del ser: union suave del cuerpo; ojos, nariz y pezunas se pegan
  // con una union mas firme para que no se derritan.
  const firmes = new Set(['ojo', 'oscuro', 'pico'])
  const distanciaEn = (p) => {
    let d = Infinity
    for (const pieza of piezas) {
      const dp = pieza.distancia(p)
      d = d === Infinity ? dp : minimoSuave(d, dp, firmes.has(pieza.zona) ? 0.08 : 0.35)
    }
    return d
  }

  // Grilla que envuelve a todas las piezas, con un margen.
  const minimo = [0, 1, 2].map((k) => Math.min(...piezas.map((p) => p.caja[k])) - 0.4)
  const maximo = [0, 1, 2].map((k) => Math.max(...piezas.map((p) => p.caja[k + 3])) + 0.4)
  const paso = Math.max(...maximo.map((v, k) => v - minimo[k])) / DIVISIONES
  const tam = maximo.map((v, k) => Math.ceil((v - minimo[k]) / paso) + 1)
  const { posiciones, indices } = redesDeSuperficie(distanciaEn, minimo, paso, tam)

  // Color de cada vertice: el de la pieza mas cercana.
  const zonas = coloresDeZonas(plan, especie, apariencia.regiones, receta)
  const colores = []
  const color = new THREE.Color()
  for (let i = 0; i < posiciones.length; i += 3) {
    const p = [posiciones[i], posiciones[i + 1], posiciones[i + 2]]
    let cercana = piezas[0]
    let menor = Infinity
    for (const pieza of piezas) {
      const d = pieza.distancia(p) - (firmes.has(pieza.zona) ? 0.04 : 0)
      if (d < menor) {
        menor = d
        cercana = pieza
      }
    }
    const rgb = zonas[cercana.zona]
    color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace)
    colores.push(color.r, color.g, color.b)
  }

  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3))
  geometria.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3))
  geometria.setIndex(indices)

  // Se escala a una medida comun, se centra y se apoya en el piso.
  geometria.computeBoundingBox()
  const caja = geometria.boundingBox
  const medidas = caja.getSize(new THREE.Vector3())
  const centro = caja.getCenter(new THREE.Vector3())
  geometria.translate(-centro.x, -caja.min.y, -centro.z)
  geometria.scale(...Array(3).fill((MEDIDA * receta.tamano) / Math.max(medidas.x, medidas.y, medidas.z)))
  geometria.computeVertexNormals()
  aplicarOclusion(geometria, calcularOclusion(geometria))
  geometria.computeBoundingBox()
  return { geometria, altura: geometria.boundingBox.max.y }
}
