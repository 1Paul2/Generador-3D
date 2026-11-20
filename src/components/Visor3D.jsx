import { useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import Destellos from './Destellos.jsx'
import Efectos from './Efectos.jsx'
import { VISTA } from '../generadores/formas.js'

// Espacio libre alrededor del modelo al encuadrarlo (1 = justo al borde de la vista).
const MARGEN = 1.15

// Encuadre automatico: mide la esfera que envuelve al modelo y pone la camara
// a la distancia justa para que entre en la vista, mirando a su centro real y
// desde la misma direccion de siempre. Asi un modelo chico no queda perdido y
// uno grande no se sale de la pantalla. Sin modelo, vuelve a la vista inicial.
function Encuadre({ modelo }) {
  const camara = useThree((estado) => estado.camera)
  const controles = useThree((estado) => estado.controls)

  useEffect(() => {
    if (!controles) return
    const centro = new THREE.Vector3()
    let distancia = new THREE.Vector3(...VISTA).length()
    if (modelo) {
      modelo.geometria.computeBoundingSphere()
      const { center, radius } = modelo.geometria.boundingSphere
      centro.copy(center)
      distancia = (radius / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2))) * MARGEN
    }
    const direccion = new THREE.Vector3(...VISTA).normalize()
    camara.position.copy(centro).addScaledVector(direccion, distancia)
    controles.target.copy(centro)
    controles.update()
  }, [modelo, camara, controles])

  return null
}

// Iluminacion de estudio: un cuarto virtual con paredes y lamparas, generado en
// el navegador (no se descarga nada), se convierte en un mapa de entorno. Asi
// cada objeto recibe luz y reflejos desde todas las direcciones, como en una
// foto de producto, y el metal o el cristal reflejan de verdad.
function Entorno() {
  const renderizador = useThree((estado) => estado.gl)
  const textura = useMemo(() => {
    const generador = new THREE.PMREMGenerator(renderizador)
    const cuarto = new RoomEnvironment()
    const resultado = generador.fromScene(cuarto, 0.04).texture
    generador.dispose()
    return resultado
  }, [renderizador])
  useEffect(() => () => textura.dispose(), [textura])
  return <primitive object={textura} attach="environment" />
}

// Escena 3D con fondo transparente: luces, camara orbital y los destellos que arman el modelo.
// Luz de estudio (mapa de entorno), una luz principal que proyecta sombras
// (las partes del objeto se hacen sombra entre si), una de relleno y la luz
// hemisferica (tono frio desde el cielo, calido desde el suelo). La sombra de
// contacto apoya el objeto en el piso.
// listo: el modelo termino de armarse; ahi aparecen sus efectos de luz.
// El paso de la luz calculada a los colores de pantalla es el "neutral", que
// conserva el tono y la saturacion de cada color (con el de cine, el rojo de
// Marte se volvia crema y una piedra gris se veia blanca).
// Correccion - Poll: los colores de la foto se veian desteñidos y demasiado claros
export default function Visor3D({ modelo, desarmar, listo, onProgreso, onDesarmado }) {
  return (
    <Canvas
      shadows
      camera={{ position: VISTA, fov: 45 }}
      gl={{ toneMapping: THREE.NeutralToneMapping }}
      scene={{ environmentIntensity: 0.5 }}
    >
      <Entorno />
      <hemisphereLight args={['#dfe9ff', '#5a4a3a', 0.4]} />
      <directionalLight
        position={[12, 25, 15]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={80}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <directionalLight position={[-15, 10, -10]} intensity={0.3} />

      <Destellos
        modelo={modelo}
        desarmar={desarmar}
        onProgreso={onProgreso}
        onDesarmado={onDesarmado}
      />
      {modelo?.efectos && <Efectos key={modelo.id} efecto={modelo.efectos} activo={listo && !desarmar} />}
      {modelo && (
        <ContactShadows position={[0, -0.02, 0]} scale={40} opacity={0.45} blur={2.4} far={20} />
      )}

      <OrbitControls makeDefault enableDamping />
      <Encuadre modelo={modelo} />
    </Canvas>
  )
}
