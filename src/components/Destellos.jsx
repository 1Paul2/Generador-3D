import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'
import { crearMaterialFoto } from '../efectos/materialFoto.js'
import Pelaje from './Pelaje.jsx'
import { crearRandom } from '../utils/random.js'

const CANTIDAD = 1500

// Segundos que tarda cada destello en volar hasta la superficie.
const VUELO = 1.6

// Segundos que tarda la superficie lisa en aparecer cuando llegan los destellos.
const APARICION = 1.2

// Posicion libre, tamano, color y ritmo de titileo de cada destello. Con la
// potencia alta salen muchos destellos chicos y pocos grandes.
function crearDestellos() {
  const random = crearRandom(2026)
  const posiciones = new Float32Array(CANTIDAD * 3)
  const tintes = new Float32Array(CANTIDAD * 3)
  const tamanos = new Float32Array(CANTIDAD)
  const fases = new Float32Array(CANTIDAD)
  const ritmos = new Float32Array(CANTIDAD)
  const color = new THREE.Color()

  for (let i = 0; i < CANTIDAD; i++) {
    // Punto al azar dentro de una cascara esferica, sin amontonarse en el centro.
    const direccion = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5)
    direccion.normalize().multiplyScalar(5 + random() * 28)
    direccion.toArray(posiciones, i * 3)

    color.setHSL(0.6 + random() * 0.25, 0.8, 0.6 + random() * 0.3)
    color.toArray(tintes, i * 3)

    tamanos[i] = 0.4 + Math.pow(random(), 4) * 4
    fases[i] = random() * Math.PI * 2
    ritmos[i] = 0.6 + random() * 2.4
  }
  return { posiciones, tintes, tamanos, fases, ritmos }
}

const DESTELLOS = crearDestellos()

// Velocidad del desarme comparada con el armado (mas rapido para no hacer esperar).
const VELOCIDAD_DESARME = 1.6

// Elige a que punto de la superficie va cada destello, de que color queda (el
// de la superficie en ese punto) y cuando sale. Salen de abajo hacia arriba,
// con algo de desorden, para que la forma crezca desde la base.
function calcularDestinos(modelo) {
  const destinos = new Float32Array(CANTIDAD * 3)
  const colores = new Float32Array(CANTIDAD * 3)
  const retrasos = new Float32Array(CANTIDAD)
  if (!modelo) return { destinos, colores, retrasos, fin: 0 }

  const random = crearRandom(modelo.semilla)
  const muestreador = new MeshSurfaceSampler(new THREE.Mesh(modelo.geometria))
    .setRandomGenerator(random)
    .build()
  const punto = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const color = new THREE.Color()

  for (let i = 0; i < CANTIDAD; i++) {
    muestreador.sample(punto, normal, color)
    // Un poco hacia afuera, para que la superficie no tape al destello.
    punto.addScaledVector(normal, 0.05).toArray(destinos, i * 3)
    color.toArray(colores, i * 3)
    retrasos[i] = (punto.y / modelo.altura) * 1.8 + random() * 0.9
  }
  return { destinos, colores, retrasos, fin: Math.max(...retrasos) + VUELO }
}

const vertexShader = /* glsl */ `
  uniform float uTiempo;
  uniform float uArmado;
  uniform float uPixeles;
  uniform float uOcultar;
  attribute float tamano;
  attribute float fase;
  attribute float ritmo;
  attribute float retraso;
  attribute vec3 tinte;
  attribute vec3 destino;
  attribute vec3 colorDestino;
  varying vec3 vTinte;
  varying float vBrillo;
  varying float vVisible;

  void main() {
    // Posicion libre: flota y gira lentamente alrededor del centro.
    vec3 libre = position;
    libre.y += sin(uTiempo * 0.3 + fase) * 0.4;
    float c = cos(uTiempo * 0.03);
    float s = sin(uTiempo * 0.03);
    libre = vec3(c * libre.x + s * libre.z, libre.y, -s * libre.x + c * libre.z);

    // Vuelo hacia la superficie: arranca rapido y frena al llegar.
    float t = clamp((uArmado - retraso) / ${VUELO.toFixed(1)}, 0.0, 1.0);
    float k = 1.0 - pow(1.0 - t, 3.0);
    vec4 vista = modelViewMatrix * vec4(mix(libre, destino, k), 1.0);
    gl_Position = projectionMatrix * vista;

    // Titileo: el brillo sube y baja a un ritmo propio de cada destello.
    // Al posarse se achica y toma el color de la superficie en ese punto.
    vBrillo = pow(0.5 + 0.5 * sin(uTiempo * ritmo + fase), 3.0);
    float escala = mix(1.0, 0.35, k);
    gl_PointSize = tamano * escala * uPixeles * 25.0 * (0.5 + 0.7 * vBrillo) * (20.0 / -vista.z);
    vTinte = mix(tinte, colorDestino, k);

    // Los destellos posados se apagan a medida que aparece la superficie.
    vVisible = 1.0 - k * uOcultar;
  }
`

// Correccion - Poll: la pieza armada seguia brillando porque los destellos no se apagaban
const fragmentShader = /* glsl */ `
  varying vec3 vTinte;
  varying float vBrillo;
  varying float vVisible;

  void main() {
    // Nucleo brillante que se desvanece hacia los bordes.
    float distancia = distance(gl_PointCoord, vec2(0.5));
    float fuerza = clamp(0.05 / distancia - 0.1, 0.0, 1.0);
    gl_FragColor = vec4(vTinte, fuerza * (0.2 + 0.8 * vBrillo) * vVisible);
    #include <colorspace_fragment>
  }
`

