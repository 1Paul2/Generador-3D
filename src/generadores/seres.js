import * as THREE from 'three'
import { aplicarOclusion, calcularOclusion } from './oclusion.js'
import { crearRuido } from '../utils/ruido.js'
import { crearRandom, semillaDeTexto } from '../utils/random.js'

// Seres vivos armados por plan corporal: cuadrupedo, ave, pez y persona.
// Cada ser es una funcion de distancia (SDF): para cualquier punto del
// espacio dice que tan lejos esta de la superficie (negativo = adentro). Se
// arma con piezas (elipsoides para cuerpo y cabeza, capsulas que se afinan
// para patas, cuello, hocico, orejas y cola) unidas con "union suave", que
// las funde como plastilina para que no se noten las costuras.
// Despues, el algoritmo Surface Nets recorre una grilla 3D, encuentra donde
// la funcion pasa de adentro a afuera y arma la malla justo ahi.
// Cada vertice toma el color de la pieza mas cercana (cuerpo, detalles, ojos),
// fundido con la vecina, con el patron del pelaje de la especie y su grano.

export const SERES = ['cuadrupedo', 'ave', 'pez', 'persona']

const MEDIDA = 12 // medida mas grande del ser armado
const DIVISIONES = 150 // celdas de la grilla en la medida mas grande

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
  // curva: cuanto se dobla la cola en cada tramo (grados);
  // patron del pelaje: 'rayas', 'manchas', 'parches' o 'reticulado';
  // vientre: cuanto se aclara la panza (0 = nada, 1 = del todo al color claro);
  // pelo: largo del pelaje (1 = normal);
  // colorDeFoto: el color del pelaje varia segun la raza y se toma de la foto;
  // colorHocico: el hocico tiene un color propio (la cara blanca de la vaca).
  perro: { colorDeFoto: true, vientre: 0.6, cuerpo: [3.2, 1.1, 1.1], patas: [2.3, 0.26], cuello: [1, 50, 0.45], cabeza: 0.75, hocico: [0.75, 0.32], orejas: 'caidas', cola: [1.3, 0.14, 35], colores: [[150, 105, 60], [205, 175, 135], [35, 28, 24]] },
  lobo: { orejas: 'puntiagudas', cola: [1.5, 0.22, -20], colores: [[120, 115, 108], [200, 195, 185], [30, 28, 26]] },
  zorro: { cuerpo: [2.8, 0.9, 0.9], patas: [1.4, 0.2], orejas: 'puntiagudas', hocico: [0.85, 0.25], cola: [1.8, 0.35, -10], colores: [[205, 105, 40], [240, 230, 215], [35, 25, 20]] },
  gato: { colorDeFoto: true, cuerpo: [2.8, 0.9, 0.9], patas: [1.9, 0.2], cuello: [0.6, 55, 0.4], cabeza: 0.7, hocico: [0.25, 0.3], orejas: 'puntiagudas', cola: [2, 0.13, 60], colores: [[140, 125, 110], [225, 215, 200], [40, 35, 30]] },
  leon: { cuerpo: [4.2, 1.35, 1.2], patas: [2.2, 0.36], cabeza: 0.85, hocico: [0.42, 0.46], orejas: 'redondas', cola: [2, 0.12, -30], extra: 'melena', colores: [[200, 160, 100], [160, 105, 55], [40, 30, 25]] },
  tigre: { patron: 'rayas', vientre: 0.8, cuerpo: [3.8, 1.2, 1.2], patas: [1.9, 0.36], cabeza: 0.85, hocico: [0.5, 0.42], orejas: 'redondas', cola: [2.2, 0.14, -20], colores: [[215, 120, 45], [240, 235, 220], [30, 25, 22]] },
  oso: { cuerpo: [3.6, 1.6, 1.6], patas: [1.6, 0.55], cuello: [0.6, 30, 0.8], cabeza: 0.95, hocico: [0.55, 0.45], orejas: 'redondas', cola: [0.3, 0.2, 0], colores: [[95, 65, 45], [125, 90, 62], [25, 20, 18]] },
  caballo: { colorDeFoto: true, vientre: 0.15, pelo: 0.4, cuerpo: [4.2, 1.35, 1.2], patas: [3.2, 0.3], cuello: [2.2, 55, 0.6], cabeza: 0.65, hocico: [1.5, 0.42], orejas: 'puntiagudas', cola: [2.2, 0.25, -60], pezunas: true, colores: [[120, 75, 45], [80, 50, 32], [30, 24, 20]] },
  vaca: { patron: 'parches', vientre: 0, pelo: 0.35, cuerpo: [4.4, 1.7, 1.6], patas: [2.4, 0.4], cuello: [1.1, 25, 0.75], cabeza: 0.8, hocico: [0.9, 0.55], orejas: 'redondas', cola: [2.2, 0.1, -70], colorHocico: [238, 232, 226], extra: 'cuernos', pezunas: true, colores: [[245, 245, 240], [45, 40, 38], [35, 30, 28]] },
  oveja: { vientre: 0, pelo: 2.6, cuerpo: [3.2, 1.6, 1.6], patas: [1.6, 0.22], cuello: [0.7, 40, 0.5], cabeza: 0.6, hocico: [0.6, 0.35], orejas: 'caidas', cola: [0.4, 0.2, -50], pezunas: true, colores: [[235, 230, 215], [45, 40, 38], [30, 28, 26]] },
  cerdo: { vientre: 0, pelo: 0.2, cuerpo: [3.4, 1.5, 1.4], patas: [1, 0.32], cuello: [0.3, 20, 0.8], cabeza: 0.85, hocico: [0.55, 0.42], orejas: 'puntiagudas', cola: [0.5, 0.08, 40], pezunas: true, colores: [[240, 180, 175], [225, 150, 150], [60, 40, 40]] },
  conejo: { colorDeFoto: true, cuerpo: [2.2, 1.1, 1.1], patas: [0.7, 0.3], cuello: [0.4, 60, 0.5], cabeza: 0.7, hocico: [0.3, 0.32], orejas: 'largas', cola: [0.3, 0.3, 30], colores: [[200, 185, 165], [245, 240, 230], [40, 30, 30]] },
  cebra: { patron: 'rayas', vientre: 0, pelo: 0.4, cuerpo: [4, 1.3, 1.1], patas: [2.9, 0.28], cuello: [2, 55, 0.55], cabeza: 0.62, hocico: [1.3, 0.4], orejas: 'puntiagudas', cola: [1.8, 0.12, -60], pezunas: true, colores: [[240, 240, 235], [240, 240, 235], [25, 25, 25]] },
  leopardo: { patron: 'manchas', vientre: 0.7, cuerpo: [3.6, 1.1, 1], patas: [2.2, 0.27], cuello: [0.8, 40, 0.5], cabeza: 0.7, hocico: [0.35, 0.38], orejas: 'redondas', cola: [2.6, 0.15, -15], curva: -15, colores: [[215, 165, 85], [240, 230, 210], [35, 28, 22]] },
  raton: { cuerpo: [1.8, 0.75, 0.75], patas: [0.5, 0.14], cuello: [0.3, 30, 0.35], cabeza: 0.5, hocico: [0.55, 0.25], orejas: 'redondas', cola: [2.2, 0.06, 10], colores: [[150, 145, 140], [215, 205, 200], [30, 28, 28]] },
  elefante: { vientre: 0, pelo: 0.3, cuerpo: [4.6, 2.2, 2], patas: [2.6, 0.75], cuello: [0.5, 10, 1.4], cabeza: 1.3, hocico: [0.6, 0.6], orejas: 'grandes', cola: [1.5, 0.1, -70], extra: 'trompa', colores: [[130, 125, 120], [110, 105, 100], [40, 38, 36]] },
  jirafa: { patron: 'reticulado', vientre: 0.3, cuerpo: [3.4, 1.3, 1.1], patas: [4, 0.26], cuello: [4.2, 72, 0.4], cabeza: 0.55, hocico: [0.9, 0.3], orejas: 'puntiagudas', cola: [1.6, 0.1, -60], extra: 'osiconos', pezunas: true, colores: [[220, 170, 90], [140, 85, 45], [40, 30, 25]] },

  // Aves. cuerpo: [largo, alto, ancho]; alas: [largo, ancho]; pico: [largo, grosor]
  ave: { colorDeFoto: true, cuerpo: [2.6, 1.6, 1.5], cuello: [0.5, 60, 0.6], cabeza: 0.75, pico: [0.7, 0.24], alas: [2.2, 1.1], patas: [1.4, 0.1], cola: [1.4, 0.8], colores: [[120, 100, 80], [200, 180, 150], [235, 175, 40]] },
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
  jaguar: 'leopardo', guepardo: 'leopardo', pantera: 'leopardo',
}

