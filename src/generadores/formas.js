import * as THREE from 'three'

// Construye la superficie lisa de cada forma, apoyada sobre y = 0 y centrada en x y z.

function crearCubo(tamano) {
  const lado = 8 * tamano
  return new THREE.BoxGeometry(lado, lado, lado).translate(0, lado / 2, 0)
}

function crearEsfera(tamano) {
  const radio = 6 * tamano
  return new THREE.SphereGeometry(radio, 64, 32).translate(0, radio, 0)
}

// Un cono de 4 lados es una piramide; se gira 45 grados para que sus caras
// queden de frente, y se recalculan las normales para que cada cara sea plana.
function crearPiramide(tamano) {
  const mitad = 6.5 * tamano
  const alto = 9 * tamano
  const geometria = new THREE.ConeGeometry(mitad * Math.SQRT2, alto, 4, 1)
    .rotateY(Math.PI / 4)
    .translate(0, alto / 2, 0)
    .toNonIndexed()
  geometria.computeVertexNormals()
  return geometria
}

const FORMAS = {
  cubo: crearCubo,
  esfera: crearEsfera,
  piramide: crearPiramide,
}

export function crearForma(receta) {
  const geometria = FORMAS[receta.tipo](receta.tamano)
  geometria.computeBoundingBox()
  return { geometria, altura: geometria.boundingBox.max.y }
}
