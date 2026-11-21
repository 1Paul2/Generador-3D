import * as THREE from 'three'
import { ARRIBA, PERFILES, aclarar, celdas, columna, cuerpo, diferenciaAngular, girar, hojaLarga, mezclar, suelo, transicion, vector } from './botanica.js'

// Plantas de hoja larga: yuca, banano, pina, cana de azucar, maiz, arroz y
// palma aceitera.

// ---------- Yuca ----------

const YUCA = {
  tallo: [128, 112, 96],
  talloJoven: [95, 112, 62],
  peciolo: [150, 48, 58],
  hoja: [44, 88, 38],
  hojaJoven: [92, 128, 52],
  vena: [175, 180, 125],
}

// Hoja palmeada de la yuca: un peciolo largo y rojizo y, en su punta, de 5 a
// 7 lobulos lanceolados repartidos en abanico, con la vena central clara y
// las venas secundarias saliendo hacia el borde. edad: 0 (joven, arriba, mas
// clara y erguida) a 1 (vieja, abajo, oscura y caida).
function hojaDeYuca(malla, nudo, azimut, edad, random, ruido) {
  const afuera = vector(Math.cos(azimut), 0, Math.sin(azimut))
  const subida = THREE.MathUtils.degToRad(70 - edad * 45)
  const direccion = afuera.clone().multiplyScalar(Math.cos(subida)).addScaledVector(ARRIBA, Math.sin(subida))
  const largoPeciolo = 0.16 + random() * 0.1 + edad * 0.06
  const peciolo = columna(nudo, direccion, largoPeciolo, 0.6 + edad * 0.9)
  malla.tubo(
    18,
    6,
    (u) => peciolo(u).p,
    (u) => 0.0032 * (1 - u * 0.35),
    (u, a, p) => aclarar(mezclar(YUCA.peciolo, YUCA.talloJoven, 0.25 * (1 - u)), 0.9 + ruido(p.x * 300, p.y * 300, p.z * 300, 2) * 0.2),
  )

  const punta = peciolo(1).p
  const colorHoja = mezclar(YUCA.hojaJoven, YUCA.hoja, 0.35 + edad * 0.65)
  const lobulos = random() < 0.6 ? 7 : 5
  const largoCentral = 0.2 + random() * 0.05 - edad * 0.03
  for (let k = 0; k < lobulos; k++) {
    const t = lobulos === 1 ? 0 : k / (lobulos - 1) - 0.5
    const abanico = t * THREE.MathUtils.degToRad(lobulos === 7 ? 250 : 200)
    const largo = largoCentral * (0.42 + 0.58 * Math.cos(abanico * 0.62))
    const ancho = largo * (0.13 + random() * 0.03)
    // El lobulo sale hacia afuera desde la punta del peciolo, abierto en
    // abanico sobre el plano de la hoja, y se cae con el peso.
    const salida = girar(afuera, ARRIBA, -abanico).addScaledVector(ARRIBA, 0.25 - edad * 0.2).normalize()
    const vena = columna(punta, salida, largo, 0.8 + edad * 1.2, 30)
    const semilla = random() * 100
    malla.superficie(34, 10, (u, v) => {
      const { p, tangente } = vena(u)
      const lado = tangente.clone().cross(ARRIBA)
      if (lado.lengthSq() < 1e-6) lado.set(1, 0, 0)
      lado.normalize()
      const normal = lado.clone().cross(tangente).normalize()
      const s = v * 2 - 1
      // Lanceolado: angosto en la base, mas ancho pasando la mitad, en punta.
      const anchoAca = ancho * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.9)
      // La vena central queda mas baja que los bordes (la hoja en V) y el borde ondula.
      const pliegue = Math.abs(s) * anchoAca * 0.28 + Math.sin(u * 38 + semilla) * 0.0025 * s * s
      const q = p.clone().addScaledVector(lado, s * anchoAca).addScaledVector(normal, pliegue)

      const fino = ruido(q.x * 220, q.y * 220, q.z * 220, 3)
      let c = aclarar(colorHoja, 0.88 + fino * 0.24)
      // Venas secundarias: lineas que salen de la central hacia el borde y la punta.
      const secundaria = 1 - transicion(0, 0.12, Math.abs(((u * 13 - Math.abs(s) * 1.6) % 1) - 0.5) * 2 - 0.82)
      c = mezclar(c, YUCA.vena, 0.12 * secundaria * (1 - Math.abs(s) * 0.6))
      // Vena central clara, rojiza cerca de la base.
      const central = 1 - transicion(0.02, 0.09, Math.abs(s))
      c = mezclar(c, mezclar(YUCA.vena, YUCA.peciolo, 0.4 * (1 - u)), central * 0.75)
      // Bordes un poco amarillentos y, en las hojas viejas, manchas secas.
      c = mezclar(c, [120, 135, 60], 0.12 * transicion(0.85, 1, Math.abs(s)))
      const mancha = ruido(q.x * 60 + semilla, q.y * 60, q.z * 60, 3)
      if (edad > 0.6) c = mezclar(c, [120, 95, 50], transicion(0.66, 0.72, mancha) * (edad - 0.5))
      return { p: q, c }
    })
  }
}

// Mata de yuca: dos o tres tallos lenosos que salen del suelo, grises, con
// las cicatrices abultadas que dejan las hojas al caerse; arriba el tallo es
// verde y lleva la copa de hojas palmeadas en espiral.
export function yuca(malla, random, ruido) {
  suelo(malla, 0.55, 0.12, ruido)
  const tallos = 2 + Math.floor(random() * 2)
  for (let s = 0; s < tallos; s++) {
    const alto = 1.35 + random() * 0.5
    const azimut = (s / tallos) * Math.PI * 2 + random() * 0.8
    const inclinacion = 0.1 + random() * 0.14
    const afuera = vector(Math.cos(azimut), 0, Math.sin(azimut))
    const base = afuera.clone().multiplyScalar(0.03).setY(-0.02)
    const centro = (u) =>
      base
        .clone()
        .addScaledVector(afuera, inclinacion * alto * Math.pow(u, 1.4))
        .addScaledVector(ARRIBA, alto * u)
        .add(vector((ruido(u * 3, s * 7, 0, 2) - 0.5) * 0.08, 0, (ruido(u * 3, s * 7, 5, 2) - 0.5) * 0.08))

    // Cicatrices: una por cada hoja que se cayo, en espiral (angulo de oro).
    const separacion = 0.03
    const nudos = Math.floor(alto / separacion)
    const desfase = random() * 6
    const radio = (u, a) => {
      let r = 0.021 * (1 - u * 0.55)
      const k = Math.round(u * nudos)
      for (let n = k - 1; n <= k + 1; n++) {
        const du = ((u - n / nudos) * alto) / 0.007
        const da = diferenciaAngular(a, n * 2.39996 + desfase) / 0.5
        r += 0.006 * (1 - u * 0.6) * Math.exp(-du * du - da * da)
      }
      // Punta redondeada.
      return r * (u > 0.97 ? Math.sqrt(Math.max(0, (1 - u) / 0.03)) : 1)
    }
    malla.tubo(260, 28, centro, radio, (u, a, p) => {
      const fino = ruido(p.x * 160, p.y * 160, p.z * 160, 3)
      let c = aclarar(YUCA.tallo, 0.8 + fino * 0.35)
      // Manchas plateadas de la corteza y lenticelas (puntitos claros).
      c = mezclar(c, [170, 165, 155], 0.4 * transicion(0.55, 0.7, ruido(p.x * 40, p.y * 25, p.z * 40, 3)))
      if (ruido(p.x * 500, p.y * 500, p.z * 500, 1) > 0.86) c = aclarar(c, 1.25)
      // La cicatriz es mas oscura en el centro.
      const k = Math.round(u * nudos)
      const du = ((u - k / nudos) * alto) / 0.005
      const da = diferenciaAngular(a, k * 2.39996 + desfase) / 0.3
      c = mezclar(c, [80, 62, 50], 0.6 * Math.exp(-du * du - da * da))
      // Arriba el tallo es joven: verde y rojizo.
      return mezclar(c, mezclar(YUCA.talloJoven, YUCA.peciolo, 0.3), transicion(0.62, 0.85, u))
    })

    // Copa: las hojas salen de la parte alta en espiral; las de abajo son
    // las mas viejas.
    const hojas = 16 + Math.floor(random() * 6)
    for (let h = 0; h < hojas; h++) {
      const t = h / (hojas - 1)
      const u = 0.6 + t * 0.38
      const angulo = h * 2.39996 + desfase
      hojaDeYuca(malla, centro(u), angulo, 1 - t, random, ruido)
    }
  }
}

