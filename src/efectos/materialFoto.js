import * as THREE from 'three'

// Material que pinta el modelo pixel por pixel de la pantalla con la foto en
// alta resolucion, en lugar de solo en sus vertices (que se pierde casi todo
// el detalle). En la tarjeta grafica repite, para cada pixel, la lectura
// envolvente de colorearAlineado (generadores/formas.js): cada punto se ubica
// por su angulo con la camara y su direccion, y lee la foto desde el centro
// del objeto hacia su borde (adelante) y de vuelta (atras), sin estirar el
// perfil ni dejar uniones.
// Ademas suma relieve fino (bump mapping): la variacion de brillo de la foto
// inclina la superficie en cada pixel, asi aparecen el granulado, la corteza
// o la trama de una tela sin agregar vertices.
// Parte de un material fisico normal, asi conserva la luz, los reflejos y
// las sombras de la escena.

// Fuerza del relieve fino (en unidades de la escena por unidad de brillo).
const RELIEVE = 0.05

const colorGlsl = /* glsl */ `
  vec3 colorFoto;
  {
    vec3 q = vPosObjeto - uCentro;
    float x = dot(q, uDerecha);
    float y = dot(q, uArriba);
    float z = dot(q, uDireccion);
    float theta = atan(length(vec2(x, y)), z);
    float phi = atan(y, x);
    // Adelante se va del centro al borde; atras se vuelve del borde al centro.
    float avance = sin((theta <= 1.5707963 ? theta : 3.1415927 - theta) * 0.5) / 0.70710678;
    float a = (phi < 0.0 ? phi + 6.2831853 : phi) / 6.2831853 * float(RADIOS);
    int i0 = int(floor(a)) % RADIOS;
    int i1 = (i0 + 1) % RADIOS;
    float radio = mix(uRadios[i0], uRadios[i1], fract(a)) * uAlcance * avance;
    vec2 pixel = uCentroFoto + vec2(cos(phi), -sin(phi)) * radio;
    colorFoto = texture2D(uFoto, pixel / uTamano).rgb;

    // Se compensa la luz con la que se saco la foto (el borde mas oscuro). El
    // perfil se midio en la escala de la foto; aca los colores son lineales.
    float anillo = clamp(uAlcance * avance * float(ANILLOS) - 0.5, 0.0, float(ANILLOS - 1));
    int j0 = int(floor(anillo));
    int j1 = min(j0 + 1, ANILLOS - 1);
    colorFoto *= pow(mix(uPerfil[j0], uPerfil[j1], fract(anillo)), 2.2);
  }
  diffuseColor.rgb *= colorFoto;
`

const relieveGlsl = /* glsl */ `
  {
    // Bump mapping: la variacion del brillo entre pixeles vecinos inclina la normal.
    float alturaFina = dot(colorFoto, vec3(0.299, 0.587, 0.114)) * uRelieve;
    vec3 dpdx = dFdx(-vViewPosition);
    vec3 dpdy = dFdy(-vViewPosition);
    vec2 dh = vec2(dFdx(alturaFina), dFdy(alturaFina));
    vec3 r1 = cross(dpdy, normal);
    vec3 r2 = cross(normal, dpdx);
    float det = dot(dpdx, r1);
    vec3 gradiente = sign(det) * (dh.x * r1 + dh.y * r2);
    normal = normalize(abs(det) * normal - gradiente);
  }
`

// foto: lo que devuelve procesar() (textura del objeto y datos de la lectura).
// basico: true para cosas con luz propia (no dependen de la iluminacion ni llevan relieve).
// Devuelve { material, textura } (las dos hay que liberarlas al terminar).
export function crearMaterialFoto(foto, { basico = false, rugosidad = 1, metal = 0 } = {}) {
  const textura = new THREE.DataTexture(foto.textura.pixeles, foto.textura.ancho, foto.textura.alto, THREE.RGBAFormat)
  textura.colorSpace = THREE.SRGBColorSpace
  textura.magFilter = THREE.LinearFilter
  textura.minFilter = THREE.LinearMipmapLinearFilter
  textura.generateMipmaps = true
  textura.anisotropy = 8
  textura.needsUpdate = true

  const material = basico
    ? new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0 })
    : new THREE.MeshStandardMaterial({ roughness: rugosidad, metalness: metal, transparent: true, opacity: 0 })

  const uniforms = {
    uFoto: { value: textura },
    uCentro: { value: new THREE.Vector3(...foto.centro) },
    uDerecha: { value: new THREE.Vector3(...foto.derecha) },
    uArriba: { value: new THREE.Vector3(...foto.arriba) },
    uDireccion: { value: new THREE.Vector3(...foto.direccion) },
    uCentroFoto: { value: new THREE.Vector2(...foto.centroFoto) },
    uTamano: { value: new THREE.Vector2(...foto.tamano) },
    uRadios: { value: foto.radios },
    uPerfil: { value: foto.perfil },
    uAlcance: { value: foto.alcance },
    uRelieve: { value: RELIEVE },
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosObjeto;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosObjeto = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        #define RADIOS ${foto.radios.length}
        #define ANILLOS ${foto.perfil.length}
        varying vec3 vPosObjeto;
        uniform sampler2D uFoto;
        uniform vec3 uCentro, uDerecha, uArriba, uDireccion;
        uniform vec2 uCentroFoto, uTamano;
        uniform float uRadios[RADIOS];
        uniform float uPerfil[ANILLOS];
        uniform float uAlcance, uRelieve;`,
      )
      .replace('#include <color_fragment>', `#include <color_fragment>\n${colorGlsl}`)
    if (!basico) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>\n${relieveGlsl}`,
      )
    }
  }
  return { material, textura }
}
