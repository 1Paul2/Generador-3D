import * as THREE from 'three'
import { ARRIBA, CONTORNOS, PERFILES, aclarar, celdas, columna, cuerpo, girar, hoja, hojaLarga, mezclar, suelo, transicion, vector } from './botanica.js'
import { frutoDeAguacate, frutoDeMango, frutoDeNaranja } from './frutales.js'

// Arboles de Costa Rica (los del bosque y los de plantacion forestal) y los
// frutales, armados por especie: cada una tiene su arquitectura (como se
// abren y hacia donde van las ramas), su corteza, su tipo de hoja, sus flores
// y sus frutos. Las medidas estan en metros.
//
// La copa se arma por ramificacion: el tronco se divide en ramas, cada rama
// en otras mas cortas y delgadas (el grosor de las hijas sigue la regla de
// Leonardo: el area de la madre se reparte entre las hijas), y en las puntas
// crecen las hojas, las flores o los frutos.
//   elevacion: cuantos grados suben las ramas de cada nivel (pocos = copa
//     ancha y plana como el guanacaste; muchos = copa angosta como la teca).
//   abanico: cuanto se apartan las hijas de la direccion de la madre.
//   arquitectura: 'conico' (cipres: un eje central con pisos de ramas que se
//     acortan hacia arriba) o 'pisos' (laurel: eje central con pisos de ramas
//     horizontales); si no se dice, la copa se arma por ramificacion.
//   espinas: aguijones conicos en el tronco (pochote).
//   gambas: raices en tabla; raicesAereas: raices que cuelgan de las ramas
//     (higueron); zancos: raices arqueadas que sostienen el tronco (mangle).
//   epifitas: musgo, bromelias y barba de viejo sobre las ramas (roble de altura).
//   vaina: la forma de la vaina cuando el fruto es 'vaina'; frutos: en que
//     parte de las puntas hay frutos (los racimos pesados, en pocas).

const CORTEZAS = {
  // Gris clara con liquenes (ceiba, guanacaste).
  lisa: { color: [128, 122, 112], fisura: 0, liquen: 0.6 },
  // Cafe con fisuras a lo largo (cedro, roble, teca).
  fisurada: { color: [104, 86, 68], fisura: 1, liquen: 0.3 },
  // Con anillos (guarumo).
  anillada: { color: [168, 166, 150], fisura: 0, anillos: 1, liquen: 0.2 },
  // Roja y brillante que se pela en laminas (indio desnudo).
  roja: { color: [168, 82, 58], fisura: 0, pelada: 1, liquen: 0 },
  // Lisa y cafe clara que se pela en placas verdosas y crema (guayaba, cas).
  pelada: { color: [172, 132, 96], fisura: 0, pelada: 1, liquen: 0 },
  // Franjas de colores al pelarse (eucalipto arcoiris).
  colores: { color: [150, 140, 110], fisura: 0, colores: 1, liquen: 0 },
  // Oscura y aspera del manglar.
  oscura: { color: [82, 70, 60], fisura: 1, liquen: 0.4 },
}

