# Generador 3D

Generador de modelos 3D en el navegador a partir de texto. Escribes lo que quieres ver ("esfera roja", "volcán gigante", "mata de banano", "vaca") y un universo de destellos vuela hasta formar el objeto.

Todo se genera con algoritmos propios, sin servicios de pago ni límites de uso.

**Pruébalo en línea:** [1paul2.github.io/Generador-3D](https://1paul2.github.io/Generador-3D/)

## Cómo funciona

1. **Interpretar el texto.** Un diccionario propio reconoce figuras (esfera, cubo, cilindro, cono, diamante, torre, montaña y más), colores y tamaños, sin importar tildes, mayúsculas o plurales.
2. **Consultar Wikipedia.** Si una palabra no está en el diccionario, se busca en Wikipedia y se lee su descripción para decidir a qué figura se parece. Por ejemplo, "Tierra" es un *planeta*, así que se genera una esfera.
3. **Estudiar una foto real.** Se busca la foto representativa en Wikidata y se analiza con visión por computadora propia, sin pegarla en el modelo:
   - Los colores se comparan en el espacio **Lab**, que mide las diferencias como el ojo humano.
   - Se detectan los **bordes** con el filtro de Sobel.
   - Se **separa el objeto del fondo**: se aprenden los colores del borde de la foto y se "inunda" desde ahí, frenando en los bordes fuertes. Luego se refina como **GrabCut** (modelos de color del objeto y del fondo, decididos píxel a píxel con **ICM**).
   - Se **identifican sus partes por color** con k-medias, descartando la orla del contorno y los restos del fondo.
4. **Usar la forma real si existe.** Si la cosa tiene un modelo 3D enlazado en Wikidata (unas 5.500 cosas, como la Torre Eiffel o la Tierra), se descarga de Wikimedia Commons y se pinta con los colores identificados. Los cultivos, árboles y animales se arman con su anatomía real (ver más abajo).
5. **Si no, simular la forma con la silueta.** Las cosas de revolución (jarrón, botella) se hacen girar como en un **torno de alfarero**; las planas (hoja, bandera) quedan como una lámina; el resto (animal, auto) se infla con una **unión de esferas sobre el eje medial**, así cada parte tiene su grosor (patas finas, cuerpo grueso). Entre partes de distinto color se marca un **surco**, y los pliegues se oscurecen con **oclusión ambiental**. Las formas abstractas ("cubo", "esfera") salen de una sola fórmula, la **supercuádrica**.
6. **Paisajes como terreno real.** Volcanes, montañas, colinas, islas y dunas no son figuras sino terreno sobre una maqueta: un mapa de alturas propio de cada paisaje, **erosión hidráulica** (miles de gotas de lluvia que tallan cauces) y colores por altura y pendiente (pasto, roca, ceniza, nieve, lava, arena). De Wikipedia se leen rasgos como nieve, actividad volcánica, bosque o altitud.
7. **Armar el modelo.** Los destellos del fondo vuelan, de abajo hacia arriba, a puntos de la superficie y toman su color. Al llegar todos, aparece la superficie. Al borrar, la animación corre al revés.
8. **Luz y movimiento.** Lo que brilla lo hace según su naturaleza: una estrella emite luz y lanza llamaradas hacia afuera, el fuego parpadea y suelta chispas que suben, un volcán activo escupe lava que vuelve a caer por la gravedad, una lámpara tiene un halo quieto, el metal y el cristal reflejan con destellos, y en el agua los reflejos titilan o viajan con la corriente de un río.

Mientras escribes, el buscador sugiere cómo completar la palabra (con el diccionario y con títulos de Wikipedia); con **Tab** aceptas la sugerencia.

Cuando el modelo termina de armarse, el botón **Descargar .glb** lo guarda en el formato estándar de modelos 3D, que se abre en Blender, en el Visor 3D de Windows o en Unity.

## Agricultura, árboles y ganado de Costa Rica

El generador arma **106 especies** de cultivos, árboles, palmas, pastos y animales de finca de Costa Rica. Las elegimos con un estudio de lo que más se siembra y se ve en el país, con datos de la Encuesta Nacional Agropecuaria del INEC y de PROCOMER. El catálogo completo, con lo que ya se genera y lo que falta, está en [docs/especies-costa-rica.md](docs/especies-costa-rica.md).

### Qué se puede pedir

| Grupo | Ejemplos |
|---|---|
| Cultivos | banano, plátano, piña, café, caña de azúcar, palma aceitera, cacao, arroz, frijol, maíz, yuca, papa |
| Hortalizas | tomate, chile dulce, chayote (en su ramada), lechuga, repollo, zanahoria, cebolla |
| Frutales | naranja, limón, mandarina, mango, aguacate, papaya, melón, sandía, mamón chino, guanábana, cas, guayaba, carambola, marañón, nance, jocote, zapote, anona |
| Árboles | guanacaste, ceiba, cortez amarillo y negro, roble sabana, malinche, cenízaro, pochote, higuerón, guarumo, indio desnudo, almendro, espavel, carao, javillo, jacaranda |
| Maderables y de sombra | teca, melina, cedro, caoba, laurel, ciprés, pino, eucalipto, acacia, amarillón, poró, guaba, madero negro |
| Bosque nuboso | roble negro y roble blanco (con musgo, bromelias y barba de viejo), aguacatillo, cedro dulce, rabo de mico |
| Manglar | mangle rojo, caballero, salado, blanco, botoncillo y piñuela |
| Palmas | coco, pejibaye, palma real, coyol, chonta, yolillo, suita, palmito |
| Pastos y ornamentales | brachiaria, estrella africana, kikuyo, caña india, helecho hoja de cuero |
| Ganado y animales | vaca Holstein, cebú, caballo, perro, gato, león, tigre, oveja, cerdo, cebra, jirafa, elefante y otros |

### Planta o cosecha

El texto se lee como lo diría un agricultor:

- **"mata de banano"**, "planta de tomate", "árbol de cacao", "palo de mango", "cafetal", "milpa": la planta entera.
- **"banano"**, "tomate", "mazorca", "frijoles rojos", "marañón": lo que se cosecha.
- **"racimo de banano"**: la mano de bananos. **"palma"** es el árbol, y "racimo de palma" su fruto.
- Los nombres de varias palabras se entienden como una sola cosa: "roble negro", "mamón chino", "mangle salado", "palma real", "almendro de playa".

### Cómo se arman

- **Plantas en metros reales, con su anatomía.** Cada hoja es una superficie propia, con su contorno botánico (lanceolada, palmeada, pinnada, bipinnada, acintada), su vena central, sus nervaduras secundarias y su caída por el peso. Los tallos tienen sus nudos y cicatrices, y los frutos su forma y su color de madurez.
- **Detalle fino por algoritmo, sin fotos ni texturas.** Cada planta tiene decenas de miles de vértices y en cada uno se calculan el color y el relieve. Así salen las manchas de la vaina del banano, las lenticelas de la corteza o los ojos de la piña, que siguen las espirales de Fibonacci (8 y 13) como en la fruta real.
- **Árboles por especie.** Cada árbol tiene su arquitectura (copa de paraguas, de domo, emergente, cónica o en pisos), su corteza (lisa, fisurada, anillada, la roja del indio desnudo, la arcoíris del eucalipto) y sus raíces cuando las tiene: gambas en la ceiba, raíces aéreas en el higuerón, zancos en el mangle rojo y neumatóforos en el mangle salado. También sus flores y sus frutos.
- **Animales con sus medidas reales.** El tronco se arma por su perfil, como en un plano de veterinaria: la línea del lomo, la de la panza y el ancho a lo largo del cuerpo. Las medidas de cada especie (alzada, largo, profundidad de pecho, cabeza, cuello y cola) salen de estándares de raza y fichas zoológicas. Las patas apoyan como en la realidad (pezuña, dedos, planta o columna), los ojos, la nariz y la boca se apoyan sobre la superficie de la cabeza, y el pelo se dibuja en capas.

## Tecnologías

- [React](https://react.dev/) + [Vite](https://vite.dev/)
- [Three.js](https://threejs.org/) con [React Three Fiber](https://r3f.docs.pmnd.rs/) y [Drei](https://drei.docs.pmnd.rs/)
- API pública de [Wikipedia](https://es.wikipedia.org/)

## Ejecutar en tu computadora

```bash
npm install
npm run dev
```

Luego abre `http://localhost:5173`.

## Publicar en GitHub Pages

La página se publica desde la rama `gh-pages`, que lleva solo la versión compilada:

```bash
npm run deploy
```

Ese comando compila la página con la ruta `/Generador-3D/` (`npm run build:pages`) y la sube como un commit nuevo a la rama `gh-pages`, junto con un archivo `.nojekyll`. GitHub la actualiza en uno o dos minutos. Si la página no cambió, no sube nada. No necesita dependencias extra: lo hace el script [scripts/desplegar.mjs](scripts/desplegar.mjs) con git.

## Estructura

```
src/
  components/   buscador, visor 3D, destellos y pelaje
  parser/       texto → receta, clasificación por pistas y rasgos
  busqueda/     Wikipedia, Wikidata, fotos y modelos 3D reales
  analisis/     separar el objeto del fondo e identificar sus partes
  generadores/  figuras, siluetas, terrenos y oclusión; además:
    botanica.js     piezas de las plantas (hojas, tallos, frutos, suelo)
    cultivos.js     decide qué planta o cosecha armar
    plantas.js      yuca, banano, piña, caña, maíz, arroz y palma aceitera
    huerta.js       frijol, tomate, papa, chile, café y cacao
    hortalizas.js   lechuga, repollo, zanahoria y cebolla
    frutales.js     papaya, chayote, melón, sandía, palmas y sus frutos
    arboles.js      árboles por especie, con sus fichas
    cosechas.js     lo que se cosecha de cada cultivo
    pastos.js       pastos de la ganadería
    ornamentales.js caña india y helechos
    seres.js        seres vivos y su pintado (zonas, patrones, pelo)
    cuadrupedos.js  cuadrúpedos por sus medidas reales y el ganado
    piezas.js       piezas de los seres (cápsula, elipsoide, tronco por perfil)
  trabajo/      genera los modelos en un proceso aparte
  exportar/     descarga en .glb
  utils/        azar con semilla, ruido, color Lab y k-medias
docs/
  especies-costa-rica.md   catálogo de especies para generar en 3D
```

## Próximamente

- Las especies que faltan del catálogo (hortalizas, raíces, ornamentales y más ganado)
- Descargar en tamaño real (metros), para usar los modelos en otros proyectos
- Escenas: varias cosas juntas en un terreno ("finca con cafetal y vacas")
- Generar el terreno a partir de datos de un dron (elevación, ríos y lo que hay encima)
- Entender texto libre con un modelo de lenguaje abierto que corra en la propia computadora

## Autor

**Poll Garro Vargas**

- GitHub: [@1Paul2](https://github.com/1Paul2)
- LinkedIn: [Poll Garro Vargas](https://www.linkedin.com/in/poll-garro-vargas-449464406/)