// Correccion - Poll: el cuadrupedo tenia patas de tubo con bultos, la cabeza grande y redonda y se veia de peluche
function cuadrupedo(e) {
  const [largoC, altoC, anchoC] = e.cuerpo
  const [largoP, grosorP] = e.patas
  const [largoCu, anguloCu, grosorCu] = e.cuello
  const g = grosorP
  const alturaCuerpo = largoP + altoC * 0.3
  // Medidas tomadas de la anatomia real (en un perro mediano): el pecho es
  // hondo y llega hasta el codo, mas o menos a la mitad de la altura a la cruz;
  // el vientre sube hacia atras ("recogido") y la cadera es casi tan alta como
  // la cruz.
  const piezas = [
    elipsoide([largoC * 0.2, alturaCuerpo - altoC * 0.1, 0], [largoC * 0.31, altoC * 0.6, anchoC * 0.5], 'cuerpo'),
    elipsoide([-largoC * 0.03, alturaCuerpo + altoC * 0.1, 0], [largoC * 0.33, altoC * 0.4, anchoC * 0.44], 'cuerpo'),
    elipsoide([-largoC * 0.3, alturaCuerpo + altoC * 0.04, 0], [largoC * 0.23, altoC * 0.46, anchoC * 0.46], 'cuerpo'),
    // La cruz: el lomo sube un poco sobre los hombros.
    elipsoide([largoC * 0.24, alturaCuerpo + altoC * 0.3, 0], [largoC * 0.16, altoC * 0.3, anchoC * 0.32], 'cuerpo'),
  ]

  // Las partes bajas de las patas se unen con una union angosta: con la ancha
  // del tronco, cada articulacion se inflaba como un bulto.
  const fina = (pieza) => Object.assign(pieza, { union: Math.min(UNION_SUAVE, g * 0.35) })

  // Pie compacto y alargado (no una bola), o una pezuna oscura.
  const pie = (x, z) =>
    e.pezunas
      ? capsula([x, g * 1.1, z], [x + g * 0.15, g * 0.4, z], g * 0.68, g * 0.74, 'oscuro')
      : fina(elipsoide([x + g * 0.25, g * 0.34, z], [g * 0.7, g * 0.34, g * 0.55], 'pata'))

  for (const lado of [1, -1]) {
    // Postura natural: de cada par, una pata un poco adelantada.
    const paso = lado * largoC * 0.035

    // Delanteras: el omoplato (una masa plana al costado del pecho), el brazo
    // que baja hacia atras hasta el codo, el antebrazo recto y delgado, y la
    // cuartilla un poco inclinada hacia adelante.
    const zd = lado * anchoC * 0.3
    const xd = largoC * 0.3
    const hombro = [xd + largoC * 0.04, alturaCuerpo - altoC * 0.05, lado * anchoC * 0.34]
    const codo = [xd - largoC * 0.05 + paso, largoP * 0.66, zd]
    const muneca = [xd + paso, largoP * 0.2, zd]
    piezas.push(elipsoide([xd + largoC * 0.02, alturaCuerpo + altoC * 0.12, lado * anchoC * 0.36], [g * 1.5, altoC * 0.42, g * 0.75], 'cuerpo'))
    piezas.push(capsula(hombro, codo, g * 1.25, g * 0.85, 'pata'))
    piezas.push(fina(capsula(codo, muneca, g * 0.72, g * 0.55, 'pata')))
    piezas.push(fina(capsula(muneca, [muneca[0] + g * 0.35, g * 0.5, zd], g * 0.55, g * 0.52, 'pata')))
    piezas.push(pie(muneca[0] + g * 0.35, zd))

    // Traseras: el anca (muslo ancho que se funde con la cadera), la rodilla
    // hacia adelante, la pierna hacia el corvejon (atras) y el metatarso casi
    // vertical hasta el piso.
    const zt = lado * anchoC * 0.3
    const xt = -largoC * 0.3
    const rodilla = [xt + largoC * 0.07 - paso, largoP * 0.58, zt]
    const corvejon = [xt - largoC * 0.07 - paso, largoP * 0.3, zt]
    piezas.push(elipsoide([xt - largoC * 0.02, alturaCuerpo - altoC * 0.08, lado * anchoC * 0.3], [largoC * 0.15, altoC * 0.5, g * 1.3], 'pata'))
    piezas.push(capsula([xt, alturaCuerpo - altoC * 0.2, zt], rodilla, g * 1.35, g * 0.8, 'pata'))
    piezas.push(fina(capsula(rodilla, corvejon, g * 0.78, g * 0.5, 'pata')))
    piezas.push(fina(capsula(corvejon, [corvejon[0] + g * 0.15, g * 0.5, zt], g * 0.5, g * 0.5, 'pata')))
    piezas.push(pie(corvejon[0] + g * 0.15, zt))
  }

  // Cuello: mas grueso donde nace del pecho.
  const angulo = THREE.MathUtils.degToRad(anguloCu)
  const inicioCuello = [largoC * 0.34, alturaCuerpo + altoC * 0.12, 0]
  const finCuello = [inicioCuello[0] + Math.cos(angulo) * largoCu, inicioCuello[1] + Math.sin(angulo) * largoCu, 0]
  piezas.push(capsula(inicioCuello, finCuello, grosorCu * 1.35, grosorCu * 0.8, 'cuerpo'))

  // Cabeza: un craneo mas largo que alto, la frente, los pomulos y el hocico
  // que sale mas abajo que la frente (el "stop"), con la mandibula debajo.
  const r = e.cabeza
  const cabeza = [finCuello[0] + r * 0.3, finCuello[1] + r * 0.2, 0]
  piezas.push(elipsoide(cabeza, [r * 0.85, r * 0.72, r * 0.68], 'cuerpo'))
  piezas.push(elipsoide([cabeza[0] + r * 0.3, cabeza[1] + r * 0.18, 0], [r * 0.45, r * 0.42, r * 0.55], 'cuerpo'))
  piezas.push(...espejo((l) => elipsoide([cabeza[0] + r * 0.25, cabeza[1] - r * 0.25, l * r * 0.42], [r * 0.4, r * 0.32, r * 0.25], 'cuerpo')))
  const [largoH, grosorH] = e.hocico
  const puntaHocico = [cabeza[0] + r * 0.6 + largoH, cabeza[1] - r * 0.32, 0]
  piezas.push(capsula([cabeza[0] + r * 0.4, cabeza[1] - r * 0.15, 0], puntaHocico, grosorH * 1.1, grosorH * 0.8, 'hocico'))
  piezas.push(capsula([cabeza[0] + r * 0.3, cabeza[1] - r * 0.45, 0], [puntaHocico[0] - grosorH * 0.35, puntaHocico[1] - grosorH * 0.6, 0], grosorH * 0.65, grosorH * 0.4, 'hocico'))
  // Nariz en la punta del hocico; en las caras chatas (gato) es chiquita.
  const nariz = grosorH * 0.38 * Math.min(1, largoH / 0.6)
  piezas.push(esfera([puntaHocico[0] + grosorH * 0.8 - nariz, puntaHocico[1] + grosorH * 0.22, 0], nariz, 'oscuro'))
  // Ojos almendrados bajo la frente, asomando apenas de la superficie de la
  // cara (si quedan adentro del craneo, solo se ve una mancha negra).
  piezas.push(...espejo((l) => elipsoide([cabeza[0] + r * 0.6, cabeza[1] + r * 0.1, l * r * 0.56], [r * 0.12, r * 0.09, r * 0.1], 'ojo')))

  // Orejas segun su tipo.
  const tope = [cabeza[0] - r * 0.1, cabeza[1] + r * 0.58]
  const orejas = {
    puntiagudas: (l) => capsula([tope[0], tope[1], l * r * 0.42], [tope[0] - r * 0.1, tope[1] + r * 0.65, l * r * 0.52], r * 0.26, r * 0.05, 'cuerpo'),
    caidas: (l) => capsula([tope[0], tope[1] - r * 0.05, l * r * 0.55], [tope[0] + r * 0.1, tope[1] - r * 0.85, l * r * 0.78], r * 0.24, r * 0.2, 'detalle'),
    redondas: (l) => elipsoide([tope[0], tope[1], l * r * 0.5], [r * 0.12, r * 0.28, r * 0.28], 'cuerpo'),
    largas: (l) => capsula([tope[0], tope[1], l * r * 0.3], [tope[0] - r * 0.4, tope[1] + r * 2.2, l * r * 0.45], r * 0.22, r * 0.18, 'cuerpo'),
    grandes: (l) => elipsoide([cabeza[0] - r * 0.3, cabeza[1], l * r * 1.1], [r * 0.15, r * 1, r * 0.8], 'cuerpo'),
  }
  if (orejas[e.orejas]) piezas.push(...espejo(orejas[e.orejas]))

  // Cola en tres tramos que se van curvando y afinando.
  const [largoCo, grosorCo, anguloCo] = e.cola
  let anguloCola = THREE.MathUtils.degToRad(180 - anguloCo)
  const curva = THREE.MathUtils.degToRad(e.curva ?? 12)
  let desde = [-largoC * 0.52 + grosorCo, alturaCuerpo + altoC * 0.22, 0]
  for (let tramo = 0; tramo < 3; tramo++) {
    const hasta = [desde[0] + (Math.cos(anguloCola) * largoCo) / 3, desde[1] + (Math.sin(anguloCola) * largoCo) / 3, 0]
    piezas.push(capsula(desde, hasta, grosorCo * (1 - tramo * 0.15), grosorCo * (0.85 - tramo * 0.15), 'cola'))
    desde = hasta
    anguloCola += curva
  }

  // Rasgos propios de algunas especies.
  // Melena del leon: pelo largo que rodea la cara (dejandola al descubierto),
  // cubre el cuello y baja por el pecho; y el mechon oscuro al final de la cola.
  if (e.extra === 'melena') {
    piezas.push(elipsoide([cabeza[0] - r * 0.4, cabeza[1] - r * 0.1, 0], [r * 0.75, r * 1.25, r * 1.2], 'melena'))
    piezas.push(capsula(inicioCuello, finCuello, grosorCu * 1.9, grosorCu * 1.7, 'melena'))
    piezas.push(elipsoide([largoC * 0.4, alturaCuerpo - altoC * 0.15, 0], [r * 0.6, altoC * 0.5, anchoC * 0.32], 'melena'))
    piezas.push(esfera(desde, grosorCo * 2.2, 'melena'))
  }
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
  piezas.push(...espejo((l) => esfera([cabeza[0] + e.cabeza * 0.45, cabeza[1] + e.cabeza * 0.25, l * e.cabeza * 0.78], e.cabeza * 0.15, 'ojo')))
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
  piezas.push(...espejo((l) => esfera([0.56 * k, 8.3 * k, l * 0.22 * k], 0.08 * k, 'ojo')))
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

// Ancho de la union suave entre piezas, y el de las piezas firmes (ojos,
// nariz, pezunas), que se pegan sin derretirse.
const UNION_SUAVE = 0.35
const UNION_FIRME = 0.08
// Ancho en que se funden los colores de dos zonas vecinas (hocico y cara).
const FUNDIDO = 0.25
// Zonas que no llevan pelo ni se funden con sus vecinas.
const FIRMES = new Set(['ojo', 'oscuro', 'pico'])
// Distancia de la piel al ojo hasta la que todavia se pinta de ojo.
const OJO = 0.03
// Largo del pelaje y cuanto se aclara la panza segun el plan corporal (la
// especie puede cambiarlos).
const PELO = { cuadrupedo: 1, ave: 0.5, pez: 0, persona: 0 }
// Zonas con el pelo mas largo que el resto del cuerpo (la melena del leon).
const PELO_DE_ZONA = { melena: 3.5 }
const VIENTRE = { cuadrupedo: 0.5, ave: 0.5, pez: 0.6, persona: 0 }
// Altura del relieve del pelo (en unidades de la escena, con pelo = 1).
const RELIEVE_PELO = 0.018
// Variacion de brillo del grano del pelo.
const GRANO_PELO = 0.16

// Distancia de un punto a la caja de una pieza (0 si esta adentro). La pieza
// nunca esta mas cerca que su caja, asi se descartan las piezas lejanas sin
// calcular su distancia exacta.
function distanciaACaja(p, caja) {
  const dx = Math.max(caja[0] - p[0], 0, p[0] - caja[3])
  const dy = Math.max(caja[1] - p[1], 0, p[1] - caja[4])
  const dz = Math.max(caja[2] - p[2], 0, p[2] - caja[5])
  return Math.hypot(dx, dy, dz)
}

function luminancia([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

const mezclar = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t)

// Pasa de 0 a 1 entre a y b con curva suave (a puede ser mayor que b).
function transicion(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Numero al azar fijo para cada celda de una grilla 3D.
function azarDeCelda(i, j, k, canal) {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + canal * 53.3) * 43758.5453
  return s - Math.floor(s)
}

// Celdas de Voronoi: cada celda de la grilla tiene un punto en un lugar al
// azar; devuelve la distancia al punto mas cercano y al segundo, en
// fracciones del tamano de la celda.
function voronoi(p, tamano) {
  const q = p.map((v) => v / tamano)
  const base = q.map(Math.floor)
  let d1 = Infinity
  let d2 = Infinity
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (let k = -1; k <= 1; k++) {
        const c = [base[0] + i, base[1] + j, base[2] + k]
        const centro = c.map((v, eje) => v + azarDeCelda(c[0], c[1], c[2], eje))
        const d = Math.hypot(q[0] - centro[0], q[1] - centro[1], q[2] - centro[2])
        if (d < d1) [d1, d2] = [d, d1]
        else if (d < d2) d2 = d
      }
    }
  }
  return [d1, d2]
}

