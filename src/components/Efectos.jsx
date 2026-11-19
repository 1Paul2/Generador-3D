import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Efectos de luz de un modelo armado (ver efectos/planear.js). Cada efecto es
// un sistema de particulas: cada particula nace en un punto, se mueve segun
// el tipo (sale disparada, sube, cae por gravedad o viaja con la corriente),
// cambia de color al envejecer y se apaga; las que se apagan vuelven a nacer.
// Ademas, segun el tipo, hay un halo de luz y una luz real que ilumina la escena.

const CANTIDAD = { estrella: 520, fuego: 320, lava: 260, brillante: 60, agua: 90, lampara: 0 }

// Colores de cada efecto: al nacer y al apagarse.
const COLORES = {
  estrella: [[1, 0.92, 0.6], [1, 0.42, 0.1]],
  fuego: [[1, 0.9, 0.45], [0.85, 0.15, 0.05]],
  lava: [[1, 0.75, 0.25], [0.6, 0.08, 0.02]],
  brillante: [[1, 1, 1], [0.85, 0.9, 1]],
  agua: [[1, 1, 1], [0.8, 0.92, 1]],
}

// Luz real que emite el efecto: color, intensidad y alcance.
const LUCES = {
  estrella: ['#ffc66b', 60, 0],
  fuego: ['#ff9440', 25, 0],
  lava: ['#ff5a1a', 40, 0],
  lampara: ['#fff1c9', 30, 0],
}

const vertexShader = /* glsl */ `
  attribute float tamano;
  attribute float brillo;
  attribute vec3 tinte;
  varying vec3 vTinte;
  varying float vBrillo;
  void main() {
    vec4 vista = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * vista;
    gl_PointSize = tamano * 300.0 / -vista.z;
    vTinte = tinte;
    vBrillo = brillo;
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vTinte;
  varying float vBrillo;
  void main() {
    // Nucleo brillante que se desvanece hacia los bordes.
    float d = distance(gl_PointCoord, vec2(0.5));
    float fuerza = clamp(0.06 / d - 0.12, 0.0, 1.0);
    gl_FragColor = vec4(vTinte, fuerza * vBrillo);
  }
`

// Halo: un circulo de luz con el centro fuerte y el borde que se desvanece.
function crearHalo() {
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = 128
  const contexto = lienzo.getContext('2d')
  const degrade = contexto.createRadialGradient(64, 64, 0, 64, 64, 64)
  degrade.addColorStop(0, 'rgba(255,255,255,1)')
  degrade.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  degrade.addColorStop(1, 'rgba(255,255,255,0)')
  contexto.fillStyle = degrade
  contexto.fillRect(0, 0, 128, 128)
  const textura = new THREE.CanvasTexture(lienzo)
  textura.colorSpace = THREE.SRGBColorSpace
  return textura
}

