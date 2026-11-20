import { capsula, elipsoide, enTabla, espejo, minimoSuave, perfil } from './piezas.js'

// Cuadrupedos armados con sus medidas reales, en metros: el tronco por su
// perfil (lomo, panza y ancho a lo largo del cuerpo), las patas con sus
// articulaciones segun como apoyan (pezuna, dedos, planta o columna) y la
// cabeza de su familia.

// ---------- Ganado: caballo, vaca y cebu ----------

// Escala de las medidas del ganado (en metros) a las unidades de las piezas,
// para que las uniones suaves y la grilla funcionen como en los demas
// cuadrupedos.
const METRO = 2.6
// Union angosta de las partes que tienen que verse definidas (patas, cara).
const UNION_DEFINIDA = 0.07
// Union de las piezas de la cabeza que no piden una propia (la misma del armado).
const UNION_SUAVE_CABEZA = 0.35

// Piezas con medidas en metros. "definida" usa la union angosta.
const enMetros = (v) => v.map((x) => x * METRO)
const el = (c, r, zona, definida) => Object.assign(elipsoide(enMetros(c), enMetros(r), zona), definida ? { union: UNION_DEFINIDA } : {})
const cap = (a, b, ra, rb, zona, definida) => Object.assign(capsula(enMetros(a), enMetros(b), ra * METRO, rb * METRO, zona), definida ? { union: UNION_DEFINIDA } : {})
const esf = (c, r, zona, definida) => el(c, [r, r, r], zona, definida)
const tablaEnMetros = (tabla) => tabla.map(([x, v]) => [x * METRO, v * METRO])
const tronco = (arriba, abajo, ancho, cuadratura) =>
  perfil(tablaEnMetros(arriba), tablaEnMetros(abajo), tablaEnMetros(ancho), typeof cuadratura === 'number' ? cuadratura : cuadratura.map(([x, n]) => [x * METRO, n]), 'cuerpo')

// Perfiles del tronco de cada animal, en metros, con la nariz hacia +x
// (medidos sobre fotos de perfil de animales reales).
//   Holstein: el lomo recto de la cruz a la cola, la grupa larga y plana, el
//     barril hondo que baja hacia atras (la "cuna" de la lechera) y el pecho
//     angosto; a 1.48 m a la cruz.
//   Cebu: mas ancho y parejo, la panza mas baja y la grupa caida.
//   Caballo: la cruz alta, el lomo que baja un poco y la grupa redonda; el
//     vientre recogido y el pecho hondo.
const PERFILES_DE_TRONCO = {
  vaca: {
    arriba: [[-0.98, 1.3], [-0.92, 1.42], [-0.55, 1.45], [-0.2, 1.43], [0.2, 1.44], [0.5, 1.48], [0.7, 1.38], [0.82, 1.18]],
    abajo: [[-0.98, 1.02], [-0.85, 0.86], [-0.55, 0.7], [-0.2, 0.6], [0.2, 0.63], [0.5, 0.72], [0.7, 0.8], [0.82, 0.92]],
    ancho: [[-0.98, 0.1], [-0.8, 0.24], [-0.55, 0.28], [-0.2, 0.33], [0.2, 0.31], [0.5, 0.23], [0.82, 0.14]],
    cuadratura: [[-0.98, 3.2], [-0.5, 2.8], [0, 2.3], [0.82, 2.3]],
    codo: 0.74, rodilla: 0.42, pecho: 0.62, cadera: -0.6,
  },
  cebu: {
    arriba: [[-0.98, 1.22], [-0.9, 1.32], [-0.55, 1.4], [-0.2, 1.4], [0.2, 1.42], [0.5, 1.45], [0.7, 1.36], [0.82, 1.15]],
    abajo: [[-0.98, 0.98], [-0.85, 0.82], [-0.55, 0.72], [-0.2, 0.66], [0.2, 0.66], [0.5, 0.68], [0.7, 0.74], [0.82, 0.88]],
    ancho: [[-0.98, 0.14], [-0.8, 0.28], [-0.55, 0.32], [-0.2, 0.35], [0.2, 0.34], [0.5, 0.29], [0.82, 0.18]],
    cuadratura: 2.6,
    codo: 0.76, rodilla: 0.44, pecho: 0.62, cadera: -0.6,
  },
  caballo: {
    arriba: [[-0.88, 1.38], [-0.8, 1.52], [-0.6, 1.6], [-0.3, 1.56], [0.1, 1.54], [0.4, 1.62], [0.6, 1.5], [0.78, 1.25]],
    abajo: [[-0.88, 1.18], [-0.75, 1.02], [-0.4, 0.94], [0, 0.9], [0.4, 0.92], [0.6, 0.98], [0.78, 1.1]],
    ancho: [[-0.88, 0.14], [-0.6, 0.27], [-0.2, 0.29], [0.3, 0.27], [0.6, 0.2], [0.78, 0.14]],
    cuadratura: 2.3,
    codo: 0.95, rodilla: 0.5, pecho: 0.62, cadera: -0.58,
  },
}

// Pata de un ungulado desde la rodilla (o el corvejon) hasta el piso: la
// cana fina, el menudillo (la articulacion abultada sobre el casco), la
// cuartilla inclinada y el casco; la vaca tiene la pezuna partida en dos.
function pataBaja(piezas, x, rodilla, z, grosor, partida, zona) {
  const menudillo = [x + 0.01, 0.2, z]
  piezas.push(cap([x, rodilla, z], menudillo, grosor, grosor * 0.92, zona, true))
  piezas.push(esf(menudillo, grosor * 1.25, zona, true))
  const corona = [x + 0.06, 0.085, z]
  piezas.push(cap(menudillo, corona, grosor, grosor * 1.05, zona, true))
  if (partida) {
    for (const d of [-1, 1]) {
      piezas.push(cap([corona[0], 0.08, z + d * grosor * 0.5], [corona[0] + 0.04, 0.03, z + d * grosor * 0.55], grosor * 0.62, grosor * 0.7, 'oscuro', true))
    }
  } else {
    piezas.push(cap([corona[0], 0.085, z], [corona[0] + 0.03, 0.035, z], grosor * 1.15, grosor * 1.45, 'oscuro', true))
  }
}