// Cuanto del patron del pelaje cae en el punto p (0 = nada, 1 = del todo).
//   rayas: franjas verticales en el cuerpo y horizontales en las patas (tigre, cebra).
//   manchas: rosetas, anillos oscuros con el centro claro (leopardo).
//   parches: manchas grandes de borde irregular (vaca).
//   reticulado: lineas claras entre placas (jirafa); aca 1 es la linea.
function patronEn(patron, p, zona, medida, ruido) {
  if (patron === 'rayas') {
    const ancho = medida * 0.035
    const torcido = (ruido(p[0] / (ancho * 3), p[1] / (ancho * 3), p[2] / (ancho * 3), 3) - 0.5) * 3
    const eje = zona === 'pata' ? p[1] * 1.3 : p[0]
    return transicion(0.35, 0.6, Math.sin((eje / ancho + torcido) * Math.PI))
  }
  if (patron === 'manchas') {
    const [d1] = voronoi(p, medida * 0.07)
    return transicion(0.12, 0.17, d1) * (1 - transicion(0.3, 0.35, d1))
  }
  if (patron === 'parches') {
    const escala = medida * 0.2
    return transicion(0.58, 0.62, ruido(p[0] / escala + 7, p[1] / escala, p[2] / escala, 4))
  }
  if (patron === 'reticulado') {
    const [d1, d2] = voronoi(p, medida * 0.11)
    return 1 - transicion(0.06, 0.12, d2 - d1)
  }
  return 0
}

