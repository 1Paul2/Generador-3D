import { useRef, useState } from 'react'
import { VOCABULARIO, normalizar } from '../parser/interpretar.js'
import { sugerirTitulos } from '../busqueda/wikipedia.js'

// Milisegundos sin escribir antes de pedir sugerencias a Wikipedia, para no
// hacer una consulta por cada tecla.
const ESPERA = 350

// Completa la ultima palabra con el vocabulario propio: "esfera ro" -> "esfera rojo".
function completarConVocabulario(texto) {
  const ultima = texto.split(' ').pop()
  if (ultima.length < 2) return ''
  const buscada = normalizar(ultima)
  const palabra = VOCABULARIO.find(
    (candidata) => normalizar(candidata).startsWith(buscada) && candidata.length > ultima.length,
  )
  return palabra ? texto + palabra.slice(ultima.length) : ''
}

// Lo que falta escribir si algun titulo empieza igual que lo escrito.
function restoDelTitulo(escrito, titulos) {
  const titulo = titulos.find(
    (candidato) =>
      normalizar(candidato).startsWith(normalizar(escrito)) && candidato.length > escrito.length,
  )
  return titulo ? titulo.slice(escrito.length) : ''
}

// Pide a Wikipedia titulos que continuen la frase completa; si no hay, prueba
// solo con la ultima palabra: "casa en la mont" -> "casa en la montaña".
async function completarConWikipedia(texto, senal) {
  const resto = restoDelTitulo(texto, await sugerirTitulos(texto, senal))
  if (resto || !texto.includes(' ')) return resto ? texto + resto : ''

  const ultima = texto.split(' ').pop()
  const restoUltima = restoDelTitulo(ultima, await sugerirTitulos(ultima, senal))
  return restoUltima ? texto + restoUltima : ''
}

export default function Buscador({ onBuscar }) {
  const [texto, setTexto] = useState('')
  const [sugerencia, setSugerencia] = useState('')
  const espera = useRef(null)
  const consulta = useRef(null)

  function cancelarConsulta() {
    clearTimeout(espera.current)
    consulta.current?.abort()
  }

  function cambiar(evento) {
    const nuevo = evento.target.value
    setTexto(nuevo)
    cancelarConsulta()

    const local = completarConVocabulario(nuevo)
    setSugerencia(local)
    if (local || nuevo.trim().length < 3 || nuevo.endsWith(' ')) return

    espera.current = setTimeout(async () => {
      const controlador = new AbortController()
      consulta.current = controlador
      const deWikipedia = await completarConWikipedia(nuevo, controlador.signal)
      if (!controlador.signal.aborted) setSugerencia(deWikipedia)
    }, ESPERA)
  }

  // Tab acepta la sugerencia; Escape la descarta.
  function tecla(evento) {
    if (evento.key === 'Tab' && sugerencia) {
      evento.preventDefault()
      setTexto(sugerencia)
      setSugerencia('')
    }
    if (evento.key === 'Escape') setSugerencia('')
  }

  function enviar(evento) {
    evento.preventDefault()
    cancelarConsulta()
    setSugerencia('')
    if (texto.trim()) onBuscar(texto.trim())
  }

  const visible = sugerencia.startsWith(texto) ? sugerencia.slice(texto.length) : ''

  return (
    <form className="buscador" onSubmit={enviar}>
      <div className="campo">
        <div className="fantasma" aria-hidden="true">
          <span className="escrito">{texto}</span>
          {visible}
        </div>
        <input
          type="text"
          value={texto}
          onChange={cambiar}
          onKeyDown={tecla}
          placeholder="Escribe algo: esfera roja, Tierra, volcán..."
          aria-label="Qué quieres generar"
          autoComplete="off"
          spellCheck="false"
        />
        {visible && <kbd className="tecla-tab">Tab</kbd>}
      </div>
      <button type="submit">Generar</button>
    </form>
  )
}