// Correccion - Poll: la vaca y el caballo usaban el cuerpo de un perro agrandado y no se veian reales
// Correccion - Poll: el tronco hecho con esferas salia redondo como un barril; ahora sigue el perfil real
export function ganado(e) {
  const caballo = e.ganado === 'caballo'
  const cebu = e.ganado === 'cebu'
  const forma = PERFILES_DE_TRONCO[e.ganado]
  const { codo, rodilla } = forma
  const piezas = [tronco(forma.arriba, forma.abajo, forma.ancho, forma.cuadratura)]
  const ancho = enTabla(forma.ancho, 0)
  const cruz = enTabla(forma.arriba, 0.5)

  // En el cebu, la giba sobre la cruz.
  if (cebu) piezas.push(el([0.45, cruz + 0.04, 0], [0.2, 0.2, 0.14], 'cuerpo'))
  if (!caballo) {
    // Puntas del anca y del isquion, que se marcan en el ganado.
    piezas.push(...espejo((l) => esf([-0.55, enTabla(forma.arriba, -0.55) - 0.06, l * enTabla(forma.ancho, -0.55) * 0.92], 0.075, 'cuerpo')))
    piezas.push(...espejo((l) => esf([-0.97, enTabla(forma.arriba, -0.97) - 0.05, l * 0.09], 0.055, 'cuerpo')))
  }
  if (e.ganado === 'vaca') {
    // Ubre grande, prendida alta entre las patas de atras y hacia adelante
    // por la panza, con sus cuatro pezones.
    const ubre = [-0.5, 0.56, 0]
    piezas.push(el(ubre, [0.26, 0.17, 0.17], 'ubre'))
    piezas.push(el([-0.28, 0.6, 0], [0.18, 0.09, 0.13], 'ubre'))
    for (const dx of [-1, 1]) {
      for (const dz of [-1, 1]) {
        const desde = [ubre[0] + dx * 0.08, ubre[1] - 0.13, dz * 0.075]
        piezas.push(cap(desde, [desde[0], desde[1] - 0.07, desde[2]], 0.02, 0.016, 'ubre', true))
      }
    }
    // La vena de la leche, que corre por la panza hacia adelante.
    piezas.push(...espejo((l) => cap([-0.2, 0.61, l * 0.16], [0.25, 0.64, l * 0.2], 0.02, 0.015, 'cuerpo', true)))
  }

  for (const lado of [1, -1]) {
    const paso = lado * 0.05
    // Delanteras: el omoplato pegado al pecho, el brazo hasta el codo, el
    // antebrazo que se afina hasta la rodilla y la pata baja.
    const xd = 0.52
    const zd = lado * ancho * 0.55
    piezas.push(cap([xd - 0.12, cruz - 0.12, lado * ancho * 0.45], [xd + 0.08, codo + 0.16, lado * ancho * 0.55], 0.09, 0.1, 'cuerpo'))
    piezas.push(cap([xd + 0.08, codo + 0.16, lado * ancho * 0.55], [xd - 0.04 + paso, codo, zd], 0.1, 0.08, 'pata'))
    piezas.push(cap([xd - 0.03 + paso, codo, zd], [xd + paso, rodilla, zd], 0.075, 0.05, 'pata', true))
    piezas.push(esf([xd + paso, rodilla, zd], 0.055, caballo ? 'patabaja' : 'pata', true))
    pataBaja(piezas, xd + paso, rodilla, zd, caballo ? 0.042 : 0.045, !caballo, caballo ? 'patabaja' : 'pata')

    // Traseras: el muslo (plano en la lechera), la babilla adelante, la
    // pierna que baja hacia atras hasta el corvejon y la pata baja.
    const xt = forma.cadera
    const zt = lado * ancho * 0.6
    const babilla = [xt + 0.18 - paso, codo + 0.06, lado * ancho * 0.75]
    const corvejon = [xt - 0.2 - paso, rodilla + 0.1, zt]
    piezas.push(el([xt - 0.08, codo + 0.32, lado * ancho * 0.7], [0.28, 0.32, cebu ? 0.13 : 0.1], 'pata'))
    piezas.push(cap(babilla, corvejon, 0.1, 0.055, 'pata', true))
    piezas.push(esf([corvejon[0] - 0.035, corvejon[1] + 0.03, zt], 0.05, caballo ? 'patabaja' : 'pata', true))
    pataBaja(piezas, corvejon[0] + 0.02, corvejon[1], zt, caballo ? 0.042 : 0.045, !caballo, caballo ? 'patabaja' : 'pata')
  }

  if (caballo) cabezaDeCaballo(piezas, 0.78, cruz)
  else cabezaDeVaca(piezas, cruz, cebu, e)

  // Cola: la del caballo con el pelo largo que cae hasta los corvejones; la
  // de la vaca fina, pegada a la grupa, con el mechon en la punta.
  const nace = caballo ? [-0.84, enTabla(forma.arriba, -0.84) - 0.05, 0] : [-0.95, enTabla(forma.arriba, -0.95) + 0.02, 0]
  if (caballo) {
    piezas.push(cap(nace, [nace[0] - 0.12, nace[1] - 0.22, 0], 0.065, 0.05, 'cola'))
    piezas.push(cap([nace[0] - 0.08, nace[1] - 0.1, 0], [nace[0] - 0.16, 0.62, 0], 0.09, 0.06, 'crin'))
  } else {
    piezas.push(cap(nace, [nace[0] - 0.05, nace[1] - 0.1, 0], 0.035, 0.03, 'cola', true))
    piezas.push(cap([nace[0] - 0.05, nace[1] - 0.1, 0], [nace[0] - 0.04, 0.58, 0], 0.028, 0.018, 'cola', true))
    piezas.push(el([nace[0] - 0.04, 0.5, 0], [0.045, 0.12, 0.045], 'crin', true))
  }
  return piezas
}