// Especies. alto y radio son los del fuste (hasta la primera horqueta).
// Proporciones: en un arbol real la copa ocupa mas o menos la mitad de la
// altura; solo la ceiba tiene un fuste mucho mas alto que su copa. Las hojas
// se dibujan mas grandes que las reales: un arbol tiene cientos de miles y
// aca hay unos miles, asi que cada una cubre lo que cubririan varias.
export const ARBOLES = {
  guanacaste: {
    alto: 3, radio: 0.55, largo: 5, niveles: 5, ramas: 3, elevacion: [38, 24, 16, 12, 10], abanico: 50, caida: 0.3,
    corteza: 'lisa', hoja: { tipo: 'bipinnada', largo: 0.8, color: [58, 102, 40], porPunta: 2 }, fruto: 'oreja',
  },
  ceiba: {
    alto: 13, radio: 0.75, largo: 8, niveles: 5, ramas: 3, elevacion: [14, 10, 16, 20, 25], abanico: 45, caida: 0.15,
    corteza: 'lisa', gambas: 6, hoja: { tipo: 'palmada', largo: 0.6, lobulos: 6, color: [66, 108, 44], pocas: true },
  },
  cortez: {
    alto: 2.2, radio: 0.26, largo: 3, niveles: 5, ramas: 3, elevacion: [62, 45, 32, 25, 20], abanico: 45, caida: 0.2,
    corteza: 'fisurada', flor: { color: [246, 200, 20], cantidad: 5, tamano: 1.8 }, hoja: null,
  },
  roble: {
    alto: 2.8, radio: 0.3, largo: 3.4, niveles: 5, ramas: 3, elevacion: [72, 62, 52, 44, 38], abanico: 40, caida: 0.12,
    corteza: 'fisurada', flor: { color: [236, 160, 196], cantidad: 3, tamano: 1.8 }, hoja: { tipo: 'palmada', largo: 0.4, lobulos: 5, color: [70, 112, 46], pocas: true, porPunta: 4 },
  },
  teca: {
    alto: 5, radio: 0.26, largo: 2.6, niveles: 4, ramas: 3, elevacion: [76, 66, 56, 48], abanico: 35, caida: 0.1,
    corteza: 'fisurada', hoja: { tipo: 'grande', largo: 1, ancho: 0.55, color: [72, 112, 46] },
  },
  melina: {
    alto: 4, radio: 0.24, largo: 2.8, niveles: 4, ramas: 3, elevacion: [72, 60, 50, 42], abanico: 40, caida: 0.15,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.5, ancho: 0.34, contorno: 'ovada', color: [70, 116, 48], porPunta: 7 },
  },
  poro: {
    alto: 1.8, radio: 0.22, largo: 2.6, niveles: 4, ramas: 3, elevacion: [70, 58, 48, 40], abanico: 45, caida: 0.15,
    corteza: 'lisa', flor: { color: [236, 92, 36], cantidad: 6, espiga: true, tamano: 2 }, hoja: { tipo: 'trifoliada', largo: 0.36, color: [74, 118, 50], pocas: true },
  },
  cedro: {
    alto: 5, radio: 0.4, largo: 4.2, niveles: 4, ramas: 3, elevacion: [68, 56, 46, 40], abanico: 45, caida: 0.15,
    corteza: 'fisurada', hoja: { tipo: 'pinnada', largo: 0.9, color: [66, 108, 44] },
  },
  guarumo: {
    alto: 6, radio: 0.16, largo: 3, niveles: 2, ramas: 4, elevacion: [42, 70], abanico: 40, caida: -0.4,
    corteza: 'anillada', hoja: { tipo: 'palmada', largo: 0.7, lobulos: 9, color: [78, 112, 60], plata: true, porPunta: 6 },
  },
  indio: {
    alto: 1.8, radio: 0.32, largo: 3.4, niveles: 4, ramas: 3, elevacion: [52, 40, 32, 26], abanico: 55, caida: 0.25, torcido: 1,
    corteza: 'roja', hoja: { tipo: 'pinnada', largo: 0.5, color: [84, 124, 52], pocas: true },
  },
  guaba: {
    alto: 2.2, radio: 0.25, largo: 3.2, niveles: 5, ramas: 3, elevacion: [45, 32, 24, 18, 15], abanico: 55, caida: 0.3,
    corteza: 'lisa', hoja: { tipo: 'pinnada', largo: 0.55, color: [60, 104, 44], porPunta: 2 },
    fruto: 'vaina', frutos: 0.15, vaina: { largo: 0.6, radio: 0.022, color: [98, 132, 58], costillas: true },
  },
  laurel: {
    arquitectura: 'pisos', alto: 16, radio: 0.24, pisos: 10, ramaMax: 3.2, elevacion: 12, desde: 0.4,
    corteza: 'fisurada', hoja: { tipo: 'simple', largo: 0.4, ancho: 0.15, contorno: 'eliptica', color: [70, 110, 46], porPunta: 12 },
    flor: { color: [245, 245, 235], cantidad: 3, tamano: 1.2 },
  },
  madero: {
    alto: 1.5, radio: 0.16, largo: 2.2, niveles: 4, ramas: 3, elevacion: [58, 44, 34, 28], abanico: 50, caida: 0.25, torcido: 1,
    corteza: 'lisa', hoja: { tipo: 'pinnada', largo: 0.32, color: [84, 128, 56], pocas: true },
    flor: { color: [232, 170, 205], cantidad: 5, tamano: 1.4 },
  },
  pochote: {
    alto: 6, radio: 0.42, largo: 4, niveles: 4, ramas: 3, elevacion: [48, 36, 28, 22], abanico: 45, caida: 0.2, espinas: 0.3,
    corteza: 'lisa', hoja: { tipo: 'palmada', largo: 0.4, lobulos: 5, color: [72, 116, 48], pocas: true },
  },
  cenizaro: {
    alto: 2.6, radio: 0.75, largo: 7.5, niveles: 5, ramas: 3, elevacion: [30, 16, 10, 8, 8], abanico: 55, caida: 0.35,
    corteza: 'fisurada', hoja: { tipo: 'bipinnada', largo: 0.9, color: [56, 100, 42], porPunta: 1 },
    flor: { color: [232, 140, 172], cantidad: 2, espiga: true, tamano: 1.8 },
    fruto: 'vaina', vaina: { largo: 0.2, radio: 0.014, color: [38, 30, 26] },
  },
  higueron: {
    alto: 4, radio: 0.9, largo: 6, niveles: 5, ramas: 3, elevacion: [42, 30, 22, 16, 12], abanico: 50, caida: 0.25,
    gambas: 9, raicesAereas: 14, corteza: 'lisa',
    hoja: { tipo: 'simple', largo: 0.32, ancho: 0.15, contorno: 'eliptica', color: [44, 90, 40], porPunta: 7 },
  },
  malinche: {
    alto: 2.4, radio: 0.35, largo: 5, niveles: 5, ramas: 3, elevacion: [34, 18, 12, 10, 8], abanico: 55, caida: 0.3,
    corteza: 'lisa', hoja: { tipo: 'bipinnada', largo: 0.75, color: [74, 122, 50], porPunta: 1 },
    flor: { color: [222, 50, 28], cantidad: 2, tamano: 2.8 },
    fruto: 'vaina', vaina: { largo: 0.5, radio: 0.025, color: [84, 54, 34], plana: true },
  },
  roblenegro: {
    alto: 4.5, radio: 0.5, largo: 6.5, niveles: 5, ramas: 3, primeras: 4, elevacion: [50, 38, 30, 26, 22], abanico: 50, caida: 0.2,
    corteza: 'fisurada', epifitas: true,
    hoja: { tipo: 'simple', largo: 0.22, ancho: 0.08, contorno: 'eliptica', color: [44, 80, 40], porPunta: 8 },
  },
  mamonchino: {
    alto: 2, radio: 0.3, largo: 3.2, niveles: 5, ramas: 3, elevacion: [62, 50, 40, 32, 26], abanico: 50, caida: 0.3,
    corteza: 'lisa', hoja: { tipo: 'pinnada', largo: 0.4, color: [44, 90, 40], porPunta: 3, pares: 3 }, fruto: 'mamonchino', frutos: 0.06,
  },
  manglerojo: {
    alto: 2.6, radio: 0.16, largo: 2.2, niveles: 4, ramas: 3, elevacion: [55, 40, 30, 25], abanico: 50, caida: 0.2,
    zancos: 12, corteza: 'lisa', suelo: 'barro',
    hoja: { tipo: 'simple', largo: 0.16, ancho: 0.07, contorno: 'eliptica', color: [52, 96, 44], porPunta: 8 }, fruto: 'propagulo',
  },
  cipres: {
    arquitectura: 'conico', alto: 16, radio: 0.35, pisos: 22, ramaMax: 3, elevacion: -8, desde: 0.12,
    corteza: 'fisurada', hoja: { tipo: 'escamas', largo: 0.5, color: [30, 62, 42], porPunta: 7 },
  },
  // Tanda B: arboles del bosque, maderables y de altura.
  cortezn: {
    alto: 3, radio: 0.3, largo: 3.2, niveles: 5, ramas: 3, elevacion: [60, 45, 32, 25, 20], abanico: 45, caida: 0.2,
    corteza: 'fisurada', flor: { color: [200, 92, 160], cantidad: 3, tamano: 2 }, hoja: null,
  },
  almendro: {
    alto: 14, radio: 0.7, largo: 8, niveles: 5, ramas: 3, elevacion: [25, 18, 15, 15, 15], abanico: 50, caida: 0.15, gambas: 6,
    corteza: 'lisa', hoja: { tipo: 'pinnada', largo: 0.45, color: [52, 96, 44], porPunta: 1, pares: 4 }, flor: { color: [190, 140, 220], cantidad: 1, tamano: 1.8 },
  },
  espavel: {
    alto: 6, radio: 0.6, largo: 6, niveles: 5, ramas: 3, elevacion: [45, 32, 24, 20, 18], abanico: 50, caida: 0.2,
    corteza: 'fisurada', hoja: { tipo: 'simple', largo: 0.32, ancho: 0.12, contorno: 'eliptica', color: [56, 100, 44], porPunta: 6 },
  },
  guapinol: {
    alto: 5, radio: 0.5, largo: 6, niveles: 5, ramas: 3, elevacion: [40, 28, 22, 18, 15], abanico: 50, caida: 0.25,
    corteza: 'lisa', hoja: { tipo: 'bifoliada', largo: 0.12, color: [60, 100, 44], porPunta: 5 },
    fruto: 'vaina', vaina: { largo: 0.14, radio: 0.022, color: [104, 62, 36], plana: true }, frutos: 0.1,
  },
  carao: {
    alto: 3, radio: 0.35, largo: 4.5, niveles: 5, ramas: 3, elevacion: [45, 32, 24, 20, 16], abanico: 50, caida: 0.25,
    corteza: 'lisa', hoja: { tipo: 'pinnada', largo: 0.4, color: [70, 112, 50], porPunta: 2, pares: 3 }, flor: { color: [232, 150, 172], cantidad: 2 },
    fruto: 'vaina', vaina: { largo: 0.6, radio: 0.016, color: [40, 32, 28] }, frutos: 0.1,
  },
  javillo: {
    alto: 8, radio: 0.5, largo: 5, niveles: 5, ramas: 3, elevacion: [48, 36, 28, 22, 18], abanico: 45, caida: 0.2, espinas: 0.35,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.22, ancho: 0.16, contorno: 'ovada', color: [60, 104, 44], porPunta: 6 },
  },
  balsa: {
    alto: 6, radio: 0.3, largo: 3.5, niveles: 4, ramas: 3, elevacion: [52, 40, 30, 25], abanico: 45, caida: 0.2,
    corteza: 'lisa', hoja: { tipo: 'grande', largo: 0.45, ancho: 0.4, color: [80, 120, 56], porPunta: 4 },
  },
  cocobolo: {
    alto: 2, radio: 0.25, largo: 3, niveles: 4, ramas: 3, elevacion: [40, 30, 24, 20], abanico: 55, caida: 0.3, torcido: 1.2,
    corteza: 'fisurada', hoja: { tipo: 'pinnada', largo: 0.25, color: [70, 110, 50], porPunta: 2, pares: 3 },
  },
  jacaranda: {
    alto: 3, radio: 0.25, largo: 4, niveles: 5, ramas: 3, elevacion: [50, 38, 30, 26, 22], abanico: 45, caida: 0.25,
    corteza: 'lisa', hoja: { tipo: 'bipinnada', largo: 0.45, color: [70, 118, 52], porPunta: 1, pocas: true }, flor: { color: [150, 110, 210], cantidad: 2, tamano: 1.8 },
  },
  almendroplaya: {
    arquitectura: 'pisos', alto: 10, radio: 0.3, pisos: 6, ramaMax: 4, elevacion: 4, desde: 0.3,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.32, ancho: 0.16, contorno: 'ovada', color: [50, 100, 44], porPunta: 8, brote: [196, 72, 40], rojas: 0.3 },
  },
  jaul: {
    alto: 6, radio: 0.25, largo: 3, niveles: 4, ramas: 3, elevacion: [62, 48, 38, 32], abanico: 40, caida: 0.15,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.13, ancho: 0.07, contorno: 'ovada', color: [56, 100, 44], porPunta: 8 },
  },
  caoba: {
    alto: 8, radio: 0.45, largo: 5, niveles: 5, ramas: 3, elevacion: [45, 32, 24, 20, 16], abanico: 50, caida: 0.2, gambas: 4,
    corteza: 'fisurada', hoja: { tipo: 'pinnada', largo: 0.4, color: [44, 90, 40], porPunta: 2, pares: 4 },
    fruto: 'generico', frutoForma: { forma: 'pera', radio: 0.06, color: [110, 80, 50], colgante: -0.02 }, frutos: 0.06,
  },
  acacia: {
    alto: 5, radio: 0.25, largo: 3.5, niveles: 5, ramas: 3, elevacion: [58, 45, 35, 28, 24], abanico: 45, caida: 0.2,
    corteza: 'fisurada', hoja: { tipo: 'simple', largo: 0.2, ancho: 0.05, contorno: 'eliptica', color: [56, 96, 44], porPunta: 8 },
  },
  amarillon: {
    arquitectura: 'pisos', alto: 22, radio: 0.4, pisos: 7, ramaMax: 4.5, elevacion: 8, desde: 0.5,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.12, ancho: 0.05, contorno: 'ovada', color: [60, 100, 44], porPunta: 10 },
  },
  terminalia: {
    arquitectura: 'pisos', alto: 18, radio: 0.35, pisos: 7, ramaMax: 4, elevacion: 3, desde: 0.35,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.15, ancho: 0.07, contorno: 'ovada', color: [62, 104, 46], porPunta: 8 },
  },
  pino: {
    arquitectura: 'conico', alto: 18, radio: 0.35, pisos: 16, ramaMax: 4, elevacion: 5, desde: 0.25,
    corteza: 'fisurada', hoja: { tipo: 'agujas', largo: 0.22, color: [40, 82, 46], porPunta: 3 },
  },
  eucalipto: {
    alto: 10, radio: 0.35, largo: 4, niveles: 4, ramas: 3, elevacion: [72, 60, 50, 42], abanico: 40, caida: 0.3,
    corteza: 'colores', hoja: { tipo: 'simple', largo: 0.22, ancho: 0.04, contorno: 'eliptica', color: [84, 122, 92], porPunta: 8 },
  },
  chilamate: {
    alto: 3, radio: 0.8, largo: 6.5, niveles: 5, ramas: 3, elevacion: [38, 26, 20, 15, 12], abanico: 55, caida: 0.3,
    gambas: 7, raicesAereas: 30, corteza: 'lisa',
    hoja: { tipo: 'simple', largo: 0.26, ancho: 0.11, contorno: 'eliptica', color: [48, 94, 42], porPunta: 7 },
  },
  robleblanco: {
    alto: 7, radio: 0.6, largo: 7, niveles: 5, ramas: 3, primeras: 4, elevacion: [55, 42, 32, 26, 22], abanico: 50, caida: 0.2,
    corteza: 'fisurada', epifitas: true, hoja: { tipo: 'simple', largo: 0.2, ancho: 0.07, contorno: 'eliptica', color: [50, 88, 44], porPunta: 8 },
  },
  aguacatillo: {
    alto: 6, radio: 0.4, largo: 5, niveles: 5, ramas: 3, elevacion: [55, 40, 30, 25, 20], abanico: 45, caida: 0.2,
    corteza: 'lisa', epifitas: true, hoja: { tipo: 'simple', largo: 0.16, ancho: 0.06, contorno: 'eliptica', color: [44, 84, 40], porPunta: 8 },
    fruto: 'generico', frutoForma: { forma: 'ovoide', radio: 0.018, color: [70, 50, 80] }, frutos: 0.1,
  },
  cedrodulce: {
    alto: 8, radio: 0.4, largo: 5, niveles: 4, ramas: 3, elevacion: [50, 36, 28, 22], abanico: 45, caida: 0.2,
    corteza: 'fisurada', epifitas: true, hoja: { tipo: 'pinnada', largo: 0.5, color: [60, 100, 44], porPunta: 2 },
  },
  lloro: {
    alto: 6, radio: 0.3, largo: 4, niveles: 5, ramas: 3, elevacion: [55, 42, 32, 26, 22], abanico: 45, caida: 0.2,
    corteza: 'lisa', epifitas: true, hoja: { tipo: 'simple', largo: 0.13, ancho: 0.06, contorno: 'eliptica', color: [56, 96, 44], porPunta: 8 },
  },
  ira: {
    alto: 8, radio: 0.45, largo: 5, niveles: 5, ramas: 3, elevacion: [52, 38, 30, 24, 20], abanico: 45, caida: 0.2,
    corteza: 'lisa', epifitas: true, hoja: { tipo: 'simple', largo: 0.18, ancho: 0.06, contorno: 'eliptica', color: [46, 86, 40], porPunta: 8 },
  },
  // Manglares.
  manglecaballero: {
    alto: 4, radio: 0.2, largo: 3, niveles: 4, ramas: 3, elevacion: [55, 40, 30, 25], abanico: 50, caida: 0.2,
    zancos: 16, corteza: 'lisa', suelo: 'barro',
    hoja: { tipo: 'simple', largo: 0.16, ancho: 0.07, contorno: 'eliptica', color: [52, 96, 44], porPunta: 8 }, fruto: 'propagulo',
  },
  manglesalado: {
    alto: 3, radio: 0.25, largo: 3, niveles: 4, ramas: 3, elevacion: [52, 38, 30, 25], abanico: 50, caida: 0.2,
    neumatoforos: 140, corteza: 'oscura', suelo: 'barro',
    hoja: { tipo: 'simple', largo: 0.1, ancho: 0.04, contorno: 'eliptica', color: [76, 106, 78], porPunta: 8 },
  },
  mangleblanco: {
    alto: 3, radio: 0.2, largo: 3, niveles: 4, ramas: 3, elevacion: [55, 40, 30, 25], abanico: 50, caida: 0.2,
    corteza: 'lisa', suelo: 'barro', hoja: { tipo: 'simple', largo: 0.08, ancho: 0.05, contorno: 'eliptica', color: [74, 122, 62], porPunta: 8 },
  },
  manglebotoncillo: {
    alto: 0.8, radio: 0.12, largo: 1.8, niveles: 4, ramas: 3, elevacion: [55, 42, 32, 26], abanico: 50, caida: 0.25, torcido: 1,
    corteza: 'oscura', suelo: 'barro', hoja: { tipo: 'simple', largo: 0.08, ancho: 0.03, contorno: 'eliptica', color: [70, 110, 60], porPunta: 8 },
    fruto: 'generico', frutoForma: { forma: 'esfera', radio: 0.008, color: [90, 70, 50], racimo: 6, colgante: 0.02 }, frutos: 0.3,
  },
  manglepinuela: {
    alto: 4, radio: 0.3, largo: 3, niveles: 4, ramas: 3, elevacion: [55, 40, 30, 25], abanico: 50, caida: 0.2, gambas: 7,
    corteza: 'lisa', suelo: 'barro', hoja: { tipo: 'simple', largo: 0.12, ancho: 0.05, contorno: 'eliptica', color: [56, 100, 46], porPunta: 8 },
    fruto: 'generico', frutoForma: { forma: 'pera', radio: 0.05, color: [120, 104, 60] }, frutos: 0.06,
  },
  // Tanda B: frutales.
  mandarina: {
    alto: 0.7, radio: 0.12, largo: 1.5, niveles: 5, ramas: 3, elevacion: [66, 56, 46, 38, 32], abanico: 55, caida: 0.35,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.12, ancho: 0.05, color: [40, 88, 36], porPunta: 7 },
    fruto: 'generico', frutoForma: { forma: 'esfera', radio: 0.033, color: [240, 132, 30], achatada: 0.85 },
  },
  guanabana: {
    alto: 1.5, radio: 0.18, largo: 2.6, niveles: 4, ramas: 3, elevacion: [60, 45, 35, 30], abanico: 45, caida: 0.25,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.16, ancho: 0.06, contorno: 'eliptica', color: [40, 90, 38], porPunta: 6 },
    fruto: 'generico', frutoForma: { forma: 'espinoso', radio: 0.08, largo: 1.6, color: [60, 110, 50] }, frutos: 0.06,
  },
  cas: {
    alto: 1.5, radio: 0.15, largo: 2.4, niveles: 4, ramas: 3, elevacion: [58, 44, 34, 28], abanico: 45, caida: 0.25,
    corteza: 'pelada', hoja: { tipo: 'simple', largo: 0.14, ancho: 0.07, contorno: 'eliptica', color: [52, 100, 46], porPunta: 6 },
    fruto: 'generico', frutoForma: { forma: 'esfera', radio: 0.03, color: [176, 190, 72] }, frutos: 0.25,
  },
  guayaba: {
    alto: 1.2, radio: 0.13, largo: 2.2, niveles: 4, ramas: 3, elevacion: [55, 42, 32, 26], abanico: 50, caida: 0.25, torcido: 1,
    corteza: 'pelada', hoja: { tipo: 'simple', largo: 0.12, ancho: 0.06, contorno: 'eliptica', color: [64, 108, 48], porPunta: 6 },
    fruto: 'generico', frutoForma: { forma: 'esfera', radio: 0.035, color: [222, 204, 92], color2: [190, 200, 90] }, frutos: 0.25,
  },
  carambola: {
    alto: 1.4, radio: 0.15, largo: 2.4, niveles: 4, ramas: 3, elevacion: [55, 40, 30, 25], abanico: 50, caida: 0.35,
    corteza: 'lisa', hoja: { tipo: 'pinnada', largo: 0.22, color: [60, 110, 48], porPunta: 3, pares: 4 },
    fruto: 'generico', frutoForma: { forma: 'estrella', radio: 0.03, largo: 2.4, color: [232, 192, 42] }, frutos: 0.3,
  },
  maranon: {
    alto: 1.2, radio: 0.2, largo: 3, niveles: 4, ramas: 3, elevacion: [40, 30, 22, 18], abanico: 55, caida: 0.3, torcido: 1,
    corteza: 'fisurada', hoja: { tipo: 'simple', largo: 0.16, ancho: 0.09, contorno: 'ovada', color: [60, 104, 44], porPunta: 6 },
    fruto: 'generico', frutoForma: { forma: 'maranon', radio: 0.035, color: [222, 60, 40], color2: [242, 190, 50] }, frutos: 0.2,
  },
  macadamia: {
    alto: 2, radio: 0.25, largo: 3, niveles: 5, ramas: 3, elevacion: [62, 50, 40, 32, 26], abanico: 45, caida: 0.2,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.2, ancho: 0.05, contorno: 'eliptica', color: [44, 86, 40], porPunta: 7 },
    fruto: 'generico', frutoForma: { forma: 'esfera', radio: 0.02, color: [90, 122, 60], racimo: 7, colgante: 0.25 }, frutos: 0.1,
  },
  achiote: {
    alto: 0.8, radio: 0.1, largo: 2, niveles: 4, ramas: 3, elevacion: [60, 46, 36, 30], abanico: 50, caida: 0.25,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.14, ancho: 0.1, contorno: 'ovada', color: [64, 108, 48], porPunta: 6 },
    fruto: 'generico', frutoForma: { forma: 'capsula', radio: 0.024, color: [196, 54, 40], racimo: 6, colgante: -0.03 }, frutos: 0.35,
  },
  nance: {
    alto: 1.5, radio: 0.15, largo: 2.2, niveles: 4, ramas: 3, elevacion: [50, 38, 30, 25], abanico: 50, caida: 0.25, torcido: 1,
    corteza: 'fisurada', hoja: { tipo: 'simple', largo: 0.12, ancho: 0.06, contorno: 'eliptica', color: [70, 110, 50], porPunta: 6 },
    fruto: 'generico', frutoForma: { forma: 'esfera', radio: 0.009, color: [240, 200, 40], racimo: 10, colgante: 0.1 }, frutos: 0.3,
  },
  jocote: {
    alto: 1.6, radio: 0.2, largo: 2.6, niveles: 4, ramas: 3, elevacion: [45, 34, 26, 22], abanico: 55, caida: 0.3, torcido: 1,
    corteza: 'lisa', hoja: { tipo: 'pinnada', largo: 0.25, color: [74, 120, 52], porPunta: 2, pares: 4, pocas: true },
    fruto: 'generico', frutoForma: { forma: 'ovoide', radio: 0.02, color: [200, 40, 40], racimo: 3, colgante: 0.02 }, frutos: 0.3,
  },
  zapote: {
    alto: 4, radio: 0.4, largo: 4, niveles: 5, ramas: 3, elevacion: [55, 42, 32, 26, 22], abanico: 45, caida: 0.2,
    corteza: 'fisurada', hoja: { tipo: 'simple', largo: 0.3, ancho: 0.1, contorno: 'eliptica', color: [50, 92, 42], porPunta: 6 },
    fruto: 'generico', frutoForma: { forma: 'ovoide', radio: 0.07, color: [140, 96, 60] }, frutos: 0.08,
  },
  mamon: {
    alto: 3, radio: 0.3, largo: 4, niveles: 5, ramas: 3, elevacion: [55, 42, 32, 26, 22], abanico: 45, caida: 0.25,
    corteza: 'lisa', hoja: { tipo: 'pinnada', largo: 0.3, color: [52, 96, 44], porPunta: 1, pares: 2 },
    fruto: 'generico', frutoForma: { forma: 'esfera', radio: 0.015, color: [100, 150, 60], racimo: 10, colgante: 0.15 }, frutos: 0.15,
  },
  anona: {
    alto: 1.3, radio: 0.14, largo: 2.2, niveles: 4, ramas: 3, elevacion: [52, 40, 30, 25], abanico: 50, caida: 0.25,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.15, ancho: 0.05, contorno: 'eliptica', color: [70, 112, 50], porPunta: 6 },
    fruto: 'generico', frutoForma: { forma: 'escamas', radio: 0.05, color: [120, 140, 60] }, frutos: 0.12,
  },
  manzanaagua: {
    alto: 2, radio: 0.25, largo: 3, niveles: 5, ramas: 3, elevacion: [62, 50, 40, 32, 26], abanico: 45, caida: 0.2,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.3, ancho: 0.1, contorno: 'eliptica', color: [36, 84, 36], porPunta: 6 },
    flor: { color: [222, 40, 120], cantidad: 2, espiga: true },
    fruto: 'generico', frutoForma: { forma: 'pera', radio: 0.03, color: [200, 40, 60] }, frutos: 0.2,
  },
  // Frutales.
  naranja: {
    alto: 0.8, radio: 0.13, largo: 1.6, niveles: 5, ramas: 3, elevacion: [66, 56, 46, 38, 32], abanico: 55, caida: 0.35,
    corteza: 'lisa', hoja: { tipo: 'simple', largo: 0.14, ancho: 0.065, color: [36, 84, 32], porPunta: 7 }, fruto: 'naranja',
  },
  mango: {
    alto: 1.6, radio: 0.35, largo: 3.6, niveles: 5, ramas: 3, elevacion: [64, 54, 44, 36, 30], abanico: 55, caida: 0.35,
    corteza: 'fisurada', hoja: { tipo: 'simple', largo: 0.38, ancho: 0.085, contorno: 'eliptica', color: [36, 78, 34], porPunta: 6, brote: [150, 70, 60] }, fruto: 'mango',
  },
  aguacate: {
    alto: 1.8, radio: 0.3, largo: 3.2, niveles: 5, ramas: 3, elevacion: [70, 60, 50, 42, 36], abanico: 45, caida: 0.25,
    corteza: 'fisurada', hoja: { tipo: 'simple', largo: 0.28, ancho: 0.12, contorno: 'eliptica', color: [52, 96, 40], porPunta: 6 }, fruto: 'aguacate',
  },
}

