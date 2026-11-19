import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Destellos from './Destellos.jsx'
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

// Escena 3D con fondo transparente: luces, camara orbital y los destellos que arman el modelo.
// La luz hemisferica imita el exterior: un tono frio desde el cielo y uno
// calido rebotado desde el suelo. La sombra de contacto apoya el objeto en el piso.
export default function Visor3D({ modelo, desarmar, onProgreso, onDesarmado }) {
  return (
    <Canvas camera={{ position: VISTA, fov: 45 }}>
      <hemisphereLight args={['#dfe9ff', '#5a4a3a', 0.9]} />
      <directionalLight position={[12, 25, 15]} intensity={1.5} />
      <directionalLight position={[-15, 10, -10]} intensity={0.35} />

      <Destellos
        modelo={modelo}
        desarmar={desarmar}
        onProgreso={onProgreso}
        onDesarmado={onDesarmado}
      />
      {modelo && (
        <ContactShadows position={[0, -0.02, 0]} scale={40} opacity={0.45} blur={2.4} far={20} />
      )}

      <OrbitControls makeDefault enableDamping />
      <Encuadre modelo={modelo} />
    </Canvas>
  )
}