// Colores de cada zona. Si hay una foto analizada, el cuerpo toma su color
// principal y los detalles el segundo; los ojos y lo oscuro siguen oscuros.
// En una persona el "detalle" es la piel, que no se toma de la foto.
// La panza es el color claro del animal, o una version aclarada del cuerpo.
// Solo los animales cuyo pelaje cambia segun la raza (perro, gato, caballo)
// toman los colores de la foto; los demas conservan los de su especie, porque
// la foto suele mezclar el fondo con el pelaje (una oveja salia rojiza).
// Correccion - Poll: el hocico tomaba el segundo color de la foto y parecia una mascara
function coloresDeZonas(plan, especie, regiones, receta) {
  let [cuerpo, detalle, oscuro] = especie.colores
  if (regiones && (especie.colorDeFoto || plan === 'persona')) {
    const partes = [...regiones.paleta.values()].sort((a, b) => b.peso - a.peso).map((r) => r.color)
    cuerpo = partes[0] ?? cuerpo
    if (plan !== 'persona') {
      detalle = partes.find((color, i) => i > 0 && Math.abs(luminancia(color) - luminancia(cuerpo)) > 25) ?? detalle
    }
  }
  if (receta.colorElegido) cuerpo = [1, 3, 5].map((i) => parseInt(receta.color.slice(i, i + 2), 16))
  const claro = [235, 228, 215]
  return {
    cuerpo,
    cola: cuerpo,
    melena: detalle,
    pata: plan === 'persona' ? [55, 65, 95] : cuerpo,
    detalle,
    // El hocico de un perro, un gato o un caballo es del mismo pelaje que la
    // cara, apenas mas claro; tomado de la foto parecia una mascara.
    hocico: especie.colorHocico ?? (especie.colorDeFoto ? mezclar(cuerpo, claro, 0.15) : detalle),
    oscuro,
    claro,
    panza: luminancia(detalle) > luminancia(cuerpo) ? detalle : mezclar(cuerpo, claro, 0.45),
    pico: especie.colores[2],
    ojo: [15, 12, 12],
  }
}

