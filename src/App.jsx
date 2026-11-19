import { useState } from 'react'
import Buscador from './components/Buscador.jsx'
import Visor3D from './components/Visor3D.jsx'
import { interpretar, FORMAS_DISPONIBLES } from './parser/interpretar.js'
import { construir } from './generadores/voxeles.js'
import { crearRandom, semillaDeTexto } from './utils/random.js'
import './App.css'

function App() {
  const [modelo, setModelo] = useState(null)
  const [progreso, setProgreso] = useState(0)
  const [mensaje, setMensaje] = useState('')

  function generar(texto, intento) {
    const receta = interpretar(texto)
    if (!receta) {
      setMensaje(
        `Todavía no sé construir "${texto}". Prueba con: ${FORMAS_DISPONIBLES.join(', ')}.`,
      )
      return
    }
    const random = crearRandom(semillaDeTexto(texto) + intento)
    setModelo({
      ...construir(receta, random),
      id: Date.now(),
      texto,
      intento,
      color: receta.color,
    })
    setProgreso(0)
    setMensaje('')
  }

  const total = modelo?.fragmentos.length ?? 0

  return (
    <>
      <header id="cabecera">
        <h1>Generador 3D</h1>
        <Buscador onBuscar={(texto) => generar(texto, 0)} />
      </header>

      <section id="visor">
        <Visor3D modelo={modelo} onProgreso={setProgreso} />
        {!modelo && !mensaje && (
          <p className="aviso">Escribe una forma arriba para verla armarse.</p>
        )}
        {mensaje && <p className="aviso">{mensaje}</p>}
      </section>

      <div id="estado">
        {modelo ? (
          <>
            <span>
              {progreso < total ? 'Armando' : 'Listo'}: {progreso} / {total}{' '}
              fragmentos
            </span>
            <button
              type="button"
              onClick={() => generar(modelo.texto, modelo.intento + 1)}
            >
              Regenerar
            </button>
          </>
        ) : (
          <span>Sin modelo</span>
        )}
      </div>

      <div className="ticks"></div>

      <section id="contacto">
        <svg className="icon" role="presentation" aria-hidden="true">
          <use href="/icons.svg#social-icon"></use>
        </svg>
        <h2>Conecta conmigo</h2>
        <p>Código y otros proyectos</p>
        <ul>
          <li>
            <a href="https://github.com/1Paul2" target="_blank">
              <svg className="button-icon" role="presentation" aria-hidden="true">
                <use href="/icons.svg#github-icon"></use>
              </svg>
              GitHub
            </a>
          </li>
        </ul>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
