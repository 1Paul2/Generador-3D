import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Pelaje de los animales, dibujado en capas ("shell fur", la tecnica de los
// videojuegos): la malla se repite varias veces, cada copia un poco mas
// afuera de la piel. En cada capa solo quedan los puntos por donde pasa un
// pelo; como los pelos se afinan hacia la punta, al mirar todas las capas
// juntas se ven mechones de pelo con volumen, y el contorno del animal queda
// peludo en lugar de liso.
// La piel se divide en celdas pequenas y en cada una nace un pelo, con su
// grosor y su largo al azar. Los pelos se oscurecen cerca de la raiz (ahi
// llega menos luz) y caen un poco hacia atras y hacia abajo.

// Cantidad de capas: mas capas, pelo mas continuo.
const CAPAS = 24
// Largo del pelo (con pelo = 1), en unidades de la escena. Corto y pegado,
// como el de un perro o un gato comun: con pelo largo parecian de peluche.
const LARGO = 0.13
// Tamano de la celda de cada pelo, en unidades de la escena: pelos finos y
// densos.
const CELDA = 0.032

const verticeGlsl = /* glsl */ `
  #include <begin_vertex>
  vCapa = capa;
  vPelo = pelo;
  vBase = position;
  float alto = capa * pelo * uLargo;
  // Hacia afuera de la piel, y la punta se acuesta hacia la cola y hacia
  // abajo, como el pelo de un animal de verdad.
  transformed += normal * alto * 0.7 + vec3(-0.8, -0.5, 0.0) * alto * capa;
`

const fragmentoGlsl = /* glsl */ `
  #include <color_fragment>
  if (vPelo < 0.05) discard;
  {
    vec3 q = vBase / uCelda;
    vec3 celda = floor(q);
    float azar = fract(sin(dot(celda, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    vec3 raiz = vec3(
      fract(sin(dot(celda, vec3(269.5, 183.3, 246.1))) * 43758.5453),
      fract(sin(dot(celda, vec3(113.5, 271.9, 124.6))) * 43758.5453),
      fract(sin(dot(celda, vec3(42.7, 89.1, 301.3))) * 43758.5453)
    ) * 0.5 + 0.25;
    float distancia = length(fract(q) - raiz);
    // Cada pelo tiene su largo; mas arriba es mas fino.
    float largoPelo = 0.55 + 0.45 * azar;
    if (vCapa > largoPelo || distancia > 0.55 * (1.0 - vCapa / largoPelo)) discard;
    diffuseColor.rgb *= mix(0.5, 1.08, vCapa / largoPelo);
  }
`

// Correccion - Poll: los animales se veian lisos, como de plastico, sin pelo
export default function Pelaje({ geometria, superficie }) {
  const malla = useRef()

  // Una copia propia de la malla del animal (si compartiera sus datos, al
  // borrar uno se liberarian los del otro), con la capa de cada copia.
  const capas = useMemo(() => {
    const copia = new THREE.BufferGeometry()
    for (const nombre of ['position', 'normal', 'color', 'pelo']) {
      copia.setAttribute(nombre, geometria.attributes[nombre].clone())
    }
    copia.setIndex(geometria.index.clone())
    const capa = Float32Array.from({ length: CAPAS }, (_, i) => (i + 1) / CAPAS)
    copia.setAttribute('capa', new THREE.InstancedBufferAttribute(capa, 1))
    copia.boundingSphere = geometria.boundingSphere
    return copia
  }, [geometria])

  const material = useMemo(() => {
    const nuevo = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
    nuevo.onBeforeCompile = (shader) => {
      shader.uniforms.uLargo = { value: LARGO }
      shader.uniforms.uCelda = { value: CELDA }
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float capa;\nattribute float pelo;\nuniform float uLargo;\nvarying float vCapa;\nvarying float vPelo;\nvarying vec3 vBase;',
        )
        .replace('#include <begin_vertex>', verticeGlsl)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uCelda;\nvarying float vCapa;\nvarying float vPelo;\nvarying vec3 vBase;')
        .replace('#include <color_fragment>', fragmentoGlsl)
    }
    return nuevo
  }, [])

  useEffect(
    () => () => {
      capas.dispose()
      material.dispose()
    },
    [capas, material],
  )

  // El pelo aparece cuando el animal ya esta armado del todo, y se va apenas
  // empieza a desarmarse.
  useFrame(() => {
    if (malla.current) malla.current.visible = (superficie.current?.material.opacity ?? 0) >= 0.99
  })

  return <instancedMesh ref={malla} args={[capas, material, CAPAS]} visible={false} receiveShadow frustumCulled={false} />
}
