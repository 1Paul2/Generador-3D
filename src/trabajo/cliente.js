// Habla con el proceso aparte que genera los modelos. Hay un solo proceso,
// que se crea la primera vez que se lo necesita; cada pedido lleva un numero
// para saber a quien le corresponde cada respuesta.

let trabajador = null
let siguiente = 0
const pendientes = new Map()

function obtenerTrabajador() {
  if (trabajador) return trabajador
  trabajador = new Worker(new URL('./generador.worker.js', import.meta.url), { type: 'module' })
  trabajador.onmessage = ({ data: { numero, resultado, error } }) => {
    const pedido = pendientes.get(numero)
    if (!pedido) return
    pendientes.delete(numero)
    if (error) pedido.rechazar(new Error(error))
    else pedido.resolver(resultado)
  }
  return trabajador
}

// Pide generar un modelo (ver procesar.js). Los pixeles de la foto y las
// posiciones del modelo 3D se transfieren al proceso, sin copiarlos.
export function generarEnSegundoPlano(datos) {
  const numero = ++siguiente
  const transferibles = [datos.imagen?.pixeles.buffer, datos.modelo?.buffer].filter(Boolean)
  return new Promise((resolver, rechazar) => {
    pendientes.set(numero, { resolver, rechazar })
    obtenerTrabajador().postMessage({ numero, datos }, transferibles)
  })
}
