import { useRef, useState } from 'react'
import Buscador from './components/Buscador.jsx'
import Visor3D from './components/Visor3D.jsx'
import { interpretar, FORMAS_DISPONIBLES, NOMBRES_FIGURAS } from './parser/interpretar.js'
import { buscarFoto, buscarModelo3D, clasificarConWikipedia } from './busqueda/wikipedia.js'
import { cargarImagen } from './busqueda/imagen.js'
import { cargarModelo3D } from './busqueda/modelo3d.js'
import { segmentar } from './analisis/segmentar.js'
import { identificarRegiones } from './analisis/regiones.js'
import { crearForma } from './generadores/formas.js'
import { descargarGLB } from './exportar/glb.js'
import { paletaDesdeColor } from './generadores/paleta.js'
import { leerElementos, leerRasgos, leerVolumen } from './parser/rasgos.js'
import { crearRandom, semillaDeTexto } from './utils/random.js'
import './App.css'

const PRUEBA_CON = `Prueba con: ${FORMAS_DISPONIBLES.join(', ')}.`

// Como se construyo el modelo, para mostrarlo debajo del visor.
const METODOS = {
  modelo: 'modelo 3D real',
  torno: 'silueta de la foto, girada',
  inflado: 'silueta de la foto, inflada',
  plano: 'silueta de la foto, plana',
}