// Hace nacer de nuevo la particula i, segun el tipo de efecto.
function nacer(efecto, p, i, random) {
  const k = i * 3
  const puntos = efecto.posiciones?.length ? efecto.posiciones.length / 3 : 0
  const j = puntos ? Math.floor(random() * puntos) * 3 : 0
  const base = puntos ? [efecto.posiciones[j], efecto.posiciones[j + 1], efecto.posiciones[j + 2]] : efecto.centro
  const normal = puntos ? [efecto.normales[j], efecto.normales[j + 1], efecto.normales[j + 2]] : [0, 1, 0]
  p.edad[i] = 0
  p.base.set(base, k)

  if (efecto.tipo === 'estrella') {
    // Llamaradas: salen disparadas hacia afuera desde la superficie.
    const rapidez = 0.6 + random() * 2.2
    p.posicion.set(base, k)
    p.velocidad.set(normal.map((n) => n * rapidez + (random() - 0.5) * 0.4), k)
    p.vida[i] = 1.2 + random() * 2.4
    p.tamano[i] = 0.25 + random() * 0.5
  } else if (efecto.tipo === 'fuego') {
    // Chispas que suben desde arriba del objeto.
    p.posicion.set(base, k)
    p.velocidad.set([(random() - 0.5) * 0.5, 1.3 + random() * 1.6, (random() - 0.5) * 0.5], k)
    p.vida[i] = 0.7 + random() * 1.1
    p.tamano[i] = 0.2 + random() * 0.35
  } else if (efecto.tipo === 'lava') {
    // Chispas de lava: saltan del crater y vuelven a caer por la gravedad.
    const angulo = random() * Math.PI * 2
    const r = random() * efecto.radio * 0.5
    p.posicion.set([efecto.centro[0] + Math.cos(angulo) * r, efecto.centro[1], efecto.centro[2] + Math.sin(angulo) * r], k)
    p.velocidad.set([Math.cos(angulo) * (0.5 + random() * 1.5), 3.5 + random() * 4, Math.sin(angulo) * (0.5 + random() * 1.5)], k)
    p.vida[i] = 1.5 + random() * 1.5
    p.tamano[i] = 0.15 + random() * 0.3
  } else {
    // Destellos de una superficie pulida o del agua: quedan en su lugar.
    p.posicion.set([base[0] + normal[0] * 0.03, base[1] + normal[1] * 0.03, base[2] + normal[2] * 0.03], k)
    p.velocidad.set([0, 0, 0], k)
    p.vida[i] = Infinity
    p.fase[i] = random() * Math.PI * 2
    p.ritmo[i] = 0.6 + random() * 1.6
    p.tamano[i] = efecto.tipo === 'agua' ? 0.18 + random() * 0.25 : 0.25 + random() * 0.4
  }
}

// Estado de la simulacion. Los arreglos que se dibujan (posicion, color,
// brillo, tamano) son los de la propia geometria de los puntos.
function crearSimulacion(efecto, cantidad, geometria) {
  let semilla = 12345
  const random = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647)
  const { position, tinte, brillo, tamano } = geometria.attributes
  const p = {
    efecto,
    random,
    posicion: position.array,
    tinte: tinte.array,
    brillo: brillo.array,
    tamano: tamano.array,
    velocidad: new Float32Array(cantidad * 3),
    base: new Float32Array(cantidad * 3),
    edad: new Float32Array(cantidad),
    vida: new Float32Array(cantidad),
    fase: new Float32Array(cantidad),
    ritmo: new Float32Array(cantidad),
  }
  for (let i = 0; i < cantidad; i++) {
    nacer(efecto, p, i, random)
    // Edades repartidas, para que no nazcan todas a la vez.
    if (Number.isFinite(p.vida[i])) p.edad[i] = random() * p.vida[i]
  }
  tamano.needsUpdate = true
  return p
}

