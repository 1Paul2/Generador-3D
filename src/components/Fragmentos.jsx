import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Segundos que tarda cada fragmento en volar hasta su lugar.
const VUELO = 0.9

const auxiliar = new THREE.Object3D()
const color = new THREE.Color()

// Arranca rapido y frena al llegar.
function suavizar(t) {
  return 1 - Math.pow(1 - t, 3)
}

function mezclar(desde, hasta, t) {
  return desde + (hasta - desde) * t
}

// Dibuja todos los fragmentos con una sola malla (InstancedMesh) y los
// anima volando desde su origen hasta su destino.
export default function Fragmentos({ fragmentos, colorBase, onProgreso }) {
  const malla = useRef()
  const inicio = useRef(null)
  const colocados = useRef(-1)

  useLayoutEffect(() => {
    const m = malla.current
    auxiliar.scale.setScalar(0)
    auxiliar.updateMatrix()
    fragmentos.forEach((fragmento, i) => {
      color.set(colorBase).offsetHSL(0, 0, fragmento.variacion)
      m.setColorAt(i, color)
      m.setMatrixAt(i, auxiliar.matrix)
    })
    m.instanceColor.needsUpdate = true
    m.instanceMatrix.needsUpdate = true
  }, [fragmentos, colorBase])

  useFrame(({ clock }) => {
    if (colocados.current === fragmentos.length) return
    inicio.current ??= clock.elapsedTime
    const ahora = clock.elapsedTime - inicio.current
    const m = malla.current
    let listos = 0

    fragmentos.forEach((fragmento, i) => {
      const t = Math.min(Math.max((ahora - fragmento.retraso) / VUELO, 0), 1)
      if (t === 1) listos++
      const k = suavizar(t)
      const { origen, destino } = fragmento

      auxiliar.position.set(
        mezclar(origen[0], destino[0], k),
        mezclar(origen[1], destino[1], k),
        mezclar(origen[2], destino[2], k),
      )
      auxiliar.rotation.set((1 - k) * fragmento.giro, (1 - k) * fragmento.giro, 0)
      auxiliar.scale.setScalar(t === 0 ? 0 : 0.3 + 0.7 * k)
      auxiliar.updateMatrix()
      m.setMatrixAt(i, auxiliar.matrix)
    })

    m.instanceMatrix.needsUpdate = true
    if (listos !== colocados.current) {
      colocados.current = listos
      onProgreso(listos)
    }
  })

  return (
    <instancedMesh ref={malla} args={[null, null, fragmentos.length]}>
      <boxGeometry args={[0.92, 0.92, 0.92]} />
      <meshStandardMaterial roughness={0.6} />
    </instancedMesh>
  )
}