// Cabeza de caballo: el cuello largo y arqueado con la crin, la quijada
// ancha atras, la cara larga y recta que se angosta hasta el hocico suave
// con los ollares, los ojos a los costados, las orejas paradas y el copete.
function cabezaDeCaballo(piezas, largo, cruz) {
  const base = [largo * 0.78, cruz - 0.22, 0]
  const medio = [largo * 0.98 + 0.15, cruz + 0.12, 0]
  const nuca = [largo * 0.98 + 0.33, cruz + 0.38, 0]
  piezas.push(cap(base, medio, 0.27, 0.19, 'cuerpo'))
  piezas.push(cap(medio, nuca, 0.19, 0.12, 'cuerpo'))
  // Crin: pelo largo sobre el borde de arriba del cuello y el copete.
  piezas.push(cap([base[0] - 0.08, cruz + 0.07, 0.04], [medio[0] - 0.08, medio[1] + 0.22, 0.05], 0.08, 0.08, 'crin'))
  piezas.push(cap([medio[0] - 0.08, medio[1] + 0.22, 0.05], [nuca[0] - 0.05, nuca[1] + 0.14, 0.04], 0.08, 0.065, 'crin'))

  // La cabeza apunta hacia abajo y adelante.
  const frente = [nuca[0] + 0.1, nuca[1] - 0.05, 0]
  const hocico = [nuca[0] + 0.38, nuca[1] - 0.45, 0]
  piezas.push(el([nuca[0] + 0.02, nuca[1] - 0.12, 0], [0.15, 0.13, 0.11], 'cuerpo', true)) // quijada
  piezas.push(el(frente, [0.11, 0.1, 0.1], 'cuerpo', true))
  piezas.push(cap(frente, [hocico[0] - 0.04, hocico[1] + 0.04, 0], 0.085, 0.065, 'cuerpo', true))
  piezas.push(cap([nuca[0] + 0.02, nuca[1] - 0.2, 0], [hocico[0] - 0.07, hocico[1] - 0.04, 0], 0.06, 0.045, 'cuerpo', true)) // mandibula
  piezas.push(el(hocico, [0.075, 0.08, 0.07], 'hocico', true))
  piezas.push(...espejo((l) => el([hocico[0] + 0.03, hocico[1] + 0.01, l * 0.04], [0.02, 0.025, 0.012], 'oscuro', true)))
  // Ojos grandes a los costados, bajo la frente.
  piezas.push(...espejo((l) => el([frente[0] - 0.01, frente[1] - 0.03, l * 0.105], [0.028, 0.022, 0.02], 'ojo', true)))
  // Orejas paradas y en punta.
  piezas.push(...espejo((l) => cap([nuca[0] - 0.02, nuca[1] + 0.06, l * 0.055], [nuca[0] - 0.01, nuca[1] + 0.22, l * 0.075], 0.035, 0.008, 'cuerpo', true)))
  piezas.push(el([frente[0] - 0.02, frente[1] + 0.07, 0], [0.06, 0.03, 0.05], 'crin', true)) // copete
}

// Cabeza de vaca (o de cebu): el cuello largo y delgado de la lechera (mas
// corto y grueso, con papada grande, en el cebu), la cabeza larga y angosta
// que apunta hacia abajo y adelante, la frente plana, el morro ancho con la
// nariz humeda, las orejas horizontales (largas y caidas en el cebu).
function cabezaDeVaca(piezas, cruz, cebu, especie) {
  const base = [0.62, cruz - 0.25, 0]
  const nuca = [cebu ? 1.04 : 1.08, cruz + (cebu ? -0.04 : 0.02), 0]
  piezas.push(cap(base, nuca, cebu ? 0.24 : 0.22, cebu ? 0.13 : 0.12, 'cuerpo'))
  // Papada: un pliegue de piel bajo el cuello, enorme en el cebu.
  piezas.push(el([base[0] + 0.15, base[1] - 0.2, 0], cebu ? [0.34, 0.3, 0.05] : [0.22, 0.12, 0.04], 'cuerpo'))

  especie.caraDesde = (nuca[0] - 0.08) * METRO
  const frente = [nuca[0] + 0.06, nuca[1] - 0.06, 0]
  const morro = [nuca[0] + 0.32, nuca[1] - (cebu ? 0.42 : 0.36), 0]
  piezas.push(el(frente, [0.11, 0.12, 0.1], 'hocico', true))
  piezas.push(cap(frente, [morro[0] - 0.03, morro[1] + 0.06, 0], 0.09, 0.07, 'hocico', true))
  piezas.push(cap([nuca[0] - 0.02, nuca[1] - 0.16, 0], [morro[0] - 0.07, morro[1] - 0.04, 0], 0.065, 0.05, 'hocico', true)) // mandibula
  piezas.push(el(morro, [0.07, 0.07, 0.09], 'morro', true))
  piezas.push(el([morro[0] + 0.035, morro[1] + 0.005, 0], [0.04, 0.05, 0.075], 'oscuro', true)) // nariz
  piezas.push(...espejo((l) => el([frente[0] + 0.03, frente[1] - 0.03, l * 0.1], [0.026, 0.022, 0.018], 'ojo', true)))
  piezas.push(
    ...espejo((l) =>
      cebu
        ? cap([nuca[0] - 0.02, nuca[1] - 0.02, l * 0.1], [nuca[0] + 0.05, nuca[1] - 0.26, l * 0.22], 0.06, 0.05, 'hocico', true)
        : cap([nuca[0] - 0.02, nuca[1] - 0.02, l * 0.1], [nuca[0] - 0.05, nuca[1] - 0.03, l * 0.3], 0.05, 0.035, 'hocico', true),
    ),
  )
  if (cebu) piezas.push(...espejo((l) => cap([nuca[0], nuca[1] + 0.06, l * 0.07], [nuca[0] - 0.04, nuca[1] + 0.15, l * 0.13], 0.028, 0.01, 'claro', true)))
}


// ---------- Cuadrupedos por sus medidas ----------