// activo: el modelo ya termino de armarse (los efectos aparecen de a poco).
export default function Efectos({ efecto, activo }) {
  const puntos = useRef()
  const halo = useRef()
  const luz = useRef()
  const intensidad = useRef(0)
  const simulacion = useRef(null)
  const cantidad = CANTIDAD[efecto.tipo] ?? 0

  const geometria = useMemo(() => {
    const nueva = new THREE.BufferGeometry()
    nueva.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cantidad * 3), 3))
    nueva.setAttribute('tinte', new THREE.BufferAttribute(new Float32Array(cantidad * 3), 3))
    nueva.setAttribute('brillo', new THREE.BufferAttribute(new Float32Array(cantidad), 1))
    nueva.setAttribute('tamano', new THREE.BufferAttribute(new Float32Array(cantidad), 1))
    return nueva
  }, [cantidad])
  useEffect(() => () => geometria.dispose(), [geometria])

  const texturaHalo = useMemo(() => (['estrella', 'lampara', 'fuego', 'lava'].includes(efecto.tipo) ? crearHalo() : null), [efecto])
  useEffect(() => () => texturaHalo?.dispose(), [texturaHalo])

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime
    // Aparece y desaparece de a poco.
    intensidad.current += ((activo ? 1 : 0) - intensidad.current) * Math.min(1, dt * 2)
    const fuerza = intensidad.current
    if (puntos.current && simulacion.current?.efecto !== efecto) {
      simulacion.current = crearSimulacion(efecto, cantidad, puntos.current.geometry)
    }
    const p = simulacion.current
    const [nace, muere] = COLORES[efecto.tipo] ?? COLORES.brillante

    for (let i = 0; p && i < cantidad; i++) {
      const k = i * 3
      if (!Number.isFinite(p.vida[i])) {
        // Destellos: titilan en su lugar; en un rio avanzan con la corriente.
        const pulso = Math.max(0, Math.sin(t * p.ritmo[i] + p.fase[i])) ** 10
        p.brillo[i] = pulso * fuerza
        if (efecto.corriente) p.posicion[k + 2] = p.base[k + 2] + ((t * 0.6 + p.fase[i]) % 1.2) - 0.6
        p.tinte.set(nace, k)
        continue
      }
      p.edad[i] += dt
      if (p.edad[i] > p.vida[i]) nacer(efecto, p, i, p.random)
      const vida = p.edad[i] / p.vida[i]
      if (efecto.tipo === 'lava') p.velocidad[k + 1] -= 6 * dt
      if (efecto.tipo === 'fuego') p.velocidad[k] += Math.sin(t * 6 + i) * dt * 0.8
      p.posicion[k] += p.velocidad[k] * dt
      p.posicion[k + 1] += p.velocidad[k + 1] * dt
      p.posicion[k + 2] += p.velocidad[k + 2] * dt
      // Nace brillante, se enfria y se apaga.
      p.brillo[i] = Math.sin(Math.PI * Math.min(1, vida)) * fuerza
      for (let c = 0; c < 3; c++) p.tinte[k + c] = nace[c] + (muere[c] - nace[c]) * vida
    }
    if (puntos.current) {
      const atributos = puntos.current.geometry.attributes
      atributos.position.needsUpdate = true
      atributos.brillo.needsUpdate = true
      atributos.tinte.needsUpdate = true
    }

    // El halo late despacio; el fuego parpadea.
    const latido =
      efecto.tipo === 'fuego'
        ? 0.85 + 0.25 * Math.sin(t * 13) * Math.sin(t * 7.3)
        : efecto.tipo === 'lava'
          ? 0.8 + 0.2 * Math.sin(t * 2.1)
          : 1 + 0.05 * Math.sin(t * 1.5)
    if (halo.current) {
      const escala = (efecto.tipo === 'estrella' ? efecto.radio * 3.4 : efecto.tipo === 'lampara' ? efecto.radio * 2.6 : (efecto.radio ?? 2) * 1.6) * latido
      halo.current.scale.setScalar(escala)
      halo.current.material.opacity = fuerza * (efecto.tipo === 'estrella' ? 0.9 : 0.6)
    }
    if (luz.current) luz.current.intensity = (LUCES[efecto.tipo]?.[1] ?? 0) * fuerza * latido
  })

  const [colorLuz, , alcance] = LUCES[efecto.tipo] ?? []
  const colorHalo = efecto.tipo === 'estrella' ? '#ffb347' : efecto.tipo === 'lampara' ? '#fff3c4' : '#ff7a2e'

  return (
    <>
      {cantidad > 0 && (
        <points ref={puntos} geometry={geometria} frustumCulled={false}>
          <shaderMaterial
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
      {texturaHalo && (
        <sprite ref={halo} position={efecto.centro}>
          <spriteMaterial map={texturaHalo} color={colorHalo} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      )}
      {colorLuz && <pointLight ref={luz} position={efecto.centro} color={colorLuz} intensity={0} distance={alcance} decay={2} />}
    </>
  )
}