// Direccion que sale hacia "azimut" subiendo "grados" sobre el horizonte.
function haciaAfuera(azimut, grados) {
  const subida = THREE.MathUtils.degToRad(grados)
  return vector(Math.cos(azimut) * Math.cos(subida), Math.sin(subida), Math.sin(azimut) * Math.cos(subida))
}

// Color de la corteza en un punto, con sus fisuras, anillos y liquenes.
function colorDeCorteza(tipo, p, u, a, ruido) {
  const corteza = CORTEZAS[tipo]
  let c = aclarar(corteza.color, 0.78 + ruido(p.x * 20, p.y * 6, p.z * 20, 3) * 0.4)
  if (corteza.fisura) {
    const fisura = transicion(0.55, 0.68, ruido(Math.cos(a) * 5 + p.x * 3, p.y * 1.2, Math.sin(a) * 5 + p.z * 3, 3))
    c = aclarar(c, 1 - 0.45 * fisura)
  }
  if (corteza.anillos) c = aclarar(c, 1 - 0.25 * Math.pow(Math.abs(Math.sin(p.y * 9)), 30))
  if (corteza.colores) {
    // Franjas verticales verdes, naranjas, moradas y azuladas.
    const franja = ruido(Math.cos(a) * 3 + p.x, p.y * 0.4, Math.sin(a) * 3 + p.z, 3) * 4
    const tonos = [[96, 150, 80], [210, 130, 60], [130, 90, 150], [70, 120, 160]]
    const i = Math.floor(franja) % 4
    c = aclarar(mezclar(tonos[i], tonos[(i + 1) % 4], franja % 1), 0.85 + ruido(p.x * 20, p.y * 20, p.z * 20, 2) * 0.3)
  }
  if (corteza.pelada) {
    // Laminas de corteza vieja, verdosas y papiraceas, sobre la roja.
    c = mezclar(c, [150, 160, 120], transicion(0.6, 0.66, ruido(p.x * 8, p.y * 3, p.z * 8, 3)) * 0.8)
    c = aclarar(c, 1 + 0.12 * Math.pow(Math.max(0, Math.cos(a)), 6))
  }
  return mezclar(c, [180, 186, 160], transicion(0.62, 0.7, ruido(p.x * 12 + 5, p.y * 12, p.z * 12, 3)) * corteza.liquen)
}