// Medidas reales de cada especie (zoometria). Las longitudes van en metros;
// las proporciones, en partes de la alzada (altura a la cruz):
//   alzada; largo del tronco (de la punta del hombro a la nalga);
//   pecho: profundidad del pecho; ancho: medio ancho del tronco;
//   grosor: radio de la pata a media cana; cabeza: largo de la cabeza;
//   hocico: que parte de la cabeza es hocico; cuello: [largo, grados sobre el
//   horizonte, radio]; cola: [largo, grados, radio].
// Fuentes: estandar FCI del pastor aleman (pecho 45-48 % y cabeza 40 % de la
// alzada, tronco 10-17 % mas largo), fichas del Zoo de San Diego (leon,
// tigre, jirafa, elefante), medidas publicadas de gato, zorro, lobo, leopardo
// y oso pardo, y zoometria de ovinos de pelo (Pelibuey).
export const MEDIDAS = {
  perro: { familia: 'canino', alzada: 0.6, largo: 0.68, pecho: 0.47, ancho: 0.14, grosor: 0.05, cabeza: 0.4, hocico: 0.5, cuello: [0.32, 45, 0.075], cola: [0.6, 20, 0.05], orejas: 'caidas' },
  lobo: { familia: 'canino', alzada: 0.8, largo: 0.95, pecho: 0.45, ancho: 0.13, grosor: 0.045, cabeza: 0.38, hocico: 0.5, cuello: [0.3, 40, 0.075], cola: [0.55, -30, 0.08], orejas: 'puntiagudas' },
  zorro: { familia: 'canino', alzada: 0.4, largo: 0.5, pecho: 0.45, ancho: 0.13, grosor: 0.04, cabeza: 0.38, hocico: 0.55, cuello: [0.3, 40, 0.09], cola: [1.05, -10, 0.13], orejas: 'grandes' },
  gato: { familia: 'felino', alzada: 0.25, largo: 0.3, pecho: 0.48, ancho: 0.17, grosor: 0.06, cabeza: 0.4, hocico: 0.22, cuello: [0.22, 50, 0.08], cola: [1.2, 60, 0.06], orejas: 'puntiagudas' },
  leon: { familia: 'felino', alzada: 1.2, largo: 1.45, pecho: 0.5, ancho: 0.17, grosor: 0.075, cabeza: 0.4, hocico: 0.35, cuello: [0.25, 30, 0.09], cola: [0.75, -35, 0.04], orejas: 'redondas', melena: true, borla: true },
  tigre: { familia: 'felino', alzada: 1.0, largo: 1.55, pecho: 0.52, ancho: 0.18, grosor: 0.08, cabeza: 0.42, hocico: 0.33, cuello: [0.25, 25, 0.1], cola: [0.95, -25, 0.05], orejas: 'redondas' },
  leopardo: { familia: 'felino', alzada: 0.65, largo: 0.9, pecho: 0.5, ancho: 0.15, grosor: 0.07, cabeza: 0.38, hocico: 0.3, cuello: [0.25, 30, 0.09], cola: [1.3, -15, 0.05], orejas: 'redondas' },
  oso: { familia: 'oso', alzada: 1.1, largo: 1.4, pecho: 0.55, ancho: 0.24, grosor: 0.11, cabeza: 0.36, hocico: 0.35, cuello: [0.25, 15, 0.2], cola: [0.08, -40, 0.05], orejas: 'redondas' },
  cerdo: { familia: 'porcino', alzada: 0.75, largo: 1.15, pecho: 0.62, ancho: 0.25, grosor: 0.07, cabeza: 0.45, hocico: 0.5, cuello: [0.12, 10, 0.3], cola: [0.25, 40, 0.025], orejas: 'caidas' },
  oveja: { familia: 'ovino', alzada: 0.68, largo: 0.75, pecho: 0.5, ancho: 0.22, grosor: 0.045, cabeza: 0.36, hocico: 0.45, cuello: [0.3, 45, 0.14], cola: [0.3, -70, 0.05], orejas: 'horizontales' },
  cebra: { familia: 'equino', alzada: 1.35, largo: 1.4, pecho: 0.45, ancho: 0.16, grosor: 0.045, cabeza: 0.4, hocico: 0.55, cuello: [0.55, 50, 0.14], cola: [0.6, -65, 0.04], orejas: 'puntiagudas', crin: true },
  jirafa: { familia: 'jirafa', alzada: 3.3, largo: 1.6, pecho: 0.3, ancho: 0.1, grosor: 0.03, cabeza: 0.2, hocico: 0.5, cuello: [0.6, 62, 0.07], cola: [0.3, -70, 0.012], orejas: 'horizontales', borla: true },
  elefante: { familia: 'elefante', alzada: 3.2, largo: 3, pecho: 0.5, ancho: 0.23, grosor: 0.11, cabeza: 0.38, hocico: 0.3, cuello: [0.08, 0, 0.3], cola: [0.35, -75, 0.015], orejas: 'elefante', borla: true },
  conejo: { familia: 'leporido', alzada: 0.18, largo: 0.3, pecho: 0.6, ancho: 0.3, grosor: 0.06, cabeza: 0.55, hocico: 0.3, cuello: [0.1, 50, 0.3], cola: [0.2, 30, 0.12], orejas: 'largas' },
  raton: { familia: 'roedor', alzada: 0.045, largo: 0.08, pecho: 0.6, ancho: 0.35, grosor: 0.07, cabeza: 0.7, hocico: 0.45, cuello: [0.1, 30, 0.3], cola: [2.3, 0, 0.05], orejas: 'redondas' },
}