// ---------- Banano ----------

const BANANO = {
  vaina: [92, 122, 58],
  manchaVaina: [62, 48, 36],
  seco: [138, 108, 66],
  hoja: [58, 108, 44],
  nervio: [178, 182, 112],
  fruta: [116, 148, 58],
  bellota: [112, 32, 48],
}

// Hoja de banano: peciolo, nervio central grueso y una lamina enorme que el
// viento rasga en tiras siguiendo las venas laterales (que salen casi
// perpendiculares al nervio). Cada tira cuelga un poco distinto.
function hojaDeBanano(malla, origen, azimut, edad, seca, random, ruido) {
  const afuera = vector(Math.cos(azimut), 0, Math.sin(azimut))
  const subida = THREE.MathUtils.degToRad(seca ? -60 : 72 - edad * 50)
  const direccion = afuera.clone().multiplyScalar(Math.cos(subida)).addScaledVector(ARRIBA, Math.sin(subida))
  const largoPeciolo = 0.45
  const largoLamina = seca ? 1.2 : 1.7 + random() * 0.4
  const ancho = 0.27 + random() * 0.04
  const curva = seca ? 0.6 : 0.9 + edad * 1.3
  const nervio = columna(origen, direccion, largoPeciolo + largoLamina, curva, 80)
  const inicio = largoPeciolo / (largoPeciolo + largoLamina)
  const colorHoja = seca ? BANANO.seco : mezclar([82, 132, 52], BANANO.hoja, 0.4 + edad * 0.6)

  // Peciolo y nervio central, en canal y de color claro.
  malla.tubo(
    90,
    10,
    (u) => nervio(u).p,
    (u) => (0.022 - 0.016 * transicion(inicio, 1, u)) * (u > 0.985 ? 0.3 : 1),
    (u, a, p) => {
      const c = seca ? BANANO.seco : mezclar(BANANO.vaina, BANANO.nervio, transicion(0, inicio, u))
      return aclarar(c, 0.88 + ruido(p.x * 120, p.y * 120, p.z * 120, 2) * 0.24)
    },
  )

  const semilla = random() * 100
  for (const lado of [1, -1]) {
    // Donde se rasga: mas cortes en las hojas viejas.
    const cortes = [inicio]
    const cuantos = seca ? 6 : Math.floor(4 + edad * 12 + random() * 4)
    for (let k = 0; k < cuantos; k++) cortes.push(inicio + random() * (1 - inicio))
    cortes.push(1)
    cortes.sort((a, b) => a - b)
    for (let k = 0; k < cortes.length - 1; k++) {
      const [u0, u1] = [cortes[k], cortes[k + 1]]
      if (u1 - u0 < 0.004) continue
      const caidaTira = (seca ? 0.5 : 0.06 + edad * 0.16) + random() * 0.1
      const giroTira = (random() - 0.5) * 0.25
      malla.superficie(Math.max(3, Math.ceil((u1 - u0) * 150)), 16, (s, v) => {
        // La vena lateral sale del nervio en "um" y llega al borde un poco
        // mas hacia la punta.
        const um = u0 + (u1 - u0) * s
        const t = (um - inicio) / (1 - inicio)
        const forma = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t * 2 - 1), 5)), 0.32)
        const anchoAca = ancho * forma * (seca ? 0.45 : 1)
        const { p, tangente } = nervio(Math.min(1, um + v * 0.03 * (1 - inicio)))
        const ladoV = tangente.clone().cross(ARRIBA)
        if (ladoV.lengthSq() < 1e-6) ladoV.set(1, 0, 0)
        ladoV.normalize().multiplyScalar(lado)
        const normal = ladoV.clone().cross(tangente).multiplyScalar(lado).normalize()
        // La lamina cae desde el nervio hacia el borde; las secas se enrollan.
        const caida = (caidaTira * v * v + giroTira * v) * anchoAca * 2
        const onda = Math.sin(um * 90 + semilla) * 0.006 * v
        const q = p
          .clone()
          .addScaledVector(ladoV, v * anchoAca + 0.012)
          .addScaledVector(normal, -caida + onda)
          .addScaledVector(ARRIBA, seca ? -v * anchoAca * 0.6 : 0)

        const fino = ruido(q.x * 140, q.y * 140, q.z * 140, 3)
        let c = aclarar(colorHoja, 0.86 + fino * 0.26)
        // Venas laterales finas y paralelas: rayas apenas mas claras.
        const raya = Math.abs(Math.sin(um * 900 + v * 3))
        c = aclarar(c, 1 + 0.05 * (raya > 0.92 ? 1 : 0))
        if (!seca) {
          // Borde seco y marron, solo en algunos tramos y mas en las hojas viejas.
          const tramoSeco = transicion(0.45, 0.6, ruido(um * 8 + semilla, lado, 3, 2))
          const bordeSeco = transicion(0.92 - edad * 0.1, 1, v + (fino - 0.5) * 0.1) * tramoSeco
          c = mezclar(c, BANANO.seco, bordeSeco * 0.8)
          // Hojas viejas: manchas amarillentas.
          const mancha = ruido(q.x * 18 + semilla, q.y * 18, q.z * 18, 3)
          c = mezclar(c, [150, 150, 70], transicion(0.6, 0.7, mancha) * edad * 0.5)
        } else {
          c = mezclar(c, [95, 72, 48], transicion(0.4, 0.7, fino))
        }
        return { p: q, c }
      })
    }
  }
}

