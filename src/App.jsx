import './App.css'

function App() {
  return (
    <>
      <header id="cabecera">
        <h1>Generador 3D</h1>
      </header>

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
