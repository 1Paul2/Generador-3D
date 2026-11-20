import { useRef, useState } from 'react'
import Buscador from './components/Buscador.jsx'
import Visor3D from './components/Visor3D.jsx'
import { interpretar, FORMAS_DISPONIBLES } from './parser/interpretar.js'
import { buscarFoto, buscarModelo3D, clasificarConWikipedia } from './busqueda/wikipedia.js'
import { cargarImagen } from './busqueda/imagen.js'
import { cargarModelo3D } from './busqueda/modelo3d.js'
import { generarEnSegundoPlano } from './trabajo/cliente.js'
import { armarGeometria } from './trabajo/procesar.js'
import { descargarGLB } from './exportar/glb.js'
import { leerElementos, leerEstacion, leerLuz, leerRasgos, leerVolumen } from './parser/rasgos.js'
import { planearEfectos } from './efectos/planear.js'
import { semillaDeTexto } from './utils/random.js'
import './App.css'

const PRUEBA_CON = `Prueba con: ${FORMAS_DISPONIBLES.join(', ')}.`

// Correccion - Poll: debajo del visor no debe verse ningun texto, solo las acciones
// Correccion - Poll: los iconos usaban una ruta fija y no cargaban con la pagina publicada en GitHub Pages
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
  //   3. Buscar una foto real y, si existe, un modelo 3D real.
  //   4. En un proceso aparte: estudiar la foto (separar el objeto del fondo
  //      e identificar sus partes) y construir la forma. La foto no se pega
  //      en el modelo.
  async function generar(texto, intento) {
    const id = ++busqueda.current
    const vigente = () => id === busqueda.current
    const receta = interpretar(texto)

    let fuente = null
    let modelo3d = null
    if (receta.cosas.length) {
      setMensaje(`Buscando "${receta.cosas.join(' ')}" en Wikipedia...`)
      fuente = await clasificarConWikipedia(receta.cosas)
      if (!vigente()) return
      receta.tipo ??= fuente?.tipo ?? null

      const direccion = fuente && (await buscarModelo3D(fuente.articulo))
      if (!vigente()) return
      if (direccion) {
        setMensaje('Descargando el modelo 3D real...')
        modelo3d = await cargarModelo3D(direccion)
        if (!vigente()) return
      }
    }

    // Foto real de la cosa, para estudiar su silueta y sus colores.
    let imagen = null
    if (fuente) {
      setMensaje('Buscando una foto real...')
      const foto = await buscarFoto(fuente.articulo)
      imagen = foto && (await cargarImagen(foto))
      if (!vigente()) return
    }

    // Sin forma conocida, sin modelo 3D y sin foto no hay con que construir.
    // El modelo de la busqueda anterior se desarma, para que no parezca la
    // respuesta a esta (buscar "marte" dejaba la Tierra en pantalla).
    // Correccion - Poll: al fallar una busqueda quedaba el modelo anterior con el aviso encima
    const sinForma = () => {
      setDesarmando(true)
      if (fuente) {
        const { titulo, descripcion } = fuente.articulo
        setMensaje(
          `Según Wikipedia, ${titulo} es "${descripcion}", pero no encontré una foto clara para simularlo. ${PRUEBA_CON}`,
        )
      } else {
        setMensaje(`Todavía no sé construir "${texto}". ${PRUEBA_CON}`)
      }
    }
    if (!receta.tipo && !modelo3d && !imagen) {
      sinForma()
      return
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
    // Estacion de la vegetacion ("arbol de otono"): cambia hojas, pasto y nieve.
    receta.rasgos.estacion = leerEstacion(texto, titulo, descripcion)
    // Si tiene luz propia o brilla (el Sol, una vela, oro). De la descripcion se
    // miran solo las primeras palabras, que dicen que es la cosa: "tercer planeta
    // desde el Sol" no hace brillar a la Tierra.
    receta.rasgos.luz = leerLuz(texto, titulo, descripcion.split(/\s+/).slice(0, 3).join(' '))

    // El trabajo pesado (estudiar la foto y armar la malla) corre en un
    // proceso aparte, asi la pagina sigue respondiendo mientras tanto.
    setMensaje(imagen ? 'Estudiando la foto y armando el modelo...' : 'Generando...')
    const semilla = semillaDeTexto(texto) + intento
    let forma
    try {
      forma = await generarEnSegundoPlano({
        receta,
        imagen,
        modelo: modelo3d?.attributes.position.array ?? null,
        semilla,
      })
    } catch {
      if (vigente()) {
        setDesarmando(true)
        setMensaje('No se pudo generar el modelo. Intenta de nuevo.')
      }
      return
    }
    if (!vigente()) return
    if (forma.sinForma) {
      sinForma()
      return
    }

    const geometria = armarGeometria(forma)
    setModelo({
      geometria,
      altura: forma.altura,
      metodo: forma.metodo,
      foto: forma.foto,
      // Efectos de luz segun lo que es: llamaradas, chispas, reflejos...
      efectos: planearEfectos({
        geometria,
        altura: forma.altura,
        tipo: receta.tipo,
        rasgos: receta.rasgos,
        semilla,
        elementos: receta.rasgos.elementos,
      }),
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
          listo={progreso >= 100}
          onProgreso={setProgreso}
          onDesarmado={desarmado}
        />
        {!modelo && !mensaje && (
          <p className="aviso">Escribe una forma arriba para verla armarse.</p>
        )}
        {mensaje && <p className="aviso">{mensaje}</p>}
      </section>

      {/* Debajo del visor solo van las acciones, sin textos. */}
      <div id="estado" data-listo={modelo && !desarmando && progreso >= 100 ? modelo.id : ''}>
        {modelo && (
          <>
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
        )}
      </div>

      <div className="ticks"></div>

      <section id="contacto">
        <svg className="icon" role="presentation" aria-hidden="true">
          <use href={`${import.meta.env.BASE_URL}icons.svg#social-icon`}></use>
        </svg>
        <h2>Conecta conmigo</h2>
        <p>Código y otros proyectos</p>
        <ul>
          <li>
            <a href="https://github.com/1Paul2" target="_blank">
              <svg className="button-icon" role="presentation" aria-hidden="true">
                <use href={`${import.meta.env.BASE_URL}icons.svg#github-icon`}></use>
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
                <use href={`${import.meta.env.BASE_URL}icons.svg#linkedin-icon`}></use>
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