// Platano o banano: el falso tallo (vainas de las hojas enrolladas unas sobre
// otras, verdes con manchas oscuras y tiras secas), la corona de hojas
// enormes, las hojas viejas secas colgando y el racimo: el raquis que se
// curva hacia abajo con las manos de bananos (los dedos curvados hacia
// arriba) y la bellota morada en la punta.
// Correccion - Poll: los dedos del racimo quedaban abiertos en la punta del pedunculo
export function banano(malla, random, ruido) {
  suelo(malla, 0.8, 0.1, ruido)
  const alto = 2.3 + random() * 0.4
  const inclinacion = vector(random() - 0.5, 0, random() - 0.5).multiplyScalar(0.08)
  const centro = (u) => vector(0, -0.02 + alto * u, 0).addScaledVector(inclinacion, u * u * alto)
  const radio = (u, a) => {
    // Mas grueso abajo (el cormo) y bordes de las vainas que se superponen.
    let r = 0.16 - 0.06 * u + 0.05 * Math.exp(-u * 25)
    const vaina = (((a / (Math.PI * 2) + u * 0.7) % 1) + 1) % 1
    r += 0.006 * vaina
    return r * (u > 0.985 ? 0.8 : 1)
  }
  malla.tubo(220, 64, centro, radio, (u, a, p) => {
    const vetas = ruido(p.x * 60, p.y * 4, p.z * 60, 3)
    let c = aclarar(BANANO.vaina, 0.82 + vetas * 0.36)
    // Manchas oscuras de la vaina.
    const mancha = ruido(p.x * 14, p.y * 5, p.z * 14, 4)
    c = mezclar(c, BANANO.manchaVaina, transicion(0.6, 0.66, mancha) * 0.85)
    // Tiras secas abajo, peladas a lo largo.
    const seca = ruido(p.x * 25, p.y * 1.5, p.z * 25, 3)
    c = mezclar(c, BANANO.seco, transicion(0.58, 0.64, seca) * (1 - transicion(0.08, 0.3, u)))
    return mezclar(c, [75, 60, 45], 0.6 * (1 - transicion(0, 0.05, u)))
  })

  const tope = centro(1)
  const hojas = 8 + Math.floor(random() * 3)
  const giro = random() * 6
  for (let h = 0; h < hojas; h++) {
    const edad = 1 - h / (hojas - 1)
    const origen = tope.clone().addScaledVector(ARRIBA, -0.25 * edad)
    hojaDeBanano(malla, origen, h * 2.39996 + giro, edad, false, random, ruido)
  }
  // Dos hojas viejas secas colgando contra el falso tallo.
  for (let h = 0; h < 2; h++) {
    hojaDeBanano(malla, centro(0.85 - h * 0.08), giro + h * 2.5 + 1, 1, true, random, ruido)
  }

  // Racimo: el raquis sale de la punta, se arquea hacia afuera y cuelga.
  const lado = giro + 1.3
  const afuera = vector(Math.cos(lado), 0, Math.sin(lado))
  const raquis = columna(tope.clone().addScaledVector(afuera, 0.12), afuera.clone().addScaledVector(ARRIBA, 0.3).normalize(), 1.25, 2.2, 80)
  malla.tubo(
    90,
    12,
    (u) => raquis(u).p,
    () => 0.022,
    (u, a, p) => aclarar([95, 105, 55], 0.85 + ruido(p.x * 80, p.y * 80, p.z * 80, 2) * 0.3),
  )

  // Manos: de 6 a 8, cada una con dos filas de dedos en media corona
  // alrededor del raquis, curvados hacia arriba.
  const manos = 6 + Math.floor(random() * 3)
  for (let m = 0; m < manos; m++) {
    const u = 0.42 + (m / manos) * 0.42
    const { p: centroMano, tangente } = raquis(u)
    const tamano = 1 - (m / manos) * 0.35
    for (let fila = 0; fila < 2; fila++) {
      const dedos = 7 + Math.floor(random() * 3) - fila
      for (let d = 0; d < dedos; d++) {
        const alrededor = (d / (dedos - 1) - 0.5) * Math.PI * 1.25 + m * 1.9 + fila * 0.2
        let salida = girar(afuera.clone().cross(ARRIBA).normalize(), tangente, alrededor)
        salida = salida.addScaledVector(tangente, -0.25).normalize()
        const desde = centroMano.clone().addScaledVector(tangente, fila * 0.035).addScaledVector(salida, 0.02)
        const largo = (0.17 + random() * 0.03) * tamano
        // Los dedos se curvan hacia arriba, contra la gravedad.
        const eje = salida.clone().cross(ARRIBA).normalize()
        const dedo = (s) => {
          const giroDedo = girar(salida, eje, s * 1.3)
          return desde.clone().addScaledVector(salida, largo * s * 0.6).addScaledVector(giroDedo, largo * s * 0.4)
        }
        malla.tubo(
          16,
          10,
          dedo,
          (s, a) => 0.018 * tamano * Math.pow(Math.sin(Math.PI * Math.min(1, 0.05 + s * 0.97)), 0.45) * (1 + 0.07 * Math.cos(a * 5)),
          (s, a, p) => {
            let c = aclarar(BANANO.fruta, 0.88 + ruido(p.x * 200, p.y * 200, p.z * 200, 2) * 0.22)
            // Aristas un poco mas claras y la punta negra.
            c = aclarar(c, 1 + 0.06 * Math.cos(a * 5))
            return mezclar(c, [45, 38, 30], transicion(0.9, 0.97, s))
          },
          { tapas: true },
        )
      }
    }
  }

  // Bellota: la flor masculina al final del raquis, en forma de gota,
  // con bracteas superpuestas moradas.
  const finRaquis = raquis(1)
  const bellota = (s) => finRaquis.p.clone().addScaledVector(finRaquis.tangente, s * 0.28)
  malla.tubo(
    40,
    32,
    bellota,
    (s, a) => 0.07 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.02 + s * 0.98)), 0.7) * (0.6 + 0.4 * (1 - s)) * (1 + 0.04 * Math.cos(a * 6 + s * 8)),
    (s, a, p) => {
      const bractea = 0.5 + 0.5 * Math.cos(a * 6 + s * 8)
      const c = aclarar(BANANO.bellota, 0.8 + bractea * 0.25 + ruido(p.x * 150, p.y * 150, p.z * 150, 2) * 0.15)
      return mezclar(c, [150, 60, 70], 0.3 * s)
    },
  )
}

// ---------- Pina ----------

const PINA = {
  hoja: [88, 108, 72],
  hojaRojiza: [128, 86, 74],
  plata: [150, 160, 145],
  verde: [118, 132, 48],
  madura: [212, 148, 42],
  surco: [70, 64, 30],
  bractea: [125, 98, 55],
}

