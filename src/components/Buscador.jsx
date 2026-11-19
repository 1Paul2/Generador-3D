import { useState } from 'react'

export default function Buscador({ onBuscar }) {
  const [texto, setTexto] = useState('')

  function enviar(evento) {
    evento.preventDefault()
    if (texto.trim()) onBuscar(texto.trim())
  }

  return (
    <form className="buscador" onSubmit={enviar}>
      <input
        type="search"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="Escribe algo: esfera roja, pirámide grande..."
        aria-label="Qué quieres generar"
      />
      <button type="submit">Generar</button>
    </form>
  )
}