// Hojas en la punta de una ramita, segun el tipo de hoja de la especie.
function hojasDePunta(malla, punta, dir, especie, random, ruido) {
  const h = especie.hoja
  // Brote nuevo (rojizo en el mango) en pocas puntas.
  const brote = random() < (h.rojas ?? 0.12)
  const cantidad = (h.porPunta ?? 5) * (h.pocas ? 0.5 : 1)
  for (let k = 0; k < cantidad; k++) {
    const azimut = k * 2.39996 + random()
    const salida = dir.clone().multiplyScalar(0.6).add(haciaAfuera(azimut, -10 + random() * 40)).normalize()
    const desde = punta.clone().addScaledVector(dir, -0.04 * k)
    const color = mezclar(h.color, h.brote ?? [100, 140, 60], h.brote && brote && k < 3 ? 0.8 : random() * 0.25)
    const largo = h.largo * (0.75 + random() * 0.5)
    if (h.tipo === 'simple' || h.tipo === 'grande') {
      hoja(malla, {
        base: desde,
        direccion: salida,
        largo,
        ancho: (h.ancho ?? h.largo * 0.45) * (0.8 + random() * 0.4),
        contorno: CONTORNOS[h.contorno ?? 'ovada'],
        curvatura: h.tipo === 'grande' ? 1.2 : 0.8,
        pliegue: 0.12,
        abolladura: h.tipo === 'grande' ? 0.05 : 0.02,
        nervios: h.tipo === 'grande' ? 10 : 6,
        color: () => color,
        ruido,
        semilla: random() * 100,
        nu: h.tipo === 'grande' ? 12 : 6,
        nv: h.tipo === 'grande' ? 6 : 3,
      })
    } else if (h.tipo === 'palmada') {
      // Hoja palmeada: un peciolo y los lobulos (o foliolos) en abanico.
      const centro = desde.clone().addScaledVector(salida, largo * 0.5)
      const lobulos = h.lobulos
      for (let l = 0; l < lobulos; l++) {
        const giro = (l / (lobulos - 1) - 0.5) * (h.lobulos > 7 ? 5.5 : 3.2)
        hoja(malla, {
          base: centro,
          direccion: girar(salida, ARRIBA, giro).addScaledVector(ARRIBA, -0.2).normalize(),
          largo: largo * (0.55 + 0.45 * Math.cos(giro * 0.4)),
          ancho: largo * 0.18,
          contorno: CONTORNOS.eliptica,
          curvatura: 0.9,
          nervios: 5,
          color: (u, s) => (h.plata ? mezclar(color, [190, 198, 186], 0.25 * Math.abs(s)) : color),
          ruido,
          nu: 6,
          nv: 3,
        })
      }
    } else if (h.tipo === 'escamas') {
      // Ramilletes planos de hojitas en escama, que caen en abanico.
      hoja(malla, {
        base: desde,
        direccion: salida.clone().addScaledVector(ARRIBA, -0.3).normalize(),
        largo,
        ancho: largo * 0.22,
        contorno: CONTORNOS.eliptica,
        curvatura: 1.2,
        pliegue: 0,
        dientes: 30,
        nervios: 1,
        color: (u, s) => aclarar(color, 0.75 + 0.35 * Math.abs(Math.sin(u * 70 + s * 6))),
        ruido,
        nu: 8,
        nv: 4,
      })
    } else if (h.tipo === 'agujas') {
      // Agujas del pino en manojos que se abren desde la ramita.
      for (let a = 0; a < 6; a++) {
        hojaLarga(malla, {
          base: desde,
          direccion: salida.clone().add(haciaAfuera(azimut + a * 1.05, -20 + random() * 50).multiplyScalar(0.8)).normalize(),
          largo,
          ancho: 0.004,
          curvatura: 0.3,
          nervio: 0,
          color: () => color,
          ruido,
          nu: 4,
          nv: 1,
        })
      }
    } else if (h.tipo === 'bifoliada') {
      // Dos foliolos asimetricos en la punta del peciolo (guapinol).
      const centro = desde.clone().addScaledVector(salida, largo * 0.3)
      for (const giro of [-0.5, 0.5]) {
        hoja(malla, {
          base: centro,
          direccion: girar(salida, ARRIBA, giro),
          largo,
          ancho: largo * 0.4,
          contorno: CONTORNOS.ovada,
          curvatura: 0.6,
          nervios: 6,
          color: () => color,
          ruido,
          nu: 6,
          nv: 3,
        })
      }
    } else if (h.tipo === 'trifoliada') {
      const centro = desde.clone().addScaledVector(salida, largo * 0.4)
      for (const giro of [-1.2, 0, 1.2]) {
        hoja(malla, {
          base: centro,
          direccion: girar(salida, ARRIBA, giro),
          largo: largo * (giro ? 0.8 : 1),
          ancho: largo * 0.75,
          contorno: CONTORNOS.ovada,
          curvatura: 0.8,
          nervios: 5,
          color: () => color,
          ruido,
          nu: 6,
          nv: 4,
        })
      }
    } else {
      // Compuesta (pinnada) o bipinnada (guanacaste): un raquis con foliolos
      // chiquitos a los dos lados; en la bipinnada cada pina es una tira de
      // foliolos diminutos, que de lejos se ve como una pluma.
      const raquis = columna(desde, salida, largo, 0.9, 10)
      const pares = h.pares ?? (h.tipo === 'bipinnada' ? 5 : 6)
      for (let f = 0; f < pares; f++) {
        const { p, tangente } = raquis(0.2 + (f / pares) * 0.75)
        for (const lado of [-1, 1]) {
          const lateral = girar(tangente, ARRIBA, lado * 1.1)
          hoja(malla, {
            base: p,
            direccion: lateral,
            largo: largo * (h.tipo === 'bipinnada' ? 0.32 : 0.22),
            ancho: largo * (h.tipo === 'bipinnada' ? 0.05 : 0.07),
            contorno: CONTORNOS.eliptica,
            curvatura: 0.4,
            pliegue: 0,
            nervios: h.tipo === 'bipinnada' ? 14 : 4,
            angulo: h.tipo === 'bipinnada' ? 0 : 0.5,
            color: (u) => (h.tipo === 'bipinnada' ? aclarar(color, 0.85 + 0.25 * Math.abs(Math.sin(u * 40))) : color),
            ruido,
            nu: h.tipo === 'bipinnada' ? 8 : 5,
            nv: 2,
          })
        }
      }
    }
  }
}