// Hoja de pina: larga, angosta, rigida y en canal (como una U), con dientes
// en el borde, el reves plateado y la punta seca.
function hojaDePina(malla, origen, azimut, subida, largo, ancho, curvatura, colorBase, random, ruido) {
  const afuera = vector(Math.cos(azimut), 0, Math.sin(azimut))
  const direccion = afuera.clone().multiplyScalar(Math.cos(subida)).addScaledVector(ARRIBA, Math.sin(subida))
  const vena = columna(origen, direccion, largo, curvatura, 40)
  const semilla = random() * 100
  const puntaSeca = random() < 0.5 ? 0.9 + random() * 0.06 : 1.1
  malla.superficie(56, 6, (u, v) => {
    const { p, tangente } = vena(u)
    const lado = tangente.clone().cross(ARRIBA)
    if (lado.lengthSq() < 1e-6) lado.set(1, 0, 0)
    lado.normalize()
    const normal = lado.clone().cross(tangente).normalize()
    const s = v * 2 - 1
    // Angosta y en punta; los dientes del borde hacen un serrucho.
    const diente = 1 + 0.08 * ((u * 70) % 1)
    const anchoAca = ancho * Math.pow(1 - u, 0.6) * (0.7 + 0.3 * transicion(0, 0.06, u)) * diente
    const q = p.clone().addScaledVector(lado, s * anchoAca).addScaledVector(normal, s * s * anchoAca * 0.45)
    const fino = ruido(q.x * 50, q.y * 300, q.z * 50, 3)
    let c = aclarar(colorBase, 0.85 + fino * 0.28)
    // Lineas a lo largo y polvillo plateado hacia los bordes.
    c = aclarar(c, 1 + 0.06 * Math.sin(s * 22 + semilla))
    c = mezclar(c, PINA.plata, 0.35 * s * s)
    return { p: q, c: mezclar(c, [140, 110, 70], transicion(puntaSeca, puntaSeca + 0.04, u)) }
  })
}

// Mata de pina: la roseta de hojas en espiral y, en el centro, la fruta sobre
// su tallo corto: los "ojos" (cada uno una flor) siguen dos familias de
// espirales, 8 en un sentido y 13 en el otro (numeros de Fibonacci), como
// en la fruta real; madura de abajo hacia arriba y tiene su corona.
export function pina(malla, random, ruido) {
  suelo(malla, 0.6, 0.08, ruido)
  const hojas = 46
  for (let h = 0; h < hojas; h++) {
    const t = h / hojas
    // Afuera las hojas son largas y abiertas; adentro, cortas y erguidas.
    const largo = 0.95 - t * 0.35 + random() * 0.08
    const subida = THREE.MathUtils.degToRad(28 + t * 45 + random() * 8)
    const colorHoja = mezclar(PINA.hoja, PINA.hojaRojiza, random() < 0.3 ? 0.5 * random() : 0)
    hojaDePina(malla, vector(0, 0.08 + t * 0.12, 0), h * 2.39996, subida, largo, 0.032, 0.9 - t * 0.4, colorHoja, random, ruido)
  }

  // Tallo de la fruta.
  const pie = 0.2
  const altoTallo = 0.32
  malla.tubo(
    20,
    12,
    (u) => vector(0, pie + u * altoTallo, 0),
    () => 0.018,
    (u, a, p) => aclarar([110, 120, 70], 0.9 + ruido(p.x * 90, p.y * 90, p.z * 90, 2) * 0.2),
  )

  frutaDePina(malla, pie + altoTallo - 0.01, random, ruido)
}

// Fruta de la pina desde su base: un ovoide casi cilindrico cubierto de ojos,
// y la corona arriba.
export function frutaDePina(malla, base, random, ruido) {
  const alto = 0.24
  const radioFruta = (u) => 0.078 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.03 + u * 0.95)), 0.42) * (1 - 0.12 * u)
  const ojos = 150
  const dorado = 2.39996
  const madurez = 0.5 + random() * 0.3
  malla.superficie(150, 120, (u, v) => {
    const a = v * Math.PI * 2
    const r0 = radioFruta(u)
    // El ojo mas cercano y el segundo, midiendo sobre la superficie.
    let [d1, d2, cerca] = [Infinity, Infinity, 0]
    const k = Math.round(u * ojos)
    for (let i = Math.max(0, k - 30); i < Math.min(ojos, k + 30); i++) {
      const dy = (u - (i + 0.5) / ojos) * alto
      const dx = diferenciaAngular(a, i * dorado) * 0.075
      const d = Math.hypot(dx, dy)
      if (d < d1) [d2, d1, cerca] = [d1, d, i]
      else if (d < d2) d2 = d
    }
    const celda = 0.0185
    // Cada ojo es una cupula; el surco entre ojos se hunde.
    const cupula = Math.max(0, 1 - (d1 / celda) ** 2)
    const surco = 1 - transicion(0, 0.004, d2 - d1)
    // La bractea: una puntita que sobresale abajo de cada ojo.
    const dyPunta = (u - (cerca + 0.5) / ojos) * alto + 0.006
    const dxPunta = diferenciaAngular(a, cerca * dorado) * 0.075
    const punta = Math.exp(-((dyPunta / 0.003) ** 2) - (dxPunta / 0.004) ** 2)
    const r = r0 * (0.96 + 0.06 * cupula - 0.03 * surco) + punta * 0.004 * Math.sin(Math.PI * Math.min(1, u * 1.1))
    const p = vector(Math.cos(a) * r, base + u * alto, Math.sin(a) * r)

    // Color: madura de abajo hacia arriba; el centro del ojo mas claro y los
    // surcos y las puntas mas oscuros.
    const fino = ruido(p.x * 400, p.y * 400, p.z * 400, 2)
    let c = mezclar(PINA.madura, PINA.verde, transicion(madurez - 0.3, madurez + 0.3, u))
    c = aclarar(c, 0.8 + cupula * 0.3 + (fino - 0.5) * 0.15)
    c = mezclar(c, PINA.surco, surco * 0.7)
    c = mezclar(c, PINA.bractea, Math.min(1, punta * 1.5))
    return { p, c }
  })

  // Corona: una roseta chica de hojas rigidas y erguidas, mas azuladas.
  const tope = base + alto - 0.01
  for (let h = 0; h < 30; h++) {
    const t = h / 30
    hojaDePina(
      malla,
      vector(0, tope + t * 0.02, 0),
      h * dorado,
      THREE.MathUtils.degToRad(35 + t * 50),
      0.08 + (1 - Math.abs(t - 0.4)) * 0.1,
      0.014,
      0.6,
      mezclar(PINA.hoja, [80, 110, 100], 0.4),
      random,
      ruido,
    )
  }
}


// ---------- Cana de azucar ----------

const CANA = {
  tallo: [168, 152, 78],
  talloMorado: [128, 72, 86],
  cera: [205, 205, 190],
  nudo: [105, 92, 55],
  hoja: [66, 118, 48],
  seca: [170, 145, 96],
}