function App() {
  const [modelo, setModelo] = useState(null)
  const [progreso, setProgreso] = useState(0)
  const [mensaje, setMensaje] = useState('')
  const [desarmando, setDesarmando] = useState(false)
  // Numero de la busqueda en curso, para descartar respuestas de Wikipedia
  // que llegan tarde cuando el usuario ya busco otra cosa.
  const busqueda = useRef(0)

  // Pasos para generar:
  //   1. Interpretar el texto con el diccionario propio.
  //   2. Si nombra una cosa real o algo desconocido, buscarlo en Wikipedia:
  //      que es, a que figura se parece y si tiene un modelo 3D real.
  //   3. Buscar una foto real y estudiarla: separar el objeto del fondo e
  //      identificar sus partes por color. La foto no se pega en el modelo.
  //   4. Construir la forma.
  async function generar(texto, intento) {
    const id = ++busqueda.current
    const vigente = () => id === busqueda.current
    const receta = interpretar(texto)

    let fuente = null
    if (receta.cosas.length) {
      setMensaje(`Buscando "${receta.cosas.join(' ')}" en Wikipedia...`)
      fuente = await clasificarConWikipedia(receta.cosas)
      if (!vigente()) return
      receta.tipo ??= fuente?.tipo ?? null

      const direccion = fuente && (await buscarModelo3D(fuente.articulo))
      if (!vigente()) return
      if (direccion) {
        setMensaje('Descargando el modelo 3D real...')
        receta.modelo = await cargarModelo3D(direccion)
        if (!vigente()) return
      }
    }

    // Foto real de la cosa, para estudiar su silueta y sus colores.
    let imagen = null
    let segmento = null
    if (fuente) {
      setMensaje('Buscando una foto real...')
      const foto = await buscarFoto(fuente.articulo)
      imagen = foto && (await cargarImagen(foto))
      if (!vigente()) return
      if (imagen) {
        setMensaje('Estudiando la forma y los colores de la foto...')
        segmento = segmentar(imagen)
      }
    }

    if (!receta.tipo && !receta.modelo && !segmento) {
      if (fuente) {
        const { titulo, descripcion } = fuente.articulo
        setMensaje(
          `Según Wikipedia, ${titulo} es "${descripcion}", pero no encontré una foto clara para simularlo. ${PRUEBA_CON}`,
        )
      } else {
        setMensaje(`Todavía no sé construir "${texto}". ${PRUEBA_CON}`)
      }
      return
    }

    const apariencia = {
      imagen,
      segmento,
      regiones: segmento && identificarRegiones(segmento),
      paleta: paletaDesdeColor(receta.color),
    }

    // Rasgos que cambian la forma (nieve, lava, bosque, conifera, altitud),
    // leidos de lo que se escribio y de lo que dice Wikipedia.
    const { titulo = '', descripcion = '', extracto = '' } = fuente?.articulo ?? {}
    receta.rasgos = leerRasgos(`${texto} ${descripcion} ${extracto}`)
    // El volumen (plano o giratorio) se lee solo de lo que nombra a la cosa: el
    // texto, el titulo y la descripcion corta. El articulo menciona demasiadas
    // cosas: "un arbol es una planta perenne con hojas" no hace plano al arbol.
    receta.rasgos.volumen = leerVolumen(texto, titulo, descripcion)
    // Elementos que se suman al entorno ("montana con lago"): rio, lago, bosque...
    receta.rasgos.elementos = leerElementos(texto, titulo, descripcion)

    // La erosion tarda un momento: se muestra el aviso antes de empezar.
    setMensaje('Generando...')
    await new Promise((listo) => setTimeout(listo, 30))
    if (!vigente()) return

    const semilla = semillaDeTexto(texto) + intento
    const forma = crearForma(receta, apariencia, crearRandom(semilla))
    setModelo({
      ...forma,
      id,
      semilla,
      texto,
      intento,
      tipo: receta.tipo,
      fuente,
    })
    setDesarmando(false)
    setProgreso(0)
    setMensaje('')
  }

  // Desarma el modelo; cuando la animacion termina, se quita del todo.
  function borrar() {
    busqueda.current++
    setDesarmando(true)
    setMensaje('')
  }

  // Descarga el modelo armado como archivo .glb.
  async function descargar() {
    try {
      await descargarGLB(modelo.geometria, modelo.texto)
    } catch {
      setMensaje('No se pudo preparar la descarga. Intenta de nuevo.')
    }
  }

  function desarmado() {
    setModelo(null)
    setDesarmando(false)
    setProgreso(0)
  }

  return (
    <>
      <header id="cabecera">
        <h1>Generador 3D</h1>
        <Buscador onBuscar={(texto) => generar(texto, 0)} />
      </header>

      <section id="visor">
        <Visor3D
          modelo={modelo}
          desarmar={desarmando}
          onProgreso={setProgreso}
          onDesarmado={desarmado}
        />
        {!modelo && !mensaje && (
          <p className="aviso">Escribe una forma arriba para verla armarse.</p>
        )}
        {mensaje && <p className="aviso">{mensaje}</p>}
      </section>

      <div id="estado">
        {modelo ? (
          <>
            <div className="detalle">
              <span>
                {desarmando
                  ? 'Desarmando...'
                  : progreso < 100
                    ? `Armando: ${progreso} %`
                    : 'Listo'}
              </span>
              {modelo.fuente && (
                <a className="fuente" href={modelo.fuente.articulo.url} target="_blank">
                  Wikipedia: {modelo.fuente.articulo.titulo} es &quot;
                  {modelo.fuente.articulo.descripcion}&quot; →{' '}
                  {METODOS[modelo.metodo] ?? NOMBRES_FIGURAS[modelo.tipo]}
                </a>
              )}
            </div>
            <div className="acciones">
              <button
                type="button"
                disabled={desarmando}
                onClick={() => generar(modelo.texto, modelo.intento + 1)}
              >
                Regenerar
              </button>
              <button type="button" disabled={desarmando || progreso < 100} onClick={descargar}>
                Descargar .glb
              </button>
              <button type="button" disabled={desarmando} onClick={borrar}>
                Borrar
              </button>
            </div>
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
          <li>
            <a
              href="https://www.linkedin.com/in/poll-garro-vargas-449464406/"
              target="_blank"
            >
              <svg className="button-icon" role="presentation" aria-hidden="true">
                <use href="/icons.svg#linkedin-icon"></use>
              </svg>
              LinkedIn
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