// Ramillete de flores en la punta de una ramita: flores de trompeta (cortez,
// roble) con cinco petalos abiertos, o una espiga de flores alargadas (poro).
function floresDePunta(malla, punta, dir, flor, random, ruido) {
  for (let k = 0; k < flor.cantidad; k++) {
    const azimut = k * 2.39996 + random()
    const salida = dir.clone().multiplyScalar(0.5).add(haciaAfuera(azimut, 10 + random() * 50)).normalize()
    const tamano = flor.tamano ?? 1
    const centro = punta.clone().addScaledVector(salida, (0.06 + random() * 0.05) * tamano)
    const color = aclarar(flor.color, 0.88 + random() * 0.2)
    if (flor.espiga) {
      cuerpo(malla, centro, centro.clone().addScaledVector(salida, 0.07 * tamano), 0.009 * tamano, (u) => Math.sin(Math.PI * Math.min(1, 0.1 + u)) ** 0.5, () => color, { nu: 5, nv: 5 })
      continue
    }
    // Tubo de la corola y cinco petalos.
    cuerpo(malla, centro.clone().addScaledVector(salida, -0.04 * tamano), centro, 0.012 * tamano, (u) => 0.35 + 0.65 * u, () => aclarar(color, 0.85), { nu: 3, nv: 6 })
    for (let p = 0; p < 5; p++) {
      hoja(malla, {
        base: centro,
        direccion: girar(salida.clone().cross(ARRIBA).normalize(), salida, p * 1.2566).addScaledVector(salida, 0.6).normalize(),
        largo: 0.035 * tamano,
        ancho: 0.03 * tamano,
        contorno: CONTORNOS.eliptica,
        curvatura: -0.6,
        pliegue: 0,
        nervios: 2,
        color: (u) => mezclar(color, [255, 245, 220], 0.25 * (1 - u)),
        ruido,
        nu: 4,
        nv: 2,
      })
    }
  }
}