// Cana de azucar (una cepa): varios tallos que salen juntos del suelo,
// divididos en entrenudos un poco abarrilados, con el anillo del nudo, la
// yema de cada nudo alternando de lado y la franja de cera blanca debajo; las
// hojas largas solo arriba, alternas, y abajo las hojas secas que cuelgan.
export function cana(malla, random, ruido) {
  suelo(malla, 0.7, 0.1, ruido)
  const tallos = 9 + Math.floor(random() * 4)
  for (let s = 0; s < tallos; s++) {
    const alto = 2.6 + random() * 0.9
    const azimut = random() * Math.PI * 2
    const afuera = vector(Math.cos(azimut), 0, Math.sin(azimut))
    const inclinacion = 0.05 + random() * 0.12
    const base = afuera.clone().multiplyScalar(0.02 + random() * 0.12).setY(-0.03)
    const centro = (u) =>
      base
        .clone()
        .addScaledVector(afuera, inclinacion * alto * Math.pow(u, 1.5))
        .addScaledVector(ARRIBA, alto * u)
        .add(vector((ruido(u * 2, s * 5, 0, 2) - 0.5) * 0.1, 0, (ruido(u * 2, s * 5, 9, 2) - 0.5) * 0.1))
    const nudos = Math.floor(alto / (0.13 + random() * 0.04))
    const colorTallo = mezclar(CANA.tallo, CANA.talloMorado, random() * 0.7)
    const radio = (u, a) => {
      const f = (u * nudos) % 1
      const k = Math.round(u * nudos)
      let r = 0.017 * (1 - 0.35 * u)
      // Entrenudo abarrilado y anillo del nudo.
      r *= 1 + 0.03 * Math.sin(Math.PI * f) + 0.06 * Math.exp(-((f / 0.025) ** 2)) + 0.06 * Math.exp(-(((1 - f) / 0.025) ** 2))
      // Yema del nudo, una de cada lado.
      const da = diferenciaAngular(a, k * Math.PI + azimut)
      r += 0.004 * Math.exp(-((((u - k / nudos) * alto - 0.012) / 0.008) ** 2) - (da / 0.35) ** 2)
      return r * (u > 0.97 ? Math.sqrt(Math.max(0, (1 - u) / 0.03)) : 1)
    }
    malla.tubo(nudos * 14, 16, centro, radio, (u, a, p) => {
      const f = (u * nudos) % 1
      const vetas = ruido(p.x * 90, p.y * 3, p.z * 90, 3)
      let c = aclarar(colorTallo, 0.82 + vetas * 0.32)
      // Cera blanca debajo del nudo y el anillo oscuro.
      c = mezclar(c, CANA.cera, 0.5 * transicion(0.8, 0.9, f) * (1 - transicion(0.95, 0.985, f)))
      c = mezclar(c, CANA.nudo, 0.8 * (1 - transicion(0.006, 0.02, Math.min(f, 1 - f))))
      // Restos de vainas secas abajo.
      const resto = ruido(p.x * 30, p.y * 2, p.z * 30, 3)
      c = mezclar(c, CANA.seca, transicion(0.55, 0.62, resto) * (1 - transicion(0.3, 0.55, u)))
      // Arriba el tallo es verde (lo cubren las vainas de las hojas).
      return mezclar(c, [95, 128, 58], transicion(0.62, 0.75, u))
    })

    // Hojas verdes arriba, alternas (una de cada lado), y el cogollo erguido.
    const hojas = 9
    for (let h = 0; h < hojas; h++) {
      const t = h / (hojas - 1)
      const lado = azimut + h * Math.PI + (random() - 0.5) * 0.5
      const subida = THREE.MathUtils.degToRad(45 + t * 35)
      const direccion = vector(Math.cos(lado) * Math.cos(subida), Math.sin(subida), Math.sin(lado) * Math.cos(subida))
      const vieja = 1 - t
      hojaLarga(malla, {
        base: centro(0.64 + t * 0.34),
        direccion,
        largo: 1.1 + random() * 0.4 - t * 0.3,
        ancho: 0.03,
        curvatura: 1.6 + vieja * 1.2,
        giro: (random() - 0.5) * 2,
        onda: 0.04,
        color: (u) => mezclar(mezclar([88, 140, 58], CANA.hoja, vieja), CANA.seca, transicion(0.82, 1, u) * vieja * 0.8),
        ruido,
        semilla: random() * 100,
      })
    }
    // Hojas secas colgando del tallo.
    for (let h = 0; h < 3; h++) {
      const lado = azimut + h * 2.1
      const tono = 0.8 + random() * 0.25
      hojaLarga(malla, {
        base: centro(0.35 + h * 0.08),
        direccion: vector(Math.cos(lado) * 0.5, -0.85, Math.sin(lado) * 0.5).normalize(),
        largo: 0.8 + random() * 0.3,
        ancho: 0.022,
        curvatura: 0.4,
        giro: random() * 3,
        onda: 0.15,
        nervio: 0.2,
        color: () => aclarar(CANA.seca, tono),
        ruido,
        semilla: random() * 100,
      })
    }
  }
}

// Trozo de cana cortada (lo que se cosecha): un tallo con sus nudos y la
// cara del corte, de fibra clara.
// Correccion - Poll: la cara del corte era mas chica que el tallo y dejaba un anillo abierto
export function trozoDeCana(malla, desde, hacia, random, ruido) {
  const largo = desde.distanceTo(hacia)
  const nudos = Math.max(2, Math.round(largo / 0.15))
  const colorTallo = mezclar(CANA.tallo, CANA.talloMorado, random() * 0.7)
  const eje = hacia.clone().sub(desde)
  // Radio del tallo: mas grueso en los nudos.
  const radio = (u) => {
    const f = (u * nudos) % 1
    return 0.018 * (1 + 0.03 * Math.sin(Math.PI * f) + 0.06 * Math.exp(-((f / 0.025) ** 2)) + 0.06 * Math.exp(-(((1 - f) / 0.025) ** 2)))
  }
  malla.tubo(
    nudos * 16,
    20,
    (u) => desde.clone().addScaledVector(eje, u),
    radio,
    (u, a, p) => {
      const f = (u * nudos) % 1
      let c = aclarar(colorTallo, 0.82 + ruido(p.x * 90, p.y * 90, p.z * 3, 3) * 0.32)
      c = mezclar(c, CANA.cera, 0.5 * transicion(0.8, 0.9, f) * (1 - transicion(0.95, 0.985, f)))
      return mezclar(c, CANA.nudo, 0.8 * (1 - transicion(0.006, 0.02, Math.min(f, 1 - f))))
    },
  )
  // Caras del corte, con la fibra en puntitos; del mismo ancho que el tallo
  // en la punta para que no quede ninguna rendija.
  for (const [centro, signo] of [[desde, -1], [hacia, 1]]) {
    const normal = eje.clone().normalize().multiplyScalar(signo)
    const lado = normal.clone().cross(ARRIBA).normalize()
    const otro = normal.clone().cross(lado).normalize()
    const borde = radio(signo < 0 ? 0 : 1)
    malla.superficie(8, 24, (u, v) => {
      const a = v * Math.PI * 2
      const r = borde * u
      const p = centro.clone().addScaledVector(lado, Math.cos(a) * r).addScaledVector(otro, Math.sin(a) * r)
      const fibra = ruido(p.x * 900, p.y * 900, p.z * 900, 1)
      return { p, c: aclarar(mezclar([222, 210, 160], colorTallo, transicion(0.85, 1, u)), 0.88 + fibra * 0.2) }
    })
  }
}

