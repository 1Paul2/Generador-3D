import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Destellos from './Destellos.jsx'

// Escena 3D con fondo transparente: luces, camara orbital y los destellos que arman el modelo.
export default function Visor3D({ modelo, onProgreso }) {
  const centro = modelo ? modelo.altura / 2 : 0

  return (
    <Canvas camera={{ position: [20, 16, 24], fov: 45 }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[12, 25, 15]} intensity={1.6} />
      <directionalLight position={[-15, 10, -10]} intensity={0.4} />

      <Destellos modelo={modelo} onProgreso={onProgreso} />

      <OrbitControls makeDefault enableDamping target={[0, centro, 0]} />
    </Canvas>
  )
}