// Vaina de guanacaste: una "oreja" cafe oscura enrollada en espiral.
function orejaDeGuanacaste(malla, centro, random, ruido) {
  const eje = vector(random() - 0.5, 0.2, random() - 0.5).normalize()
  const lado = eje.clone().cross(ARRIBA).normalize()
  const otro = eje.clone().cross(lado).normalize()
  malla.tubo(
    40,
    10,
    (u) => {
      const ang = u * Math.PI * 1.7
      const r = 0.05 + 0.04 * (1 - u)
      return centro.clone().addScaledVector(lado, Math.cos(ang) * r).addScaledVector(otro, Math.sin(ang) * r)
    },
    (u, a) => 0.022 * Math.sin(Math.PI * Math.min(1, 0.05 + u)) ** 0.4 / Math.sqrt(Math.cos(a) ** 2 + (Math.sin(a) / 0.3) ** 2),
    (u, a, p) => aclarar([72, 44, 30], 0.8 + ruido(p.x * 200, p.y * 200, p.z * 200, 2) * 0.4),
  )
}

// Vaina colgante (guaba, cenizaro, malinche): larga, un poco curva, con
// costillas a lo largo (guaba) o aplanada (malinche).
function vainaColgante(malla, desde, vaina, random, ruido) {
  const dir = vector(random() - 0.5, -2, random() - 0.5).normalize()
  const eje = columna(desde, dir, vaina.largo * (0.8 + random() * 0.4), 0.6, 16)
  malla.tubo(
    30,
    12,
    (u) => eje(u).p,
    (u, a) => {
      const r = vaina.radio * Math.pow(Math.sin(Math.PI * Math.min(1, 0.03 + u)), 0.35)
      const plana = vaina.plana ? 1 / Math.sqrt(Math.cos(a) ** 2 + (Math.sin(a) / 0.3) ** 2) : 1
      return r * plana * (vaina.costillas ? 1 + 0.12 * Math.pow(Math.abs(Math.cos(a * 2)), 4) : 1)
    },
    (u, a, p) => aclarar(vaina.color, 0.82 + ruido(p.x * 120, p.y * 120, p.z * 120, 2) * 0.3),
  )
}

// Mamon chino (rambutan): racimo de frutas rojas cubiertas de pelos
// (espinteros) blandos, verdes en la punta.
export function racimoDeMamonChino(malla, desde, random, ruido) {
  const frutos = 6 + Math.floor(random() * 6)
  for (let f = 0; f < frutos; f++) {
    const centro = desde.clone().add(vector((random() - 0.5) * 0.12, -0.06 - random() * 0.1, (random() - 0.5) * 0.12))
    malla.tubo(4, 3, (u) => desde.clone().lerp(centro, u), () => 0.0025, () => [90, 100, 50])
    const radio = 0.024
    cuerpo(
      malla,
      centro.clone().addScaledVector(ARRIBA, -radio),
      centro.clone().addScaledVector(ARRIBA, radio),
      radio,
      PERFILES.esfera,
      (u, a) => {
        const { d1 } = celdas(u, a, 70, radio * 2, radio)
        const pelo = Math.max(0, 1 - d1 / 0.004)
        return mezclar(aclarar([200, 30, 30], 0.85 + ruido(a * 3, u * 9, f, 1) * 0.25), [150, 170, 60], pelo * 0.8)
      },
      {
        forma: (u, a) => 1 + 0.45 * Math.pow(Math.max(0, 1 - celdas(u, a, 70, radio * 2, radio).d1 / 0.004), 2),
        nu: 18,
        nv: 18,
      },
    )
  }
}

// Propagulo del mangle rojo: una plantita alargada en forma de lapiz que
// cuelga del arbol antes de caer al agua.
function propagulo(malla, desde, random, ruido) {
  const largo = 0.25 + random() * 0.15
  const fin = desde.clone().add(vector(0, -largo, 0))
  malla.tubo(16, 8, (u) => desde.clone().lerp(fin, u), (u) => 0.008 * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, 0.2 + u * 0.8))), (u, a, p) =>
    mezclar(aclarar([96, 128, 54], 0.85 + ruido(p.x * 200, p.y * 200, p.z * 200, 2) * 0.2), [120, 80, 50], transicion(0.85, 1, u)),
  )
}