// ---------- Maiz ----------

const MAIZ = {
  tallo: [112, 140, 60],
  hoja: [58, 110, 42],
  espiga: [196, 170, 105],
  tusa: [148, 170, 88],
  pelo: [160, 98, 66],
  raiz: [150, 120, 110],
  grano: [236, 186, 52],
}

// Mata de maiz: un tallo con nudos (los entrenudos mas cortos abajo), las
// raices de anclaje que bajan al suelo desde los primeros nudos, hojas
// largas alternas con el borde ondulado y la vena blanca, la espiga
// (flor macho) arriba y una o dos mazorcas con su tusa y sus pelos.
export function maiz(malla, random, ruido) {
  suelo(malla, 0.5, 0.08, ruido)
  const alto = 2.1 + random() * 0.3
  const inclinado = vector(random() - 0.5, 0, random() - 0.5).multiplyScalar(0.06)
  const centro = (u) => vector(0, -0.02 + alto * u, 0).addScaledVector(inclinado, u * u * alto)
  const nudos = 13
  const nudo = (k) => Math.pow(k / nudos, 1.15)
  const cercano = (u) => Math.round(Math.pow(u, 1 / 1.15) * nudos)
  const radio = (u) => {
    let r = 0.022 * (1 - 0.55 * u) + 0.006 * Math.exp(-u * 30)
    r += 0.0025 * Math.exp(-((((u - nudo(cercano(u))) * alto) / 0.01) ** 2))
    return r * (u > 0.985 ? 0.6 : 1)
  }
  malla.tubo(240, 16, centro, radio, (u, a, p) => {
    let c = aclarar(MAIZ.tallo, 0.85 + ruido(p.x * 60, p.y * 6, p.z * 60, 3) * 0.3)
    c = mezclar(c, [125, 80, 90], 0.45 * (1 - transicion(0.02, 0.15, u)))
    return mezclar(c, [150, 140, 80], 0.5 * Math.exp(-((((u - nudo(cercano(u))) * alto) / 0.006) ** 2)))
  })

  // Raices de anclaje: arcos desde los dos primeros nudos hasta el suelo.
  for (let k = 1; k <= 2; k++) {
    const desde = centro(nudo(k) * 0.5 + 0.01)
    for (let r = 0; r < 8; r++) {
      const ang = (r / 8) * Math.PI * 2 + k
      const hasta = vector(Math.cos(ang) * 0.09, -0.02, Math.sin(ang) * 0.09)
      malla.tubo(
        12,
        5,
        (u) => desde.clone().lerp(hasta, u).addScaledVector(ARRIBA, Math.sin(Math.PI * u) * 0.03),
        (u) => 0.004 * (1 - u * 0.4),
        (u, a, p) => aclarar(MAIZ.raiz, 0.85 + ruido(p.x * 200, p.y * 200, p.z * 200, 2) * 0.3),
      )
    }
  }

  // Hojas alternas, las del medio son las mas largas.
  const giro = random() * Math.PI * 2
  for (let k = 1; k < nudos; k++) {
    const t = k / nudos
    const lado = giro + k * Math.PI + (random() - 0.5) * 0.4
    const subida = THREE.MathUtils.degToRad(35 + t * 30)
    hojaLarga(malla, {
      base: centro(nudo(k)),
      direccion: vector(Math.cos(lado) * Math.cos(subida), Math.sin(subida), Math.sin(lado) * Math.cos(subida)),
      largo: 0.45 + 0.6 * Math.sin(Math.PI * Math.pow(t, 0.8)),
      ancho: 0.075,
      curvatura: 2.1 - t * 0.8,
      giro: (random() - 0.5) * 1.5,
      onda: 0.07,
      color: (u) => mezclar(MAIZ.hoja, [150, 140, 70], transicion(0.88, 1, u) * (k < 4 ? 0.9 : 0.3)),
      ruido,
      semilla: random() * 100,
    })
  }

  // Espiga: un eje central y ramas que se abren y caen, cubiertas de espiguillas.
  const tope = centro(1)
  const ramas = [{ desde: tope, dir: ARRIBA.clone(), largo: 0.3, curva: 0.2 }]
  for (let r = 0; r < 12; r++) {
    const ang = r * 2.39996
    ramas.push({
      desde: tope.clone().addScaledVector(ARRIBA, 0.02 + (r / 12) * 0.08),
      dir: vector(Math.cos(ang), 0.9, Math.sin(ang)).normalize(),
      largo: 0.16 + random() * 0.08,
      curva: 2,
    })
  }
  for (const rama of ramas) {
    const eje = columna(rama.desde, rama.dir, rama.largo, rama.curva, 20)
    malla.tubo(
      30,
      5,
      (u) => eje(u).p,
      (u) => 0.0018 * (1 + 0.9 * Math.max(0, Math.sin(u * 120))) * (1 - u * 0.5),
      (u, a, p) => aclarar(MAIZ.espiga, 0.85 + ruido(p.x * 300, p.y * 300, p.z * 300, 2) * 0.3),
    )
  }

  // Mazorcas: salen del nudo en un pedunculo corto, cubiertas por la tusa,
  // con los pelos (estigmas) asomando por la punta.
  const mazorcas = random() < 0.5 ? 1 : 2
  for (let m = 0; m < mazorcas; m++) {
    const k = 5 - m
    const lado = giro + k * Math.PI + 0.6
    const desde = centro(nudo(k)).addScaledVector(vector(Math.cos(lado), 0, Math.sin(lado)), 0.02)
    const dir = vector(Math.cos(lado) * 0.45, 0.9, Math.sin(lado) * 0.45).normalize()
    mazorcaConTusa(malla, desde, dir, 0.24, random, ruido)
  }
}

// Mazorca envuelta en la tusa, con las puntas de la tusa abiertas y los pelos.
function mazorcaConTusa(malla, desde, dir, largo, random, ruido) {
  const hasta = desde.clone().addScaledVector(dir, largo)
  cuerpo(
    malla,
    desde,
    hasta,
    0.042,
    (u) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + u * 0.92)), 0.55) * (1 - 0.35 * u),
    (u, a, p) => {
      const capa = 0.5 + 0.5 * Math.cos(a * 7 + u * 2)
      return aclarar(mezclar(MAIZ.tusa, [190, 190, 130], 0.2 * capa), 0.85 + ruido(p.x * 120, p.y * 120, p.z * 120, 2) * 0.25)
    },
    { forma: (u, a) => 1 + 0.03 * Math.cos(a * 7 + u * 2), nu: 30, nv: 24 },
  )
  for (let h = 0; h < 3; h++) {
    const ang = h * 2.1
    hojaLarga(malla, {
      base: desde.clone().addScaledVector(dir, largo * 0.85),
      direccion: dir.clone().add(vector(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(0.4)).normalize(),
      largo: 0.08,
      ancho: 0.012,
      curvatura: 1,
      nervio: 0.1,
      color: () => MAIZ.tusa,
      ruido,
      nu: 10,
      nv: 3,
    })
  }
  pelosDeMazorca(malla, hasta, dir, random)
}