// Plantillas de cada familia. A lo largo del tronco (de u = -1, la nalga, a
// u = 1, la punta del hombro): la altura del lomo (en partes de la alzada),
// cuanto del pecho tiene de hondo el tronco ahi (en el canino el vientre se
// recoge atras) y el medio ancho (en partes del ancho). Las patas dicen como
// apoyan y a que altura van sus articulaciones (en partes de la alzada).
const PUNTOS = [-1, -0.8, -0.5, 0, 0.5, 0.8, 1]
const FAMILIAS = {
  canino: { lomo: [0.9, 0.97, 0.97, 0.96, 1, 0.97, 0.82], hondo: [0.45, 0.55, 0.55, 0.75, 1, 0.95, 0.7], ancho: [0.45, 0.8, 0.9, 1, 0.95, 0.75, 0.5], cuadratura: 2.2, pata: 'dedos', carpo: 0.2, corvejon: 0.28 },
  felino: { lomo: [0.9, 0.99, 0.97, 0.93, 1, 0.96, 0.8], hondo: [0.5, 0.6, 0.62, 0.8, 1, 0.95, 0.7], ancho: [0.5, 0.85, 0.9, 1, 0.95, 0.75, 0.5], cuadratura: 2.2, pata: 'dedos', carpo: 0.17, corvejon: 0.3 },
  porcino: { lomo: [0.82, 0.97, 1, 1, 0.98, 0.93, 0.78], hondo: [0.7, 0.9, 1, 1, 1, 0.95, 0.8], ancho: [0.6, 0.95, 1, 1, 1, 0.9, 0.6], cuadratura: 2.8, pata: 'pezuna', carpo: 0.18, corvejon: 0.3, menudillo: 0.08 },
  ovino: { lomo: [0.86, 0.98, 1, 1, 1, 0.95, 0.8], hondo: [0.65, 0.85, 0.95, 1, 1, 0.95, 0.75], ancho: [0.5, 0.9, 1, 1, 1, 0.85, 0.55], cuadratura: 2.4, pata: 'pezuna', carpo: 0.3, corvejon: 0.38, menudillo: 0.12 },
  equino: { lomo: [0.86, 0.98, 0.98, 0.96, 1, 0.95, 0.8], hondo: [0.5, 0.75, 0.85, 0.95, 1, 0.9, 0.7], ancho: [0.5, 0.9, 1, 1, 0.9, 0.7, 0.5], cuadratura: 2.3, pata: 'casco', carpo: 0.31, corvejon: 0.37, menudillo: 0.13 },
  oso: { lomo: [0.8, 0.92, 0.93, 0.9, 1, 0.97, 0.8], hondo: [0.6, 0.85, 0.95, 1, 1, 0.95, 0.75], ancho: [0.6, 0.9, 1, 1, 1, 0.9, 0.6], cuadratura: 2.2, pata: 'planta', carpo: 0.12, corvejon: 0.05 },
  elefante: { lomo: [0.8, 0.93, 0.97, 0.97, 1, 0.97, 0.84], hondo: [0.55, 0.8, 0.95, 1, 1, 0.95, 0.75], ancho: [0.55, 0.9, 1, 1, 1, 0.9, 0.6], cuadratura: 2.2, pata: 'columna', carpo: 0.42, corvejon: 0.42 },
  jirafa: { lomo: [0.66, 0.74, 0.8, 0.86, 0.96, 1, 0.88], hondo: [0.55, 0.75, 0.9, 1, 1, 0.95, 0.7], ancho: [0.5, 0.85, 0.95, 1, 1, 0.85, 0.5], cuadratura: 2.2, pata: 'pezuna', carpo: 0.33, corvejon: 0.42, menudillo: 0.12 },
  leporido: { lomo: [0.75, 0.95, 1, 0.95, 0.85, 0.8, 0.65], hondo: [0.75, 0.95, 1, 1, 0.95, 0.9, 0.7], ancho: [0.6, 0.95, 1, 1, 0.9, 0.75, 0.5], cuadratura: 2, pata: 'dedos', carpo: 0.15, corvejon: 0.12 },
  roedor: { lomo: [0.7, 0.92, 1, 0.95, 0.85, 0.78, 0.6], hondo: [0.75, 0.95, 1, 1, 0.95, 0.9, 0.7], ancho: [0.6, 0.95, 1, 1, 0.9, 0.75, 0.5], cuadratura: 2, pata: 'dedos', carpo: 0.15, corvejon: 0.15 },
}

// Juego de piezas a una escala dada: las medidas entran en metros y salen en
// las unidades de las piezas. Cada animal se arma a su escala para que un gato
// tenga el mismo detalle que un elefante.
function crearKit(escala) {
  const m = (v) => v.map((x) => x * escala)
  const el = (c, r, zona, definida) => Object.assign(elipsoide(m(c), m(r), zona), definida ? { union: UNION_DEFINIDA } : {})
  const cap = (a, b, ra, rb, zona, definida) => Object.assign(capsula(m(a), m(b), ra * escala, rb * escala, zona), definida ? { union: UNION_DEFINIDA } : {})
  return { escala, el, cap, esf: (c, r, zona, definida) => el(c, [r, r, r], zona, definida) }
}

