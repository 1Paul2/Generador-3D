// Descarga una imagen y la dibuja en un lienzo para poder leer sus pixeles.
// Las partes transparentes (fondos de dibujos y esquemas) se rellenan con el
// color promedio de la imagen, asi quedan como un fondo parejo.
// Devuelve null si la imagen no carga o el sitio no permite leer sus colores.
export function cargarImagen(url, lado = 512) {
  return new Promise((resolver) => {
    const elemento = new Image()
    elemento.crossOrigin = 'anonymous'
    elemento.onload = () => {
      const escala = Math.min(1, lado / Math.max(elemento.naturalWidth, elemento.naturalHeight))
      const lienzo = document.createElement('canvas')
      lienzo.width = Math.max(1, Math.round(elemento.naturalWidth * escala))
      lienzo.height = Math.max(1, Math.round(elemento.naturalHeight * escala))
      const contexto = lienzo.getContext('2d', { willReadFrequently: true })
      contexto.drawImage(elemento, 0, 0, lienzo.width, lienzo.height)

      try {
        const promedio = colorPromedio(contexto.getImageData(0, 0, lienzo.width, lienzo.height).data)
        contexto.globalCompositeOperation = 'destination-over'
        contexto.fillStyle = `rgb(${promedio.join(',')})`
        contexto.fillRect(0, 0, lienzo.width, lienzo.height)
        const { data } = contexto.getImageData(0, 0, lienzo.width, lienzo.height)
        resolver({ ancho: lienzo.width, alto: lienzo.height, pixeles: data })
      } catch {
        resolver(null)
      }
    }
    elemento.onerror = () => resolver(null)
    elemento.src = url
  })
}

// Promedio de los pixeles que no son transparentes.
function colorPromedio(pixeles) {
  const suma = [0, 0, 0]
  let cuenta = 0
  for (let i = 0; i < pixeles.length; i += 4) {
    if (pixeles[i + 3] < 128) continue
    suma[0] += pixeles[i]
    suma[1] += pixeles[i + 1]
    suma[2] += pixeles[i + 2]
    cuenta++
  }
  return cuenta ? suma.map((valor) => Math.round(valor / cuenta)) : [200, 200, 200]
}