// Pelos (estigmas) de la mazorca: hilos finos que salen de la punta y caen.
function pelosDeMazorca(malla, punta, dir, random) {
  for (let p = 0; p < 22; p++) {
    const ang = random() * Math.PI * 2
    const salida = dir.clone().add(vector(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(0.5)).normalize()
    const pelo = columna(punta, salida, 0.06 + random() * 0.04, 2.5, 10)
    const tono = aclarar(MAIZ.pelo, 0.8 + random() * 0.4)
    malla.tubo(10, 3, (u) => pelo(u).p, () => 0.0008, () => tono)
  }
}

// Mazorca (elote) cosechada, acostada: los granos en hileras parejas sobre
// el olote, la tusa abierta hacia atras y los pelos en la punta.
export function mazorca(malla, random, ruido) {
  const largo = 0.2
  const desde = vector(-largo / 2, 0.03, 0)
  const dir = vector(1, 0.05, 0).normalize()
  const hasta = desde.clone().addScaledVector(dir, largo)
  const hileras = 16
  const granosPorHilera = 42
  cuerpo(
    malla,
    desde,
    hasta,
    0.025,
    (u) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.88)), 0.3) * (1 - 0.3 * u),
    (u, a, p) => {
      const fila = (a / (Math.PI * 2)) * hileras
      const columnaGrano = u * granosPorHilera + (Math.floor(fila) % 2) * 0.5
      const fx = Math.abs((fila % 1) - 0.5) * 2
      const fy = Math.abs((columnaGrano % 1) - 0.5) * 2
      const borde = Math.max(fx, fy)
      let c = aclarar(MAIZ.grano, 0.82 + ruido(p.x * 500, p.y * 500, p.z * 500, 2) * 0.25)
      // Corona del grano mas clara y la junta entre granos oscura.
      c = mezclar(c, [250, 225, 140], 0.35 * (1 - borde))
      return mezclar(c, [120, 90, 40], transicion(0.82, 0.98, borde))
    },
    {
      forma: (u, a) => {
        const fila = (a / (Math.PI * 2)) * hileras
        const columnaGrano = u * granosPorHilera + (Math.floor(fila) % 2) * 0.5
        const fx = Math.abs((fila % 1) - 0.5) * 2
        const fy = Math.abs((columnaGrano % 1) - 0.5) * 2
        return 0.94 + 0.07 * (1 - Math.max(fx, fy) ** 3)
      },
      nu: 200,
      nv: 128,
    },
  )
  // Hojas de la tusa abiertas hacia atras.
  for (let h = 0; h < 6; h++) {
    const ang = (h / 6) * Math.PI * 2
    hojaLarga(malla, {
      base: desde.clone().addScaledVector(dir, 0.015),
      direccion: vector(-0.6, Math.cos(ang) * 0.6, Math.sin(ang) * 0.6).normalize(),
      largo: 0.17 + random() * 0.04,
      ancho: 0.03,
      curvatura: -1.4,
      giro: random(),
      nervio: 0.05,
      color: (u) => mezclar(MAIZ.tusa, [215, 205, 150], u * 0.5),
      ruido,
      nu: 24,
      nv: 6,
    })
  }
  // Pedunculo cortado y los pelos.
  cuerpo(malla, desde.clone().addScaledVector(dir, -0.03), desde.clone().addScaledVector(dir, 0.01), 0.012, () => 1, () => [160, 165, 110], { nu: 4, nv: 14 })
  pelosDeMazorca(malla, hasta, dir, random)
}

// ---------- Arroz ----------

const ARROZ = {
  tallo: [118, 145, 70],
  hoja: [72, 128, 52],
  grano: [208, 180, 98],
}

// Grano de arroz con cascara: alargado, con las aristas de la cascara.
export function granoDeArroz(malla, centro, eje, ruido, color = ARROZ.grano) {
  cuerpo(
    malla,
    centro.clone().addScaledVector(eje, -0.004),
    centro.clone().addScaledVector(eje, 0.004),
    0.0019,
    PERFILES.esfera,
    (u, a, q) => aclarar(color, 0.85 + 0.12 * Math.cos(a * 4) + ruido(q.x * 900, q.y * 900, q.z * 900, 1) * 0.1),
    { nu: 6, nv: 6 },
  )
}