// Correccion - Poll: los animales se veian de juguete (grilla gruesa, colores pegados por zonas y sin pelaje)
export function crearSer(receta, apariencia) {
  const plan = receta.tipo
  const propia = ESPECIES[ALIAS[receta.palabra] ?? receta.palabra]
  const especie = { ...ESPECIES[BASE[plan]], ...propia }
  // Si el color sale de la foto lo dice la especie misma, no la base del plan
  // (si no, la oveja o la vaca heredaban del perro el color de su foto).
  especie.colorDeFoto = Boolean((propia ?? ESPECIES[BASE[plan]]).colorDeFoto)
  const piezas = PLANES[plan](especie)
  const ruido = crearRuido(crearRandom(semillaDeTexto(receta.palabra ?? plan)))

  // Distancia del ser: union suave de todas las piezas (cada pieza puede pedir
  // una union mas angosta). Las que estan mas lejos que la union no cambian el
  // resultado y se saltean.
  // Correccion - Poll: todas las piezas se unian igual y las articulaciones se inflaban
  const distanciaEn = (p) => {
    let d = Infinity
    for (const pieza of piezas) {
      if (d !== Infinity && distanciaACaja(p, pieza.caja) > d + UNION_SUAVE) continue
      const dp = pieza.distancia(p)
      d = d === Infinity ? dp : minimoSuave(d, dp, pieza.union ?? (FIRMES.has(pieza.zona) ? UNION_FIRME : UNION_SUAVE))
    }
    return d
  }

  // Grilla que envuelve a todas las piezas, con un margen.
  const minimo = [0, 1, 2].map((k) => Math.min(...piezas.map((p) => p.caja[k])) - 0.4)
  const maximo = [0, 1, 2].map((k) => Math.max(...piezas.map((p) => p.caja[k + 3])) + 0.4)
  const medida = Math.max(...maximo.map((v, k) => v - minimo[k]))
  const paso = medida / DIVISIONES
  const tam = maximo.map((v, k) => Math.ceil((v - minimo[k]) / paso) + 1)
  const { posiciones, indices } = redesDeSuperficie(distanciaEn, minimo, paso, tam)

  // Datos para el color: la panza se aclara por debajo del tronco (la
  // primera pieza), como en casi todos los animales.
  const zonas = coloresDeZonas(plan, especie, apariencia.regiones, receta)
  const tronco = piezas[0].caja
  const centroTronco = (tronco[1] + tronco[4]) / 2
  const fondoTronco = tronco[1] + (centroTronco - tronco[1]) * 0.15
  const fuerzaPanza = especie.vientre ?? VIENTRE[plan]
  const pelo = especie.pelo ?? PELO[plan]
  const conPelaje = new Set(['cuerpo', 'pata', 'cola'])

  const colorDe = (zona, p) => {
    let rgb = zonas[zona]
    if (!conPelaje.has(zona)) return rgb
    const cantidad = especie.patron ? patronEn(especie.patron, p, zona, medida, ruido) : 0
    if (especie.patron === 'reticulado') rgb = mezclar(zonas.detalle, rgb, cantidad)
    else rgb = mezclar(rgb, zonas.oscuro, cantidad)
    if (zona === 'cuerpo') rgb = mezclar(rgb, zonas.panza, fuerzaPanza * transicion(centroTronco, fondoTronco, p[1]))
    return rgb
  }

  // Color de cada vertice: el de la zona mas cercana, fundido con la zona
  // vecina cerca del limite (sin bordes dentados), con el patron del pelaje
  // y un grano fino que imita los pelos.
  const colores = []
  const pesoPelo = new Float32Array(posiciones.length / 3)
  const color = new THREE.Color()
  for (let i = 0; i < posiciones.length; i += 3) {
    const p = [posiciones[i], posiciones[i + 1], posiciones[i + 2]]
    let [zona1, d1, zona2, d2] = [null, Infinity, null, Infinity]
    for (const pieza of piezas) {
      if (distanciaACaja(p, pieza.caja) > d2 + 0.05) continue
      // El ojo se pinta solo donde la piel lo toca de verdad. Comparado con las
      // demas piezas ganaba en un circulo mucho mas grande que el ojo, porque
      // la union suave infla la cabeza y la deja lejos de todas sus piezas.
      if (pieza.zona === 'ojo') {
        if (pieza.distancia(p) < OJO) [zona1, d1, zona2, d2] = ['ojo', -Infinity, null, Infinity]
        continue
      }
      // Las piezas firmes se pintan un poco mas alla de su borde, para que se
      // vean enteras.
      const d = pieza.distancia(p) - (FIRMES.has(pieza.zona) ? 0.04 : 0)
      if (d < d1) {
        if (pieza.zona !== zona1) [zona2, d2] = [zona1, d1]
        ;[zona1, d1] = [pieza.zona, d]
      } else if (d < d2 && pieza.zona !== zona1) {
        ;[zona2, d2] = [pieza.zona, d]
      }
    }
    let rgb = colorDe(zona1, p)
    // El largo del pelo tambien se funde entre zonas: la melena no termina de golpe.
    let largoPelo = PELO_DE_ZONA[zona1] ?? 1
    if (zona2 && !FIRMES.has(zona1) && !FIRMES.has(zona2)) {
      const fundido = 0.5 * Math.max(0, 1 - (d2 - d1) / FUNDIDO)
      rgb = mezclar(rgb, colorDe(zona2, p), fundido)
      largoPelo += ((PELO_DE_ZONA[zona2] ?? 1) - largoPelo) * fundido
    }
    if (!FIRMES.has(zona1)) {
      const grano = ruido(p[0] * 9 + 31, p[1] * 9, p[2] * 9, 2)
      rgb = rgb.map((v) => v * (1 + (grano - 0.5) * 2 * GRANO_PELO * Math.min(1, pelo + 0.3)))
      pesoPelo[i / 3] = largoPelo
    }
    color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace)
    colores.push(color.r, color.g, color.b)
  }

  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3))
  geometria.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3))
  // Largo del pelo en cada vertice (0 en ojos, nariz y pezunas), para dibujar
  // el pelaje en capas sobre la piel (components/Pelaje.jsx).
  geometria.setAttribute('pelo', new THREE.Float32BufferAttribute(pesoPelo.map((peso) => peso * pelo), 1))
  geometria.setIndex(indices)

  // Se escala a una medida comun, se centra y se apoya en el piso.
  geometria.computeBoundingBox()
  const caja = geometria.boundingBox
  const medidas = caja.getSize(new THREE.Vector3())
  const centro = caja.getCenter(new THREE.Vector3())
  geometria.translate(-centro.x, -caja.min.y, -centro.z)
  geometria.scale(...Array(3).fill((MEDIDA * receta.tamano) / Math.max(medidas.x, medidas.y, medidas.z)))
  geometria.computeVertexNormals()

  // Relieve del pelo: cada vertice con pelaje sale o entra un poco segun un
  // ruido fino, como mechones; los ojos, la nariz y las pezunas quedan lisos.
  if (pelo > 0) {
    const pos = geometria.attributes.position
    const normales = geometria.attributes.normal
    for (let i = 0; i < pos.count; i++) {
      if (!pesoPelo[i]) continue
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)]
      const n = ruido(x * 9 + 11, y * 9, z * 9, 2) - 0.5
      const alto = n * 2 * RELIEVE_PELO * pelo * receta.tamano
      pos.setXYZ(i, x + normales.getX(i) * alto, Math.max(0, y + normales.getY(i) * alto), z + normales.getZ(i) * alto)
    }
    geometria.computeVertexNormals()
  }
  aplicarOclusion(geometria, calcularOclusion(geometria))
  geometria.computeBoundingBox()
  return { geometria, altura: geometria.boundingBox.max.y }
}