// Correccion - Poll: los animales eran esferas y capsulas sin sus medidas reales y se veian de juguete
export function cuadrupedoMedido(e) {
  const md = MEDIDAS[e.medidas]
  const f = FAMILIAS[md.familia]
  const H = md.alzada
  // La alzada queda en 3.9 unidades, como la de la vaca.
  const k = crearKit(3.9 / H)
  const { el, cap, esf } = k
  const mitad = md.largo / 2
  const lomo = PUNTOS.map((u, i) => [u * mitad, H * f.lomo[i]])
  const panza = PUNTOS.map((u, i) => [u * mitad, H * f.lomo[i] - H * md.pecho * f.hondo[i]])
  const ancho = PUNTOS.map((u, i) => [u * mitad, H * md.ancho * f.ancho[i]])
  const tablaEnEscala = (tabla) => tabla.map(([x, v]) => [x * k.escala, v * k.escala])
  const piezas = [perfil(tablaEnEscala(lomo), tablaEnEscala(panza), tablaEnEscala(ancho), f.cuadratura, 'cuerpo')]
  const alto = (x) => enTabla(lomo, x)
  const bajo = (x) => enTabla(panza, x)
  const anchoEn = (x) => enTabla(ancho, x)
  const g = md.grosor * H

  // Patas.
  const codo = bajo(mitad * 0.55) + g * 0.3
  for (const lado of [1, -1]) {
    const paso = lado * 0.05 * H
    // Delanteras: el hombro, el brazo hasta el codo y el antebrazo.
    const xd = mitad * 0.62
    const zd = lado * anchoEn(xd) * 0.6
    const carpo = [xd + paso, H * f.carpo, zd]
    piezas.push(cap([xd - 0.08 * H, alto(xd) - 0.15 * H, lado * anchoEn(xd) * 0.55], [xd - 0.03 * H + paso, codo, zd], g * 1.7, g * 1.25, 'pata'))
    if (f.pata === 'columna') {
      piezas.push(cap([xd - 0.03 * H + paso, codo, zd], [carpo[0], g * 0.6, zd], g * 1.2, g * 1.1, 'pata'))
      piezas.push(el([carpo[0], g * 0.35, zd], [g * 1.25, g * 0.35, g * 1.25], 'pata', true))
      for (let u = 0; u < 4; u++) piezas.push(esf([carpo[0] + g * 1.1 * Math.cos((u - 1.5) * 0.4), g * 0.18, zd + g * 1.1 * Math.sin((u - 1.5) * 0.4)], g * 0.18, 'claro', true))
    } else {
      piezas.push(cap([xd - 0.03 * H + paso, codo, zd], carpo, g * 1.2, g * 0.8, 'pata', true))
      piezas.push(...pataBajaMedida(k, carpo, f, g, H, true))
    }

    // Traseras: el muslo, la babilla adelante, la pierna hasta el corvejon
    // y la pata baja (en el oso el talon apoya en el suelo).
    const xt = -mitad * 0.62
    const zt = lado * anchoEn(xt) * 0.6
    const babilla = [xt + 0.12 * H - paso, bajo(xt) + 0.05 * H, lado * anchoEn(xt) * 0.75]
    piezas.push(el([xt - 0.04 * H, (alto(xt) + bajo(xt)) / 2, lado * anchoEn(xt) * 0.6], [0.2 * H, (alto(xt) - bajo(xt)) * 0.55, anchoEn(xt) * 0.45], 'pata'))
    if (f.pata === 'columna') {
      const rodilla = [xt + 0.04 * H - paso, H * f.corvejon, zt]
      piezas.push(cap(babilla, rodilla, g * 1.4, g * 1.2, 'pata'))
      piezas.push(cap(rodilla, [rodilla[0], g * 0.6, zt], g * 1.2, g * 1.1, 'pata'))
      piezas.push(el([rodilla[0], g * 0.35, zt], [g * 1.2, g * 0.35, g * 1.2], 'pata', true))
    } else {
      const corvejon = [xt - 0.12 * H - paso, Math.max(g, H * f.corvejon), zt]
      piezas.push(cap(babilla, corvejon, g * 1.4, g * 0.75, 'pata', true))
      piezas.push(esf([corvejon[0] - g * 0.4, corvejon[1] + g * 0.3, zt], g * 0.75, 'pata', true))
      piezas.push(...pataBajaMedida(k, corvejon, f, g, H, false))
    }
  }

  // Cuello y cabeza.
  const hombro = [mitad * 0.8, alto(mitad * 0.8) - 0.12 * H, 0]
  const anguloCuello = (md.cuello[1] * Math.PI) / 180
  const largoCuello = md.cuello[0] * H
  const nuca = [hombro[0] + Math.cos(anguloCuello) * largoCuello, hombro[1] + Math.sin(anguloCuello) * largoCuello, 0]
  piezas.push(cap(hombro, nuca, md.cuello[2] * H * 1.6, md.cuello[2] * H, 'cuerpo'))
  cabezaDeFamilia(k, piezas, md, nuca, H)

  // Cola: en tres tramos que se curvan y se afinan.
  const [largoCola, anguloCola, grosorCola] = md.cola
  let angulo = Math.PI - (anguloCola * Math.PI) / 180
  let desde = [-mitad * 0.98, alto(-mitad * 0.98) - 0.05 * H, 0]
  const curva = md.familia === 'porcino' ? 2.2 : md.familia === 'felino' ? 0.35 : 0.2
  for (let t = 0; t < 3; t++) {
    const hasta = [desde[0] + (Math.cos(angulo) * largoCola * H) / 3, desde[1] + (Math.sin(angulo) * largoCola * H) / 3, 0]
    const r = grosorCola * H
    piezas.push(cap(desde, hasta, r * (1 - t * 0.15), r * (0.85 - t * 0.15), 'cola', true))
    desde = hasta
    angulo += curva
  }
  if (md.borla) piezas.push(el(desde, [grosorCola * H * 2.2, grosorCola * H * 3, grosorCola * H * 2.2], md.familia === 'felino' ? 'melena' : 'crin', true))
  if (md.familia === 'leporido') piezas.push(esf(desde, grosorCola * H * 1.6, 'claro'))
  return piezas
}

// Pata baja segun como apoya el animal, desde el carpo (o el corvejon):
// dedos con almohadillas (perros, felinos, conejo), pezuna partida (cerdo,
// oveja, jirafa), casco (cebra) o la planta entera (oso).
function pataBajaMedida(k, desde, f, g, H, delantera) {
  const { el, cap, esf } = k
  const [x, , z] = desde
  const piezas = []
  if (f.pata === 'dedos') {
    const pie = [x + 0.05 * H, g * 0.75, z]
    piezas.push(cap(desde, pie, g * 0.8, g * 0.7, 'pata', true))
    piezas.push(el([pie[0] + g * 0.4, g * 0.45, z], [g * 1.15, g * 0.5, g * 0.95], 'pata', true))
  } else if (f.pata === 'planta') {
    const talon = [x + (delantera ? 0.02 : 0.04) * H, g * 0.5, z]
    piezas.push(cap(desde, talon, g * 0.95, g * 0.9, 'pata', true))
    piezas.push(el([talon[0] + g * 1.1, g * 0.45, z], [g * 1.8, g * 0.45, g * 1.05], 'pata', true))
    for (let u = 0; u < 5; u++) piezas.push(cap([talon[0] + g * 2.6, g * 0.4, z + (u - 2) * g * 0.4], [talon[0] + g * 3.1, g * 0.15, z + (u - 2) * g * 0.45], g * 0.12, g * 0.05, 'oscuro', true))
  } else {
    const menudillo = [x + 0.01 * H, H * (f.menudillo ?? 0.1), z]
    piezas.push(cap(desde, menudillo, g * 0.75, g * 0.7, 'pata', true))
    piezas.push(esf(menudillo, g * 0.9, 'pata', true))
    const corona = [menudillo[0] + 0.035 * H, g * 1.1, z]
    piezas.push(cap(menudillo, corona, g * 0.72, g * 0.78, 'pata', true))
    if (f.pata === 'casco') {
      piezas.push(cap(corona, [corona[0] + g * 0.4, g * 0.45, z], g * 0.85, g * 1.05, 'oscuro', true))
    } else {
      for (const d of [-1, 1]) piezas.push(cap([corona[0], g * 1, z + d * g * 0.4], [corona[0] + g * 0.4, g * 0.35, z + d * g * 0.45], g * 0.5, g * 0.55, 'oscuro', true))
    }
  }
  return piezas
}

