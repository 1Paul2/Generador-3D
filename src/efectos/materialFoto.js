import * as THREE from 'three'

// Material que pinta el modelo pixel por pixel de la pantalla con la foto en
// alta resolucion, en lugar de solo en sus vertices (que se pierde casi todo
// el detalle). En la tarjeta grafica repite el calculo de colorearAlineado
// (generadores/formas.js) para cada pixel:
//   1. Proyeccion desde la camara para lo que mira hacia ella.
//   2. Sintesis con ruido 3D continuo para costados y espalda, sin uniones.
//   3. Fundido entre las dos segun cuanto mira hacia la camara.
// Ademas suma relieve fino (bump mapping): la variacion de brillo de la foto
// inclina la superficie en cada pixel, asi aparecen el granulado, la corteza
// o la trama de una tela sin agregar vertices.
// Parte de un material fisico normal, asi conserva la luz, los reflejos y
// las sombras de la escena.

// Fuerza del relieve fino (en unidades de la escena por unidad de brillo).
const RELIEVE = 0.05

const ruidoGlsl = /* glsl */ `
  float azar3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  // Ruido de valor: numeros al azar en una grilla, mezclados suavemente.
  float ruidoValor(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(azar3(i), azar3(i + vec3(1, 0, 0)), f.x), mix(azar3(i + vec3(0, 1, 0)), azar3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(azar3(i + vec3(0, 0, 1)), azar3(i + vec3(1, 0, 1)), f.x), mix(azar3(i + vec3(0, 1, 1)), azar3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  // Varias escalas del mismo ruido: manchas grandes con detalle fino.
  float ruidoFbm(vec3 p) {
    float suma = 0.0, amplitud = 0.5, total = 0.0;
    for (int capa = 0; capa < 4; capa++) {
      suma += amplitud * ruidoValor(p);
      total += amplitud;
      amplitud *= 0.5;
      p *= 2.0;
    }
    return suma / total;
  }
`

const colorGlsl = /* glsl */ `
  vec3 colorFoto;
  {
    vec3 p = vPosObjeto - uCentro;
    float u = (dot(p, uDerecha) - uLimites.x) / max(1e-6, uLimites.y - uLimites.x);
    float w = (dot(p, uArriba) - uLimites.z) / max(1e-6, uLimites.w - uLimites.z);
    vec3 proyectado = texture2D(uFoto, vec2(mix(uCaja.x, uCaja.z, u), mix(uCaja.w, uCaja.y, w))).rgb;

    // Cuanto mira el punto hacia la camara (1 = de frente).
    float mira = smoothstep(0.15, 0.6, dot(normalize(vNormalObjeto), uDireccion));
    vec3 q = vPosObjeto * uEscala;
    float su = clamp((ruidoFbm(q + vec3(uDesfases.x, 0.0, 0.0)) - 0.5) * 2.6 + 0.5, 0.0, 1.0);
    float sv = clamp((ruidoFbm(q + vec3(0.0, uDesfases.y, 0.0)) - 0.5) * 2.6 + 0.5, 0.0, 1.0);
    vec3 sintetico = texture2D(uFoto, vec2(mix(uCaja.x, uCaja.z, su), mix(uCaja.y, uCaja.w, sv))).rgb;
    colorFoto = mix(sintetico, proyectado, mira);
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

// foto: lo que devuelve procesar() (textura del objeto y datos de la proyeccion).
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
    uLimites: { value: new THREE.Vector4(...foto.limites) },
    uCaja: { value: new THREE.Vector4(...foto.caja) },
    uEscala: { value: foto.escala },
    uDesfases: { value: new THREE.Vector2(...foto.desfases) },
    uRelieve: { value: RELIEVE },
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosObjeto;\nvarying vec3 vNormalObjeto;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosObjeto = position;\nvNormalObjeto = normal;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vPosObjeto;
        varying vec3 vNormalObjeto;
        uniform sampler2D uFoto;
        uniform vec3 uCentro, uDerecha, uArriba, uDireccion;
        uniform vec4 uLimites, uCaja;
        uniform float uEscala, uRelieve;
        uniform vec2 uDesfases;
        ${ruidoGlsl}`,
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
