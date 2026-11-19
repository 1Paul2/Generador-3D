import { procesar } from './procesar.js'

// Proceso aparte (Web Worker): recibe un pedido, genera el modelo y devuelve
// la malla. Los arreglos se transfieren sin copiarlos, para que sea rapido.
self.onmessage = ({ data: { numero, datos } }) => {
  try {
    const resultado = procesar(datos)
    const transferibles = resultado.atributos
      ? [
          ...Object.values(resultado.atributos).map((a) => a.buffer),
          ...(resultado.indices ? [resultado.indices.buffer] : []),
          ...(resultado.foto ? [resultado.foto.textura.pixeles.buffer] : []),
        ]
      : []
    self.postMessage({ numero, resultado }, transferibles)
  } catch (error) {
    self.postMessage({ numero, error: error.message })
  }
}