// Macolla de arroz: muchos tallos finos que salen juntos y se abren en
// abanico, cada uno con hojas angostas, la hoja bandera y la panicula que se
// dobla por el peso de los granos.
export function arroz(malla, random, ruido) {
  suelo(malla, 0.4, 0.05, ruido)
  const tallos = 22
  for (let s = 0; s < tallos; s++) {
    const azimut = random() * Math.PI * 2
    const afuera = vector(Math.cos(azimut), 0, Math.sin(azimut))
    const inclinacion = 0.1 + random() * 0.28
    const alto = 0.85 + random() * 0.2
    const base = afuera.clone().multiplyScalar(random() * 0.04).setY(-0.01)
    const centro = (u) => base.clone().addScaledVector(afuera, inclinacion * alto * Math.pow(u, 1.3)).addScaledVector(ARRIBA, alto * u)
    malla.tubo(30, 6, centro, (u) => 0.003 * (1 - u * 0.4), (u, a, p) => aclarar(ARROZ.tallo, 0.85 + ruido(p.x * 200, p.y * 30, p.z * 200, 2) * 0.3))

    // Hojas angostas y la hoja bandera, mas corta y erguida.
    for (let h = 0; h < 4; h++) {
      const bandera = h === 3
      const lado = azimut + (h % 2 ? 1 : -1) * (0.4 + random() * 0.6)
      const subida = THREE.MathUtils.degToRad(bandera ? 70 : 55 + random() * 15)
      hojaLarga(malla, {
        base: centro(bandera ? 0.78 : 0.12 + h * 0.18),
        direccion: vector(Math.cos(lado) * Math.cos(subida), Math.sin(subida), Math.sin(lado) * Math.cos(subida)),
        largo: bandera ? 0.3 : 0.45 + random() * 0.15,
        ancho: 0.009,
        curvatura: bandera ? 0.6 : 1.6,
        giro: random() * 2,
        nervio: 0.3,
        color: (u) => mezclar(ARROZ.hoja, [170, 160, 90], transicion(0.85, 1, u) * 0.6),
        ruido,
        nu: 24,
        nv: 4,
        semilla: random() * 100,
      })
    }

    // Panicula: el raquis se dobla y de el cuelgan ramitas llenas de granos.
    const raquis = columna(centro(1), centro(1).sub(centro(0.95)).normalize(), 0.22, 2.2, 20)
    malla.tubo(20, 4, (u) => raquis(u).p, () => 0.0012, () => ARROZ.tallo)
    for (let r = 0; r < 8; r++) {
      const { p: desde, tangente } = raquis(0.15 + r * 0.1)
      const ang = r * 2.39996
      const salida = tangente.clone().add(vector(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(0.6)).normalize()
      const rama = columna(desde, salida, 0.06 + random() * 0.04, 1.8, 10)
      malla.tubo(8, 3, (u) => rama(u).p, () => 0.0007, () => ARROZ.tallo)
      for (let g = 0; g < 7; g++) {
        const { p, tangente: eje } = rama(0.2 + g * 0.12)
        const lado = eje.clone().cross(ARRIBA).normalize().multiplyScalar(g % 2 ? 0.003 : -0.003)
        granoDeArroz(malla, p.clone().add(lado), eje, ruido)
      }
    }
  }
}

// ---------- Palma aceitera ----------

const PALMA = {
  tronco: [108, 94, 72],
  musgo: [92, 108, 58],
  raquis: [120, 128, 70],
  foliolo: [52, 98, 40],
  fruto: [205, 75, 30],
  frutoOscuro: [45, 28, 22],
}

// Palma aceitera: el tronco cubierto por las bases de las hojas viejas
// (cortadas en la cosecha) en espiral, la corona de hojas pinnadas enormes
// con los foliolos en dos planos, y los racimos de frutos rojos y negros
// entre las bases de las hojas.
export function palma(malla, random, ruido) {
  suelo(malla, 1.2, 0.12, ruido)
  const altoTronco = 3.2
  const bases = 90
  malla.tubo(
    160,
    64,
    (u) => vector(0, -0.05 + altoTronco * u, 0),
    (u, a) => {
      const { d1 } = celdas(u, a, bases, altoTronco, 0.32)
      // Cada base de hoja sobresale del tronco.
      return 0.3 + 0.12 * Math.exp(-u * 12) + 0.08 * Math.max(0, 1 - d1 / 0.11)
    },
    (u, a, p) => {
      const { d1, d2 } = celdas(u, a, bases, altoTronco, 0.32)
      let c = aclarar(PALMA.tronco, 0.75 + ruido(p.x * 30, p.y * 30, p.z * 30, 3) * 0.4)
      // Huecos oscuros entre bases y musgo.
      c = aclarar(c, 0.55 + 0.45 * transicion(0, 0.03, d2 - d1))
      c = mezclar(c, PALMA.musgo, transicion(0.58, 0.68, ruido(p.x * 8, p.y * 8, p.z * 8, 3)) * 0.7)
      return aclarar(c, 0.85 + 0.25 * (1 - Math.min(1, d1 / 0.11)))
    },
  )

  // Corona de hojas: las de afuera mas viejas y caidas.
  const tope = vector(0, altoTronco, 0)
  const hojas = 26
  for (let h = 0; h < hojas; h++) {
    const edad = 1 - h / (hojas - 1)
    const azimut = h * 2.39996
    const afuera = vector(Math.cos(azimut), 0, Math.sin(azimut))
    const subida = THREE.MathUtils.degToRad(78 - edad * 45)
    const dir = afuera.clone().multiplyScalar(Math.cos(subida)).addScaledVector(ARRIBA, Math.sin(subida))
    const largo = 4.5 + random() * 1
    const raquis = columna(tope.clone().addScaledVector(ARRIBA, -0.3 * edad), dir, largo, 0.5 + edad * 0.7, 50)
    malla.tubo(50, 8, (u) => raquis(u).p, (u) => 0.06 * (1 - u * 0.85), (u, a, p) => aclarar(PALMA.raquis, 0.8 + ruido(p.x * 40, p.y * 40, p.z * 40, 2) * 0.35))
    // Foliolos de los dos lados, alternando hacia arriba y hacia abajo.
    const foliolos = 70
    for (let f = 0; f < foliolos; f++) {
      const t = 0.22 + (f / foliolos) * 0.76
      const { p, tangente } = raquis(t)
      const lado = tangente.clone().cross(ARRIBA).normalize()
      for (const signo of [1, -1]) {
        const plano = (f + (signo > 0 ? 0 : 1)) % 2 ? 0.45 : -0.25
        const salida = lado.clone().multiplyScalar(signo).addScaledVector(tangente, 0.55).addScaledVector(ARRIBA, plano).normalize()
        hojaLarga(malla, {
          base: p,
          direccion: salida,
          largo: (0.35 + 0.65 * Math.sin(Math.PI * Math.pow((f + 0.5) / foliolos, 0.8))) * 0.95,
          ancho: 0.034,
          curvatura: 0.9,
          nervio: 0.25,
          color: (u) => mezclar(mezclar(PALMA.foliolo, [92, 130, 52], 1 - edad), [150, 130, 70], transicion(0.9, 1, u) * edad * 0.7),
          ruido,
          nu: 10,
          nv: 2,
          semilla: f,
        })
      }
    }
  }

  // Racimos de frutos entre las bases de las hojas.
  for (let r = 0; r < 3; r++) {
    const ang = r * 2.1 + 0.5
    const afuera = vector(Math.cos(ang), 0, Math.sin(ang))
    const desde = tope.clone().addScaledVector(ARRIBA, -0.55).addScaledVector(afuera, 0.32)
    racimoDePalma(malla, desde, desde.clone().addScaledVector(afuera, 0.32).addScaledVector(ARRIBA, -0.12), ruido)
  }
}

// Racimo de palma: un ovoide cubierto de frutos apretados, rojos abajo y
// negros arriba (donde les da el sol), con las juntas oscuras entre ellos.
export function racimoDePalma(malla, desde, hacia, ruido) {
  const largo = desde.distanceTo(hacia)
  const frutos = 160
  const radio = 0.2
  cuerpo(
    malla,
    desde,
    hacia,
    radio,
    PERFILES.huevo,
    (u, a, p) => {
      const { d1, d2 } = celdas(u, a, frutos, largo, radio)
      const frutoAca = Math.max(0, 1 - d1 / 0.045)
      let c = mezclar(PALMA.fruto, PALMA.frutoOscuro, transicion(0.3, 0.7, ruido(p.x * 6, p.y * 6, p.z * 6, 2) + u * 0.3))
      c = aclarar(c, 0.75 + frutoAca * 0.45)
      return mezclar(c, [60, 45, 30], 1 - transicion(0, 0.012, d2 - d1))
    },
    {
      forma: (u, a) => {
        const { d1 } = celdas(u, a, frutos, largo, radio)
        return 0.9 + 0.12 * Math.max(0, 1 - (d1 / 0.045) ** 2)
      },
      nu: 90,
      nv: 72,
    },
  )
}