// Fruto generico de los frutales, segun su forma:
//   esfera (cas, guayaba, mandarina, nance), ovoide (jocote, zapote), pera
//   (manzana de agua, caoba), estrella (carambola: cinco aristas), espinoso
//   (guanabana), escamas (anona), maranon (el falso fruto con la semilla en
//   forma de rinon abajo), nuez (macadamia) y capsula (achiote, peluda).
//   radio, largo (cuanto mas largo que ancho), color y color2 (degradado),
//   colgante (largo del pedunculo; negativo: el fruto apunta hacia arriba),
//   racimo (cuantos juntos).
export function frutoGenerico(malla, punta, f, random, ruido) {
  const colgante = f.colgante ?? 0.04
  const arriba = colgante < 0
  const fin = punta.clone().addScaledVector(ARRIBA, -Math.abs(colgante))
  if (Math.abs(colgante) > 0.005) malla.tubo(6, 4, (u) => punta.clone().lerp(fin, u), () => Math.max(0.002, f.radio * 0.08), () => [96, 104, 56])
  const cantidad = f.racimo ?? 1
  for (let n = 0; n < cantidad; n++) {
    const ang = n * 2.39996
    const centro = fin.clone().add(vector(Math.cos(ang) * f.radio * 1.3 * Math.min(1, n), -f.radio * (arriba ? -1 : 1) - n * f.radio * 0.3, Math.sin(ang) * f.radio * 1.3 * Math.min(1, n)))
    const largo = f.largo ?? (f.forma === 'ovoide' || f.forma === 'pera' ? 1.4 : 1)
    const desde = centro.clone().addScaledVector(ARRIBA, -f.radio * largo)
    const hasta = centro.clone().addScaledVector(ARRIBA, f.radio * largo)
    const color = (u, a, p) => {
      let c = mezclar(f.color, f.color2 ?? f.color, transicion(0.2, 0.9, u))
      c = aclarar(c, 0.85 + ruido(p.x * 300, p.y * 300, p.z * 300, 2) * 0.25)
      if (f.forma === 'escamas' || f.forma === 'espinoso') {
        const { d1, d2 } = celdas(u, a, 40, f.radio * 2 * largo, f.radio)
        c = aclarar(c, 1 - 0.3 * (1 - transicion(0, 0.004, d2 - d1)))
        if (f.forma === 'espinoso') c = mezclar(c, [40, 60, 30], Math.max(0, 1 - d1 / 0.006))
      }
      if (f.forma === 'capsula') c = mezclar(c, [230, 120, 100], Math.pow(Math.abs(Math.sin(a * 9 + u * 12)), 8) * 0.5)
      return c
    }
    const formas = {
      estrella: (u, a) => 1 - 0.38 * Math.pow(Math.abs(Math.sin((a * 5) / 2)), 0.8),
      espinoso: (u, a) => 1 + 0.12 * Math.max(0, 1 - celdas(u, a, 40, f.radio * 2 * largo, f.radio).d1 / 0.008) ** 2,
      escamas: (u, a) => 1 + 0.05 * Math.max(0, 1 - celdas(u, a, 40, f.radio * 2 * largo, f.radio).d1 / 0.02),
      capsula: (u, a) => (1 + 0.15 * Math.pow(Math.abs(Math.sin(a * 9 + u * 12)), 8)) * (1 - 0.4 * transicion(0.6, 1, arriba ? 1 - u : u)),
    }
    const perfil = f.forma === 'pera' || f.forma === 'maranon' ? (u) => PERFILES.huevo(u) * (1.15 - 0.45 * transicion(0.3, 0.95, arriba ? u : 1 - u)) : PERFILES.esfera
    // Los frutos chicos en racimo llevan menos detalle (no se nota y pesan mucho).
    const detalle = cantidad > 1 ? { nu: 8, nv: 10 } : { nu: 16, nv: 18 }
    cuerpo(malla, desde, hasta, f.radio, perfil, color, { forma: formas[f.forma] ?? (() => f.achatada ?? 1), ...detalle })
    if (f.forma === 'maranon') {
      // La semilla (la nuez del maranon) cuelga debajo del falso fruto.
      const semilla = desde.clone().addScaledVector(ARRIBA, -f.radio * 0.4)
      cuerpo(malla, semilla.clone().addScaledVector(ARRIBA, -f.radio * 0.5), semilla.clone().addScaledVector(ARRIBA, f.radio * 0.3), f.radio * 0.4, PERFILES.huevo, () => [110, 100, 80], { nu: 8, nv: 10 })
    }
  }
}

const FRUTOS = {
  generico: (malla, p, random, ruido, especie) => frutoGenerico(malla, p, especie.frutoForma, random, ruido),
  vaina: (malla, p, random, ruido, especie) => vainaColgante(malla, p, especie.vaina, random, ruido),
  mamonchino: (malla, p, random, ruido) => racimoDeMamonChino(malla, p, random, ruido),
  propagulo: (malla, p, random, ruido) => propagulo(malla, p, random, ruido),
  naranja: (malla, p, random, ruido) => frutoDeNaranja(malla, p.clone().addScaledVector(ARRIBA, -0.05), 0.04, random, ruido),
  mango: (malla, p, random, ruido) => {
    // El mango cuelga de un pedunculo largo.
    const fin = p.clone().addScaledVector(ARRIBA, -0.25)
    malla.tubo(8, 4, (u) => p.clone().lerp(fin, u), () => 0.003, () => [90, 100, 50])
    frutoDeMango(malla, fin, 0.07, random, ruido)
  },
  aguacate: (malla, p, random, ruido) => {
    const fin = p.clone().addScaledVector(ARRIBA, -0.1)
    malla.tubo(6, 4, (u) => p.clone().lerp(fin, u), () => 0.005, () => [90, 100, 50])
    frutoDeAguacate(malla, fin, 0.065, random, ruido)
  },
  oreja: (malla, p, random, ruido) => orejaDeGuanacaste(malla, p.clone().addScaledVector(ARRIBA, -0.1), random, ruido),
}

// Epifitas sobre una rama de un bosque de altura: una bromelia (roseta de
// hojas rojizas y verdes) o un mechon de barba de viejo que cuelga.
function epifita(malla, punto, random, ruido) {
  if (random() < 0.5) {
    const color = mezclar([70, 110, 50], [180, 50, 50], random() * 0.7)
    for (let h = 0; h < 9; h++) {
      const az = h * 2.39996
      hojaLarga(malla, {
        base: punto,
        direccion: vector(Math.cos(az) * 0.6, 0.8, Math.sin(az) * 0.6).normalize(),
        largo: 0.22 + random() * 0.1,
        ancho: 0.025,
        curvatura: 1.6,
        nervio: 0.1,
        color: (u) => mezclar(color, [200, 60, 50], u * 0.4),
        ruido,
        nu: 8,
        nv: 2,
      })
    }
  } else {
    for (let h = 0; h < 6; h++) {
      const fin = punto.clone().add(vector((random() - 0.5) * 0.2, -0.4 - random() * 0.6, (random() - 0.5) * 0.2))
      malla.tubo(10, 3, (u) => punto.clone().lerp(fin, u).add(vector(Math.sin(u * 9 + h) * 0.02, 0, 0)), () => 0.004, () => aclarar([170, 176, 160], 0.85 + random() * 0.2))
    }
  }
}

// Arbol con eje central (cipres, laurel): el tronco llega hasta la punta y
// de el salen pisos de ramas casi horizontales, mas cortas hacia arriba
// (conico) o mas largas en el medio (pisos).
function arbolConEje(malla, especie, random, ruido, puntas) {
  const fuste = (u) => vector((ruido(u * 2, 1, 7, 2) - 0.5) * 0.3, -0.05 + u * especie.alto, (ruido(u * 2, 9, 7, 2) - 0.5) * 0.3)
  malla.tubo(
    Math.round(especie.alto * 10),
    24,
    fuste,
    (u) => especie.radio * (1 - 0.92 * u) * (1 + 0.5 * Math.exp(-u * especie.alto * 2)),
    (u, a, p) => colorDeCorteza(especie.corteza, p, u, a, ruido),
  )
  for (let piso = 0; piso < especie.pisos; piso++) {
    const t = especie.desde + (piso / especie.pisos) * (1 - especie.desde) * 0.96
    const largo = especie.ramaMax * (especie.arquitectura === 'conico' ? Math.pow(1 - t, 0.9) * 1.15 : Math.sin(Math.PI * Math.pow((t - especie.desde) / (1 - especie.desde), 0.7)) * 0.9 + 0.1)
    const ramas = especie.arquitectura === 'conico' ? 5 : 4
    for (let r = 0; r < ramas; r++) {
      const az = (r / ramas) * Math.PI * 2 + piso * 0.9 + random() * 0.4
      const dir = haciaAfuera(az, especie.elevacion + (random() - 0.5) * 10)
      const eje = columna(fuste(t), dir, largo, 0.5, 12)
      malla.tubo(10, 6, (u) => eje(u).p, (u) => especie.radio * 0.18 * (1 - u * 0.7) * (1 - t * 0.6), (u, a, p) => colorDeCorteza(especie.corteza, p, u, a, ruido))
      // Ramitas a lo largo de la rama, con las hojas.
      const ramitas = Math.max(2, Math.round(largo * 2.2))
      for (let k = 1; k <= ramitas; k++) {
        const { p, tangente } = eje(k / ramitas)
        puntas.push({ p, tangente: tangente.clone().addScaledVector(ARRIBA, 0.2).normalize() })
      }
    }
  }
  puntas.push({ p: fuste(1), tangente: ARRIBA.clone() })
}