// Cabeza de cada familia, desde la nuca y hacia adelante (+x), con el largo
// real de la cabeza (C). Primero se arma la forma (craneo, pomulos, hocico,
// mandibula) y despues los rasgos (ojos, nariz, boca) se apoyan sobre la
// superficie de esa forma: puestos en coordenadas fijas quedaban enterrados
// dentro del craneo y la cara salia lisa, sin ojos ni nariz.
// Correccion - Poll: el leon y el tigre no tenian cara (los ojos y la nariz quedaban enterrados)
function cabezaDeFamilia(k, piezas, md, nuca, H) {
  const { el, cap, esf } = k
  const C = md.cabeza * H
  const familia = md.familia
  const [nx, ny] = nuca
  // La cabeza apunta hacia adelante y un poco abajo; la jirafa, la cebra y la
  // oveja la llevan mas inclinada.
  const inclinacion = { equino: 0.75, jirafa: 0.55, ovino: 0.6, elefante: 0.9, porcino: 0.35, oso: 0.3 }[familia] ?? 0.15
  const eje = [Math.cos(-inclinacion), Math.sin(-inclinacion)]
  // Punto de la cabeza: a = a lo largo (0 nuca, 1 punta del hocico), b = hacia
  // arriba, c = hacia el costado, todo en partes de C.
  const en = (a, b = 0, c = 0) => [nx + eje[0] * a * C - eje[1] * b * C, ny + eje[1] * a * C + eje[0] * b * C, c * C]
  // Direccion en el marco de la cabeza.
  const hacia = (a, b, c) => {
    const largo = Math.hypot(a, b, c)
    return [(eje[0] * a - eje[1] * b) / largo, (eje[1] * a + eje[0] * b) / largo, c / largo]
  }
  const forma = []
  const agregar = (...nuevas) => forma.push(...nuevas)

  const felino = familia === 'felino'
  const canino = familia === 'canino' || familia === 'oso'
  if (felino) {
    // Craneo ancho y redondo, pomulos marcados, el puente de la nariz, las dos
    // almohadillas de los bigotes y el menton.
    agregar(el(en(0.32, 0.06), [0.37 * C, 0.33 * C, 0.36 * C], 'cuerpo'))
    agregar(...espejo((l) => el(en(0.46, -0.04, l * 0.23), [0.22 * C, 0.17 * C, 0.15 * C], 'cuerpo')))
    agregar(cap(en(0.42, 0.12), en(0.8, 0.03), 0.13 * C, 0.1 * C, 'cuerpo', true))
    agregar(...espejo((l) => el(en(0.8, -0.07, l * 0.085), [0.13 * C, 0.11 * C, 0.11 * C], 'hocico', true)))
    agregar(el(en(0.76, -0.19), [0.1 * C, 0.07 * C, 0.1 * C], 'hocico', true))
  } else if (canino) {
    // Craneo, la frente que sube sobre el hocico (el "stop"), las mejillas, el
    // hocico largo, los belfos colgando a los costados y la mandibula.
    const corto = familia === 'oso'
    agregar(el(en(0.28, 0.06), [0.3 * C, 0.25 * C, 0.25 * C], 'cuerpo'))
    agregar(el(en(0.44, 0.13), [0.15 * C, 0.12 * C, 0.17 * C], 'cuerpo'))
    agregar(...espejo((l) => el(en(0.36, -0.04, l * 0.17), [0.18 * C, 0.13 * C, 0.1 * C], 'cuerpo')))
    agregar(cap(en(0.5, 0.02), en(corto ? 0.88 : 0.95, -0.02), (corto ? 0.17 : 0.14) * C, (corto ? 0.14 : 0.11) * C, 'hocico', true))
    agregar(...espejo((l) => cap(en(0.56, -0.09, l * 0.08), en(0.92, -0.1, l * 0.06), 0.075 * C, 0.06 * C, 'hocico', true)))
    agregar(cap(en(0.3, -0.16), en(0.86, -0.15), 0.09 * C, 0.06 * C, 'hocico', true))
  } else {
    // Cabezas largas (cerdo, oveja, cebra, jirafa, elefante, conejo, raton).
    const redonda = ['leporido', 'roedor', 'elefante'].includes(familia)
    agregar(el(en(0.3, 0.05), redonda ? [0.36 * C, 0.33 * C, 0.33 * C] : [0.33 * C, 0.26 * C, 0.25 * C], 'cuerpo'))
    const anchoHocico = { porcino: 0.17, equino: 0.14, ovino: 0.13, jirafa: 0.12, elefante: 0.22 }[familia] ?? 0.14
    agregar(cap(en(1 - md.hocico, 0), en(0.92, -0.05), anchoHocico * C * 1.2, anchoHocico * C, 'hocico', true))
    agregar(cap(en(0.25, -0.18), en(0.85, -0.16), 0.12 * C, 0.08 * C, 'hocico', true))
  }
  piezas.push(...forma)

  // Punto de la superficie de la cabeza, saliendo de "desde" en la direccion
  // dada (se mide con la misma union suave con que se arma el ser).
  const superficie = (desde, direccion) => {
    for (let t = 0; t < C * 1.5; t += C / 160) {
      const p = [desde[0] + direccion[0] * t, desde[1] + direccion[1] * t, desde[2] + direccion[2] * t]
      const q = p.map((v) => v * k.escala)
      let d = Infinity
      for (const pieza of forma) {
        const dp = pieza.distancia(q)
        d = d === Infinity ? dp : minimoSuave(d, dp, pieza.union ?? UNION_SUAVE_CABEZA)
      }
      if (d > 0) return p
    }
    return desde
  }
  // Apoya un rasgo sobre la piel: su centro queda hundido "hundido" de su
  // radio, asi asoma lo justo.
  const apoyar = (desde, direccion, radio, hundido) => {
    const s = superficie(desde, direccion)
    return [s[0] - direccion[0] * radio * hundido, s[1] - direccion[1] * radio * hundido, s[2] - direccion[2] * radio * hundido]
  }

  // Ojos: el borde oscuro del parpado, el iris del color de la especie y la
  // pupila (vertical en los felinos). Al frente en felinos y perros; a los
  // costados en los herbivoros.
  const frontal = felino || canino
  const radioOjo = (felino ? 0.058 : frontal ? 0.045 : 0.045) * C
  for (const l of [1, -1]) {
    const direccion = frontal ? hacia(0.9, 0.15, l * 0.45) : hacia(0.35, 0.1, l * 1)
    const ojo = apoyar(en(felino ? 0.55 : 0.45, felino ? 0.12 : 0.1, 0), direccion, radioOjo, 0.45)
    const atras = (f) => ojo.map((v, i) => v - direccion[i] * radioOjo * f)
    piezas.push(el(atras(0.35), [radioOjo * 1.08, radioOjo * 0.95, radioOjo * 1.08], 'oscuro', true))
    piezas.push(esf(ojo, radioOjo, 'iris', true))
    const pupila = ojo.map((v, i) => v + direccion[i] * radioOjo * 0.55)
    piezas.push(el(pupila, felino ? [radioOjo * 0.5, radioOjo * 0.75, radioOjo * 0.25] : [radioOjo * 0.55, radioOjo * 0.55, radioOjo * 0.55], 'ojo', true))
  }

  // Nariz y boca.
  if (familia === 'porcino') {
    const disco = apoyar(en(0.8, -0.05), hacia(1, 0, 0), 0.05 * C, 0.6)
    piezas.push(cap(disco, [disco[0] + 0.05 * C, disco[1], 0], 0.16 * C, 0.16 * C, 'morro', true))
    piezas.push(...espejo((l) => esf([disco[0] + 0.07 * C, disco[1], l * 0.06 * C], 0.035 * C, 'oscuro', true)))
  } else if (familia === 'equino') {
    piezas.push(...espejo((l) => el(apoyar(en(0.88, -0.03, l * 0.06), hacia(0.6, 0, l * 0.8), 0.03 * C, 0.4), [0.03 * C, 0.045 * C, 0.025 * C], 'oscuro', true)))
  } else if (familia !== 'elefante') {
    // Nariz de cuero (en triangulo en los felinos), con los orificios.
    const radioNariz = (felino ? 0.075 : canino ? 0.09 : 0.06) * C
    const nariz = apoyar(en(felino ? 0.78 : 0.86, felino ? 0.04 : 0, 0), hacia(1, 0.25, 0), radioNariz, 0.55)
    piezas.push(el(nariz, [radioNariz * 0.8, radioNariz * 0.75, radioNariz * 1.15], 'nariz', true))
    if (felino) piezas.push(el([nariz[0] - radioNariz * 0.2, nariz[1] - radioNariz * 0.55, 0], [radioNariz * 0.5, radioNariz * 0.6, radioNariz * 0.5], 'nariz', true))
    piezas.push(...espejo((l) => esf([nariz[0] + radioNariz * 0.6, nariz[1] - radioNariz * 0.15, l * radioNariz * 0.45], radioNariz * 0.22, 'oscuro', true)))
    // La boca: la linea que baja de la nariz y se abre a los costados.
    const base = [nariz[0] - radioNariz * 0.3, nariz[1] - radioNariz * 1.1, 0]
    const fin = (l) => apoyar(en(felino ? 0.7 : 0.75, -0.13, l * 0.12), hacia(0.5, -0.2, l * 0.9), 0.012 * C, 0.3)
    piezas.push(cap([nariz[0], nariz[1] - radioNariz * 0.5, 0], base, 0.012 * C, 0.012 * C, 'oscuro', true))
    piezas.push(...espejo((l) => cap(base, fin(l), 0.012 * C, 0.01 * C, 'oscuro', true)))
  }

  // Orejas.
  const tope = en(0.15, 0.27)
  const orejas = {
    puntiagudas: (l) => cap([tope[0], tope[1], l * 0.17 * C], [tope[0] - 0.05 * C, tope[1] + 0.32 * C, l * 0.22 * C], 0.1 * C, 0.015 * C, 'cuerpo', true),
    grandes: (l) => cap([tope[0], tope[1], l * 0.17 * C], [tope[0] - 0.06 * C, tope[1] + 0.42 * C, l * 0.26 * C], 0.13 * C, 0.02 * C, 'cuerpo', true),
    redondas: (l) => el([tope[0], tope[1] + 0.06 * C, l * 0.26 * C], [0.05 * C, 0.12 * C, 0.12 * C], 'cuerpo', true),
    caidas: (l) => cap([tope[0], tope[1], l * 0.24 * C], [tope[0] + 0.12 * C, tope[1] - 0.36 * C, l * 0.33 * C], 0.12 * C, 0.1 * C, familia === 'porcino' ? 'cuerpo' : 'detalle', true),
    horizontales: (l) => cap([tope[0], tope[1] - 0.05 * C, l * 0.2 * C], [tope[0] - 0.03 * C, tope[1] - 0.08 * C, l * 0.48 * C], 0.07 * C, 0.04 * C, 'cuerpo', true),
    largas: (l) => cap([tope[0], tope[1], l * 0.12 * C], [tope[0] - 0.15 * C, tope[1] + 0.85 * C, l * 0.2 * C], 0.1 * C, 0.08 * C, 'cuerpo', true),
    elefante: (l) => el([tope[0] - 0.1 * C, tope[1] - 0.25 * C, l * 0.45 * C], [0.35 * C, 0.55 * C, 0.05 * C], 'cuerpo', true),
  }
  piezas.push(...espejo(orejas[md.orejas]))

  if (familia === 'elefante') {
    // Trompa: baja desde la cara casi hasta el suelo, y los colmillos.
    let desde = en(0.95, 0)
    let radio = 0.2 * C
    for (let t = 0; t < 5; t++) {
      const hasta = [desde[0] + 0.05 * C, desde[1] - 0.42 * C, 0]
      piezas.push(cap(desde, hasta, radio, radio * 0.82, 'cuerpo', true))
      desde = hasta
      radio *= 0.82
    }
    piezas.push(...espejo((l) => cap(en(0.8, -0.2, l * 0.15), [en(0.8)[0] + 0.45 * C, en(0.8)[1] - 0.55 * C, l * 0.22 * C], 0.06 * C, 0.025 * C, 'claro', true)))
  }
  if (familia === 'jirafa') {
    piezas.push(...espejo((l) => cap([tope[0], tope[1], l * 0.1 * C], [tope[0] - 0.02 * C, tope[1] + 0.3 * C, l * 0.12 * C], 0.05 * C, 0.06 * C, 'oscuro', true)))
  }
  if (md.melena) {
    // Melena del leon: un collar de pelo largo alrededor de la cara (que queda
    // al descubierto), sobre la nuca y bajando por el pecho.
    piezas.push(el(en(0.08, 0.05), [0.42 * C, 0.75 * C, 0.72 * C], 'melena'))
    piezas.push(el([nx - 0.3 * C, ny - 0.45 * C, 0], [0.5 * C, 0.75 * C, 0.55 * C], 'melena'))
  }
  if (md.crin) {
    piezas.push(cap([nx - md.cuello[0] * H * 0.9, ny - md.cuello[0] * H * 0.6, 0], [nx, ny + 0.15 * C, 0], 0.07 * C, 0.06 * C, 'crin', true))
  }
}
