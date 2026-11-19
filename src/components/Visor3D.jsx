import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Fragmentos from './Fragmentos.jsx'

// Escena 3D con fondo transparente: luces, camara orbital y el modelo que se va armando.
export default function Visor3D({ modelo, onProgreso }) {
  const centro = modelo ? modelo.altura / 2 : 0

  return (
    <Canvas camera={{ position: [20, 16, 24], fov: 45 }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[12, 25, 15]} intensity={1.6} />
      <directionalLight position={[-15, 10, -10]} intensity={0.4} />

      {modelo && (
        <Fragmentos
          key={modelo.id}
          fragmentos={modelo.fragmentos}
          colorBase={modelo.color}
          onProgreso={onProgreso}
        />
      )}

      <OrbitControls makeDefault enableDamping target={[0, centro, 0]} />
    </Canvas>
  )
}