// Correccion - Poll: los arboles eran matas redondas iguales para cualquier especie
export function arbol(malla, random, ruido, nombre) {
  const especie = ARBOLES[nombre]
  suelo(malla, Math.max(0.8, especie.radio * 4, especie.zancos ? 1.6 : 0), 0.06, ruido, especie.suelo === 'barro')
  const puntas = []
  if (especie.arquitectura) {
    arbolConEje(malla, especie, random, ruido, puntas)
    for (const { p, tangente } of puntas) {
      hojasDePunta(malla, p, tangente, especie, random, ruido)
      if (especie.flor && random() < 0.5) floresDePunta(malla, p, tangente, especie.flor, random, ruido)
    }
    return
  }
  // Puntos a lo largo de las ramas gruesas, para colgar epifitas o raices aereas.
  const ramasGruesas = []

  // Fuste: un poco torcido, mas ancho en la base y, en la ceiba, con gambas
  // (raices en tabla) que bajan al suelo.
  const torcido = (especie.torcido ?? 0.3) * 0.6
  const fuste = (u) =>
    vector((ruido(u * 2, 1, 7, 2) - 0.5) * torcido * especie.alto * 0.15, -0.05 + u * especie.alto, (ruido(u * 2, 9, 7, 2) - 0.5) * torcido * especie.alto * 0.15)
  const gambas = especie.gambas ?? 0
  malla.tubo(
    Math.max(30, Math.round(especie.alto * 12)),
    gambas ? 72 : 32,
    fuste,
    (u, a) => {
      let r = especie.radio * (1 - 0.25 * u) * (1 + 0.6 * Math.exp(-u * especie.alto * 2))
      if (gambas) r += especie.radio * 2.2 * Math.pow(Math.max(0, Math.cos(a * gambas / 2)), 12) * Math.exp(-u * especie.alto / 2.5)
      if (CORTEZAS[especie.corteza].fisura) r *= 1 - 0.03 * transicion(0.55, 0.68, ruido(Math.cos(a) * 5, u * especie.alto * 1.2, Math.sin(a) * 5, 3))
      if (especie.espinas) {
        // Aguijones conicos repartidos por el tronco.
        const fila = u * especie.alto * 7
        const k = Math.round(fila)
        r += especie.radio * especie.espinas * Math.exp(-(((fila - k) / 0.12) ** 2)) * Math.pow(Math.max(0, Math.cos(a * 9 + k * 1.7)), 60)
      }
      return r
    },
    (u, a, p) => {
      const c = colorDeCorteza(especie.corteza, p, u, a, ruido)
      return especie.epifitas ? mezclar(c, [70, 100, 50], transicion(0.45, 0.6, ruido(p.x * 6, p.y * 6, p.z * 6, 3)) * 0.8) : c
    },
  )

  // Neumatoforos del mangle salado: raices que salen del barro como lapices,
  // para respirar cuando sube la marea.
  for (let n = 0; n < (especie.neumatoforos ?? 0); n++) {
    const ang = random() * Math.PI * 2
    const r = 0.4 + Math.sqrt(random()) * 1.2
    const base = vector(Math.cos(ang) * r, -0.02, Math.sin(ang) * r)
    const alto = 0.12 + random() * 0.2
    malla.tubo(6, 5, (u) => base.clone().addScaledVector(ARRIBA, u * alto), (u) => 0.012 * (1 - u * 0.6), (u, a, p) => aclarar([110, 96, 80], 0.8 + ruido(p.x * 90, p.y * 90, p.z * 90, 2) * 0.3))
  }

  // Raices en zancos (mangle rojo): arcos desde el tronco hasta el barro.
  for (let z = 0; z < (especie.zancos ?? 0); z++) {
    const az = (z / especie.zancos) * Math.PI * 2 + random() * 0.4
    const desde = fuste(0.15 + random() * 0.35)
    const hasta = vector(Math.cos(az) * (0.9 + random() * 0.6), -0.05, Math.sin(az) * (0.9 + random() * 0.6))
    malla.tubo(
      20,
      8,
      (u) => desde.clone().lerp(hasta, u).addScaledVector(ARRIBA, Math.sin(Math.PI * u) * 0.4),
      () => especie.radio * 0.28,
      (u, a, p) => mezclar(colorDeCorteza(especie.corteza, p, u, a, ruido), [80, 70, 55], transicion(0.7, 1, u)),
    )
  }

  // Copa: ramas que se dividen nivel por nivel.
  function crecer(desde, dir, largo, radio, nivel, azimut) {
    const curva = especie.caida * (1 - Math.max(0, dir.y)) * (nivel < 2 ? 1.5 : 1)
    const eje = columna(desde, dir, largo, curva, 16)
    malla.tubo(
      Math.max(6, Math.round(largo * 6)),
      Math.max(5, Math.min(16, Math.round(radio * 60))),
      (u) => eje(u).p,
      (u) => radio * (1 - u * 0.35),
      (u, a, p) => {
        const c = colorDeCorteza(especie.corteza, p, u, a, ruido)
        return especie.epifitas ? mezclar(c, [70, 100, 50], transicion(0.45, 0.6, ruido(p.x * 6, p.y * 6, p.z * 6, 3)) * 0.8) : c
      },
    )
    const fin = eje(1)
    if (nivel >= 2) ramasGruesas.push(eje(0.5).p)
    const profundidad = especie.niveles - nivel
    if (nivel === 1) puntas.push(eje(0.5))
    if (nivel === 0) {
      puntas.push(fin, eje(0.45))
      return
    }
    // En la primera horqueta, las ramas que pida la especie (o entre 2 y 4).
    const hijas = profundidad === 0 && especie.primeras ? especie.primeras : especie.ramas + (random() < 0.3 ? 1 : 0) - (random() < 0.2 ? 1 : 0)
    // Regla de Leonardo: el area de la madre se reparte entre las hijas.
    const radioHija = radio * Math.pow(1 / Math.max(1, hijas), 1 / 2.4)
    for (let h = 0; h < hijas; h++) {
      const az = profundidad === 0 ? azimut + (h / hijas) * Math.PI * 2 : azimut + THREE.MathUtils.degToRad((h / Math.max(1, hijas - 1) - 0.5) * 2 * especie.abanico) + (random() - 0.5) * 0.4
      const subida = especie.elevacion[Math.min(especie.elevacion.length - 1, profundidad)] + (random() - 0.5) * 16
      const nueva = haciaAfuera(az, subida)
      const desdeHija = h === 0 ? fin.p : eje(0.6 + random() * 0.4).p
      crecer(desdeHija, nueva, largo * (0.72 + random() * 0.14), radioHija, nivel - 1, az)
    }
  }
  const tope = fuste(1)
  const largo = especie.largo
  crecer(tope, ARRIBA.clone(), largo * 0.35, especie.radio * 0.75, especie.niveles, random() * Math.PI * 2)

  // Hojas, flores y frutos en las puntas.
  for (const { p, tangente } of puntas) {
    if (especie.hoja) hojasDePunta(malla, p, tangente, especie, random, ruido)
    if (especie.flor) floresDePunta(malla, p, tangente, especie.flor, random, ruido)
    if (especie.fruto && random() < (especie.frutos ?? (especie.fruto === 'oreja' ? 0.12 : 0.3))) FRUTOS[especie.fruto](malla, p, random, ruido, especie)
  }

  // Raices aereas del higueron: cuelgan de las ramas gruesas hacia el suelo.
  for (let r = 0; r < (especie.raicesAereas ?? 0) && ramasGruesas.length; r++) {
    const desde = ramasGruesas[Math.floor(random() * ramasGruesas.length)]
    const fin = vector(desde.x + (random() - 0.5) * 0.3, desde.y * (0.2 + random() * 0.5), desde.z + (random() - 0.5) * 0.3)
    malla.tubo(16, 5, (u) => desde.clone().lerp(fin, u), (u) => 0.025 * (1 - u * 0.6), (u, a, p) => colorDeCorteza(especie.corteza, p, u, a, ruido))
  }
  // Epifitas sobre las ramas.
  if (especie.epifitas) for (const p of ramasGruesas) epifita(malla, p, random, ruido)
}