// Un universo de destellos que titilan y giran. Cuando llega un modelo, cada
// destello vuela a un punto de su superficie y, al juntarse todos, aparece la
// forma lisa mientras los destellos se apagan. Si se pide desarmar, la misma
// animacion corre hacia atras y al terminar se avisa con onDesarmado.
// Correccion - Poll: apagar los destellos sobre la pieza armada y volver al universo al borrar
// Correccion - Poll: la pieza armada no debe tener brillos: superficie mate y destellos ocultos al terminar
export default function Destellos({ modelo, desarmar, onProgreso, onDesarmado }) {
  const puntos = useRef()
  const superficie = useRef()
  const inicio = useRef(null)
  const desarme = useRef(null)
  const llegados = useRef(-1)
  const pixeles = useThree((estado) => estado.viewport.dpr)

  const uniforms = useMemo(
    () => ({
      uTiempo: { value: 0 },
      uArmado: { value: -1000 },
      uPixeles: { value: 1 },
      uOcultar: { value: 0 },
    }),
    [],
  )
  const { destinos, colores, retrasos, fin } = useMemo(() => calcularDestinos(modelo), [modelo])
  const llegadas = useMemo(() => [...retrasos].map((r) => r + VUELO).sort((a, b) => a - b), [retrasos])

  // Si el modelo tiene foto, se pinta pixel por pixel con ella en alta resolucion.
  const luzPropia = ['estrella', 'lampara'].includes(modelo?.efectos?.tipo)
  const brillante = modelo?.efectos?.tipo === 'brillante'
  const conFoto = useMemo(
    () =>
      modelo?.foto
        ? crearMaterialFoto(modelo.foto, { basico: luzPropia, rugosidad: brillante ? 0.22 : 0.85, metal: brillante ? 0.55 : 0 })
        : null,
    [modelo, luzPropia, brillante],
  )
  useEffect(
    () => () => {
      conFoto?.material.dispose()
      conFoto?.textura.dispose()
    },
    [conFoto],
  )

  useEffect(() => {
    inicio.current = null
    llegados.current = -1
    return () => modelo?.geometria.dispose()
  }, [modelo])

  useFrame(({ clock }) => {
    const ahora = clock.elapsedTime
    const material = puntos.current.material
    material.uniforms.uTiempo.value = ahora
    material.uniforms.uPixeles.value = pixeles
    if (!modelo) {
      material.uniforms.uArmado.value = -1000
      material.uniforms.uOcultar.value = 0
      puntos.current.visible = true
      return
    }

    inicio.current ??= ahora
    let armado = ahora - inicio.current

    // Desarmar es retroceder el tiempo del armado: la superficie se desvanece,
    // los destellos reaparecen y vuelven al universo, primero los de arriba.
    // Si se borra a medio armar, se retrocede desde donde iba.
    if (desarmar) {
      desarme.current ??= { inicio: ahora, desde: Math.min(armado, fin + APARICION * 0.4) }
      armado = desarme.current.desde - (ahora - desarme.current.inicio) * VELOCIDAD_DESARME
      if (armado < 0 && !desarme.current.avisado) {
        desarme.current.avisado = true
        onDesarmado()
      }
    } else {
      desarme.current = null
    }

    const aparicion = THREE.MathUtils.clamp((armado - fin + APARICION * 0.6) / APARICION, 0, 1)
    material.uniforms.uArmado.value = armado
    material.uniforms.uOcultar.value = aparicion
    superficie.current.material.opacity = aparicion
    // Con la forma completa no queda ningun destello encima.
    puntos.current.visible = aparicion < 1

    // Porcentaje de destellos que ya llegaron a la superficie.
    const cuantos = llegadas.findIndex((llegada) => llegada > armado)
    const porcentaje = cuantos === -1 ? 100 : Math.floor((cuantos / CANTIDAD) * 100)
    if (porcentaje !== llegados.current) {
      llegados.current = porcentaje
      onProgreso(porcentaje)
    }
  })

  return (
    <>
      <points ref={puntos} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[DESTELLOS.posiciones, 3]} />
          <bufferAttribute attach="attributes-tinte" args={[DESTELLOS.tintes, 3]} />
          <bufferAttribute attach="attributes-tamano" args={[DESTELLOS.tamanos, 1]} />
          <bufferAttribute attach="attributes-fase" args={[DESTELLOS.fases, 1]} />
          <bufferAttribute attach="attributes-ritmo" args={[DESTELLOS.ritmos, 1]} />
          <bufferAttribute attach="attributes-destino" args={[destinos, 3]} />
          <bufferAttribute attach="attributes-colorDestino" args={[colores, 3]} />
          <bufferAttribute attach="attributes-retraso" args={[retrasos, 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {modelo && (
        <mesh key={modelo.id} ref={superficie} geometry={modelo.geometria} castShadow receiveShadow>
          {/* Lo que tiene luz propia (una estrella, una lampara) no depende de
              la iluminacion de la escena; lo pulido (metal, cristal) refleja. */}
          {conFoto ? (
            <primitive object={conFoto.material} attach="material" />
          ) : luzPropia ? (
            <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={0} />
          ) : (
            <meshStandardMaterial
              vertexColors
              roughness={brillante ? 0.22 : 1}
              metalness={brillante ? 0.55 : 0}
              transparent
              opacity={0}
            />
          )}
        </mesh>
      )}
      {/* Los animales llevan pelo dibujado en capas sobre la piel. */}
      {modelo?.geometria.attributes.pelo && (
        <Pelaje key={`pelo-${modelo.id}`} geometria={modelo.geometria} superficie={superficie} />
      )}
    </>
  )
}
