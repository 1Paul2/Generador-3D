# Generador 3D

Generador de modelos 3D en el navegador a partir de texto. Escribes lo que quieres ver ("esfera roja", "volcán gigante", "Tierra") y un universo de destellos vuela hasta formar el objeto.

Todo se genera con algoritmos propios, sin servicios de pago ni límites de uso.

## Cómo funciona

1. **Interpretar el texto.** Un diccionario propio reconoce figuras (esfera, cubo, cilindro, cono, diamante, torre, montaña y más), colores y tamaños, sin importar tildes, mayúsculas o plurales.
2. **Consultar Wikipedia.** Si una palabra no está en el diccionario, se busca en Wikipedia y se lee su descripción para decidir a qué figura se parece. Por ejemplo, "Tierra" es un *planeta*, así que se genera una esfera.
3. **Estudiar una foto real.** Se busca la foto representativa en Wikidata y se analiza con visión por computadora propia, sin pegarla en el modelo:
   - Los colores se comparan en el espacio **Lab**, que mide las diferencias como el ojo humano.
   - Se detectan los **bordes** con el filtro de Sobel.
   - Se **separa el objeto del fondo**: se aprenden los colores del borde de la foto y se "inunda" desde ahí, frenando en los bordes fuertes. Luego se refina como **GrabCut** (modelos de color del objeto y del fondo, decididos píxel a píxel con **ICM**).
   - Se **identifican sus partes por color** con k-medias, descartando la orla del contorno y los restos del fondo.
4. **Usar la forma real si existe.** Si la cosa tiene un modelo 3D enlazado en Wikidata (unas 5.500 cosas, como la Torre Eiffel o la Tierra), se descarga de Wikimedia Commons y se pinta con los colores identificados. Los árboles se generan por **ramificación recursiva** (tronco, ramas cada vez más finas y follaje en las puntas), o en pisos de follaje si son coníferas.
5. **Si no, simular la forma con la silueta.** Las cosas de revolución (jarrón, botella) se hacen girar como en un **torno de alfarero**; las planas (hoja, bandera) quedan como una lámina; el resto (animal, auto) se infla con una **unión de esferas sobre el eje medial**, así cada parte tiene su grosor (patas finas, cuerpo grueso). Entre partes de distinto color se marca un **surco**, y los pliegues se oscurecen con **oclusión ambiental**. Las formas abstractas ("cubo", "esfera") salen de una sola fórmula, la **supercuádrica**.
6. **Paisajes como terreno real.** Volcanes, montañas, colinas, islas y dunas no son figuras sino terreno sobre una maqueta: un mapa de alturas propio de cada paisaje, **erosión hidráulica** (miles de gotas de lluvia que tallan cauces) y colores por altura y pendiente (pasto, roca, ceniza, nieve, lava, arena). De Wikipedia se leen rasgos como nieve, actividad volcánica, bosque o altitud.
7. **Armar el modelo.** Los destellos del fondo vuelan, de abajo hacia arriba, a puntos de la superficie y toman su color. Al llegar todos, aparece la superficie. Al borrar, la animación corre al revés.

Mientras escribes, el buscador sugiere cómo completar la palabra (con el diccionario y con títulos de Wikipedia); con **Tab** aceptas la sugerencia.

Cuando el modelo termina de armarse, el botón **Descargar .glb** lo guarda en el formato estándar de modelos 3D, que se abre en Blender, en el Visor 3D de Windows o en Unity.

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

## Estructura

```
src/
  components/   Buscador, visor 3D y destellos
  parser/       texto → receta, clasificación por pistas y rasgos
  busqueda/     Wikipedia, Wikidata, fotos y modelos 3D reales
  analisis/     separar el objeto del fondo e identificar sus partes
  generadores/  figuras, siluetas, terrenos, árboles y oclusión
  exportar/     descarga en .glb
  utils/        azar con semilla, ruido, color Lab y k-medias
```

## Próximamente

- Más formas y combinaciones de objetos
- Generar a partir de una imagen

## Autor

**Poll Garro Vargas**

- GitHub: [@1Paul2](https://github.com/1Paul2)
- LinkedIn: [Poll Garro Vargas](https://www.linkedin.com/in/poll-garro-vargas-449464406/)
