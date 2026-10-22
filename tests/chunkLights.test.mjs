import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { cutBlock, injectChunkLights, createChunkLightState, createMaterialFactory } from '../src/world/chunkLights.js';

const once = (s, needle) => s.split(needle).length - 1;
const RE_CALL = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const GUARDED = `if ( directLight.visible ) { ${RE_CALL} }`;
const base =() => ({ fragmentShader: '#include <common>\n#include <lights_pars_begin>\n#include <lights_fragment_begin>\n', uniforms: {} });

test('cutBlock quita un bloque con #if anidados', () => {
  const t = 'a\n#if X\n#ifdef Y\nb\n#endif\nc\n#endif\nd\n';
  assert.equal(cutBlock(t, '#if X'), 'a\nd\n');
  assert.throws(() => cutBlock(t, '#if Z'), /#if Z/);
});
test('inyección con Kp=1, Ks=2', () => {
  const sh = base();
  injectChunkLights(sh, 1, 2);
  const f = sh.fragmentShader;
  assert.equal(once(f, 'uniform PointLight uChunkPoint[1];'), 1);
  assert.equal(once(f, 'uniform SpotLight uChunkSpot[2];'), 1);
  assert.equal(once(f, 'for ( int i = 0; i < 1; i ++ )'), 1);
  assert.equal(once(f, 'for ( int i = 0; i < 2; i ++ )'), 1);
  assert.equal(once(f, 'pointLight = uChunkPoint[ i ];'), 1);
  assert.equal(once(f, 'spotLight = uChunkSpot[ i ];'), 1);
  assert.equal(once(f, 'pointLights[ i ]'), 0);
  assert.equal(once(f, 'spotLights[ i ]'), 0);
  assert.equal(once(f, '#include <lights_fragment_begin>'), 0);
  assert.equal(once(f, 'RE_Direct( directLight'), once(THREE.ShaderChunk.lights_fragment_begin, 'RE_Direct( directLight'));
});
test('inyección con Kp=0 elimina el bloque de puntuales', () => {
  const sh = base();
  injectChunkLights(sh, 0, 3);
  assert.equal(once(sh.fragmentShader, 'uChunkPoint'), 0);
  assert.equal(once(sh.fragmentShader, 'pointLight = '), 0);
  assert.equal(once(sh.fragmentShader, 'spotLight = uChunkSpot[ i ];'), 1);
});
test('inyección falla si falta el include', () => {
  assert.throws(() => injectChunkLights({ fragmentShader: '#include <common>', uniforms: {} }, 1, 1), /lights_pars_begin/);
});
test('sync calcula posición y dirección en espacio de vista', () => {
  const spot = new THREE.SpotLight(0xff8800, 2, 10, 0.5, 0.25, 1.5);
  spot.position.set(0, 10, 0); spot.target.position.set(0, 0, 0);
  spot.updateMatrixWorld(); spot.target.updateMatrixWorld();
  const cam = new THREE.PerspectiveCamera(); cam.position.set(0, 0, 20); cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  const st = createChunkLightState([], [spot]);
  st.sync(cam, 1);
  const u = st.spots[0];
  assert.deepEqual([u.position.x, u.position.y, u.position.z], [0, 10, -20]);
  assert.deepEqual([u.direction.x, u.direction.y, u.direction.z], [0, 1, 0]); // de la diana a la luz, como en WebGLLights
  assert.equal(u.coneCos, Math.cos(0.5)); assert.equal(u.penumbraCos, Math.cos(0.5 * 0.75));
  assert.equal(u.distance, 10); assert.equal(u.decay, 1.5);
  assert.equal(u.color.r, 2); assert.equal(st.frame, 1);
});

// ---------- Pruebas añadidas en la tarea 6 ----------

test('cutBlock: #ifndef anidado, sangría, bloque sin cerrar y línea repetida', () => {
  const t = 'x\n\t#if A\n\t\t#ifndef B\n\t\tb\n\t\t#else\n\t\tc\n\t\t#endif\n\t#elif C\n\td\n\t#endif\ny';
  assert.equal(cutBlock(t, '#if A'), 'x\ny');
  assert.throws(() => cutBlock('#if A\nb\n', '#if A'), /#if A/);
  assert.throws(() => cutBlock('#if A\n#endif\n#if A\n#endif\n', '#if A'), /#if A/);
});

test('inyección con Kp=0 y Ks=0 quita los dos bucles y deja el resto del chunk', () => {
  const sh = base();
  injectChunkLights(sh, 0, 0);
  const f = sh.fragmentShader;
  assert.equal(once(f, 'uChunk'), 0);
  assert.equal(once(f, 'pointLight'), 0);
  assert.equal(once(f, 'spotLight'), 0);
  // quedan los bucles de sol, direccionales, rectangulares y hemisféricas
  assert.equal(once(f, 'RE_Direct( directLight'), once(THREE.ShaderChunk.lights_fragment_begin, 'RE_Direct( directLight') - 2);
  assert.equal(once(f, 'directionalLight = directionalLights[ i ];'), 1);
});

test('inyección: cada cadena buscada debe aparecer exactamente una vez', () => {
  const twice = { fragmentShader: '#include <lights_pars_begin>\n#include <lights_fragment_begin>\n#include <lights_fragment_begin>\n', uniforms: {} };
  assert.throws(() => injectChunkLights(twice, 1, 1), /lights_fragment_begin/);
  const noBegin = { fragmentShader: '#include <lights_pars_begin>\n', uniforms: {} };
  assert.throws(() => injectChunkLights(noBegin, 1, 1), /lights_fragment_begin/);
  assert.throws(() => injectChunkLights(base(), -1, 1), /Kp/);
  assert.throws(() => injectChunkLights(base(), 1, 1.5), /Ks/);
});

// Preprocesado de three 0.186.1 (resolveIncludes, replaceLightNums, replaceClippingPlaneNums, unrollLoops, en el
// orden de WebGLProgram), extraído de su código como en
// materialFactory.test.mjs: es lo que three hace con el texto que deja onBeforeCompile antes de compilarlo.
const threeSource = readFileSync(new URL('../node_modules/three/build/three.module.js', import.meta.url), 'utf8');
const preSource = threeSource.match(/function replaceLightNums\( string, parameters \) \{[\s\S]*?\nfunction loopReplacer\([\s\S]*?\n\}\n/)[0];
const { replaceLightNums, replaceClippingPlaneNums, resolveIncludes, unrollLoops } = new Function('ShaderChunk', 'warn', `${preSource}; return { replaceLightNums, replaceClippingPlaneNums, resolveIncludes, unrollLoops };`)(THREE.ShaderChunk, () => {});
const LIGHTS = { numSunLights: 0, numDirLights: 2, numSpotLights: 11, numSpotLightMaps: 0, numSpotLightShadows: 0, numSpotLightShadowsWithMaps: 0, numRectAreaLights: 0, numPointLights: 5, numHemiLights: 1, numSunLightShadows: 0, numDirLightShadows: 1, numPointLightShadows: 0 };
const preprocess = (s, lights = LIGHTS) => unrollLoops(replaceClippingPlaneNums(replaceLightNums(resolveIncludes(s), lights), { numClippingPlanes: 0, numClipIntersection: 0 }));

test('con K igual al número de luces de la escena, el sombreador final es el de three con otros arrays', () => {
  for (const name of ['standard', 'physical']) {
    const original = THREE.ShaderLib[name].fragmentShader;
    const sh = { fragmentShader: original, uniforms: {} };
    injectChunkLights(sh, 5, 11);
    const out = preprocess(sh.fragmentShader);
    // las únicas diferencias: las dos declaraciones, el nombre del array del que se lee cada luz y la guarda que solo
    // suma cada luz del fragmento donde llega (tarea 7): una por luz propia, ninguna en las direccionales
    const decl = '\n#if 5 > 0\nuniform PointLight uChunkPoint[5];\n#endif\n#if 11 > 0\nuniform SpotLight uChunkSpot[11];\n#endif';
    assert.equal(once(out, decl), 1);
    assert.equal(once(out, GUARDED), 5 + 11);
    assert.equal(once(out, RE_CALL), 5 + 11 + 2);
    const back = out.replace(decl, '').replaceAll(GUARDED, RE_CALL).replaceAll('uChunkPoint[', 'pointLights[').replaceAll('uChunkSpot[', 'spotLights[');
    assert.equal(back, preprocess(original));
    // bucles desenrollados: cada luz se lee una vez de su posición del array propio
    for (let i = 0; i < 5; i++) assert.equal(once(out, `pointLight = uChunkPoint[ ${i} ];`), 1);
    for (let i = 0; i < 11; i++) assert.equal(once(out, `spotLight = uChunkSpot[ ${i} ];`), 1);
    assert.equal(once(out, 'pointLights[ 0 ]'), 0);
    assert.equal(once(out, 'spotLights[ 0 ]'), 0);
    assert.equal(once(out, 'unroll_loop'), 0);
  }
});

test('con K menor que el de la escena, el bucle recorre solo las K luces propias', () => {
  const sh = { fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} };
  injectChunkLights(sh, 2, 0);
  const out = preprocess(sh.fragmentShader);
  assert.equal(once(out, 'pointLight = uChunkPoint[ 1 ];'), 1);
  assert.equal(once(out, 'pointLight = uChunkPoint[ 2 ];'), 0);
  assert.equal(once(out, 'spotLight = '), 0);
  assert.equal(once(out, 'getSpotLightInfo( spotLight'), 0);
  assert.equal(once(out, 'uChunkSpot'), 0);
  assert.equal(once(out, 'RE_Direct( directLight'), 2 + 2); // dos puntuales y las dos direccionales
});

const spotAt = (x, y, z, tx, ty, tz) => {
  const s = new THREE.SpotLight(0xffd2a0, 26, 15, 1.0, 0.65, 1.4);
  s.position.set(x, y, z);
  s.target.position.set(tx, ty, tz);
  s.updateMatrixWorld();
  s.target.updateMatrixWorld();
  return s;
};
const cameraAt = (x, y, z) => {
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 700);
  cam.position.set(x, y, z);
  cam.lookAt(1, 2, 3);
  cam.updateMatrixWorld();
  return cam;
};

test('sync da los mismos valores que WebGLLights de three, luz a luz y en el mismo orden', () => {
  const scene = new THREE.Scene();
  const p0 = new THREE.PointLight('#ffd8a0', 18, 20, 1.6);
  p0.position.set(60.3, 7.1, -19.7);
  const p1 = new THREE.PointLight('#ffc98c', 3.4, 5, 2);
  p1.position.set(-0.71, 2.33, 4.9);
  const g = new THREE.Group();
  g.position.set(-30, 0.4, 4);
  g.rotation.y = 0.37;
  const s0 = new THREE.SpotLight('#ffbd6e', 1.1 * 2.2, 28, 1.05, 0.7, 1.4);
  s0.position.set(0, 5.7, 0.3);
  s0.target.position.set(0, 0, -1.65);
  g.add(s0, s0.target);
  const s1 = spotAt(-58.2, 9, 14.1, -57, 0, 13); // diana dentro de la escena
  scene.add(p0, g, s1, s1.target, p1);
  scene.updateMatrixWorld();
  const cam = cameraAt(-12.25, 18.5, 41.75);

  // las operaciones de three, extraídas de su código: setup y setupView de WebGLLights
  const lightsSource = threeSource.match(/function WebGLLights\( extensions \) \{[\s\S]*?\n\treturn \{\n\t\tsetup: setup,\n\t\tsetupView: setupView,\n\t\tstate: state\n\t\};\n\n\}\n/)[0];
  const cacheSource = threeSource.match(/function UniformsCache\(\) \{[\s\S]*?\n\}\n/)[0];
  const shadowCacheSource = threeSource.match(/function ShadowUniformsCache\(\) \{[\s\S]*?\n\}\n/)[0];
  const WebGLLights = new Function('Vector3', 'Vector2', 'Color', 'Matrix4', 'RGFormat', 'UniformsLib', `let nextVersion = 0;\nfunction shadowCastingAndTexturingLightsFirst( lightA, lightB ) { return ( lightB.castShadow ? 2 : 0 ) - ( lightA.castShadow ? 2 : 0 ) + ( lightB.map ? 1 : 0 ) - ( lightA.map ? 1 : 0 ); }\n${cacheSource}\n${shadowCacheSource}\n${lightsSource}; return WebGLLights;`)(THREE.Vector3, THREE.Vector2, THREE.Color, THREE.Matrix4, THREE.RGFormat, THREE.UniformsLib);
  const three = new WebGLLights({ has: () => false });
  const sceneLights = [];
  scene.traverse((o) => o.isLight && sceneLights.push(o));
  three.setup(sceneLights);
  three.setupView(sceneLights, cam);

  const st = createChunkLightState([p0, p1], [s0, s1]);
  st.sync(cam, 7);
  const fields = (u) => Object.keys(u).sort().map((k) => [k, u[k].isVector3 || u[k].isColor ? u[k].toArray() : u[k]]);
  assert.equal(three.state.point.length, 2);
  assert.equal(three.state.spot.length, 2);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(fields(st.points[i]), fields(three.state.point[i]));
    assert.deepEqual(fields(st.spots[i]), fields(three.state.spot[i]));
  }
});

test('sync no repite el cálculo en el mismo fotograma y lo rehace en el siguiente', () => {
  const p = new THREE.PointLight('#ffffff', 2, 8, 2);
  p.position.set(1, 2, 3);
  p.updateMatrixWorld();
  const st = createChunkLightState([p], []);
  assert.equal(st.frame, -1);
  const cam = cameraAt(0, 0, 10);
  st.sync(cam, 4);
  const before = st.points[0].position.toArray();
  p.position.set(5, 5, 5);
  p.intensity = 3;
  p.updateMatrixWorld();
  st.sync(cam, 4);
  assert.deepEqual(st.points[0].position.toArray(), before);
  assert.equal(st.points[0].color.r, 2);
  st.sync(cam, 5);
  assert.notDeepEqual(st.points[0].position.toArray(), before);
  assert.equal(st.points[0].color.r, 3);
  assert.equal(st.frame, 5);
  // los objetos de uniforme son siempre los mismos (los clones los referencian)
  const u = st.points[0];
  st.sync(cam, 6);
  assert.equal(st.points[0], u);
});

test('createChunkLightState: guarda sus luces y rechaza las que proyectan sombra o llevan mapa', () => {
  const p = new THREE.PointLight();
  const s = new THREE.SpotLight();
  const st = createChunkLightState([p], [s]);
  assert.deepEqual(st.lights.points, [p]);
  assert.deepEqual(st.lights.spots, [s]);
  assert.equal(st.points.length, 1);
  assert.equal(st.spots.length, 1);
  const shadowed = new THREE.SpotLight();
  shadowed.castShadow = true;
  assert.throws(() => createChunkLightState([], [shadowed]), /sombra/);
  const mapped = new THREE.SpotLight();
  mapped.map = new THREE.Texture();
  assert.throws(() => createChunkLightState([], [mapped]), /mapa/);
  assert.throws(() => createChunkLightState([s], []), /PointLight/);
  assert.throws(() => createChunkLightState([], [p]), /SpotLight/);
});

const shaderFor = () => ({ vertexShader: '#include <common>\n', fragmentShader: '#include <common>\n#include <lights_pars_begin>\n#include <lights_fragment_begin>\n', uniforms: {} });

test('materialFor con estado: el clon encadena el compilador del original y después inyecta las luces', () => {
  const f = createMaterialFactory();
  const p = new THREE.PointLight();
  const s0 = new THREE.SpotLight();
  const s1 = new THREE.SpotLight();
  const st = createChunkLightState([p], [s0, s1]);
  const uplit = new THREE.MeshStandardMaterial();
  let sawBegin = null;
  const own = (sh) => {
    sawBegin = sh.fragmentShader.includes('#include <lights_fragment_begin>');
    sh.uniforms.uUp = { value: 1 };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n// propio');
  };
  uplit.onBeforeCompile = own;
  uplit.customProgramCacheKey = () => 'edgeUplit|cliff';
  const a = f.materialFor(uplit, 's2', 0, st);
  const sh = shaderFor();
  a.onBeforeCompile(sh, null);
  assert.equal(sawBegin, true); // el original ve el chunk sin tocar
  assert.equal(once(sh.fragmentShader, '// propio'), 1);
  assert.equal(once(sh.fragmentShader, 'uniform PointLight uChunkPoint[1];'), 1);
  assert.equal(once(sh.fragmentShader, 'uniform SpotLight uChunkSpot[2];'), 1);
  assert.equal(sh.uniforms.uUp.value, 1);
  assert.equal(sh.uniforms.uChunkPoint.value, st.points);
  assert.equal(sh.uniforms.uChunkSpot.value, st.spots);
  assert.equal(a.customProgramCacheKey(), 'edgeUplit|cliff|chunk|1|2');
  assert.deepEqual(a.userData.chunkLights, [p.uuid, s0.uuid, s1.uuid]);
  assert.equal(a.userData.chunk, 's2');
  assert.equal(a.userData.sortId, uplit.id);
  // el original no cambia
  assert.equal(uplit.onBeforeCompile, own);
  assert.equal(uplit.customProgramCacheKey(), 'edgeUplit|cliff');
  assert.deepEqual(uplit.userData, {});
  // misma terna, mismo clon; con otro estado para la misma terna, error
  assert.equal(f.materialFor(uplit, 's2', 0, st), a);
  assert.throws(() => f.materialFor(uplit, 's2', 0, createChunkLightState([p], [s0, s1])), /estado/);
});

test('materialFor con estado: sin compilador propio la clave solo depende de K y comparte programa', () => {
  const f = createMaterialFactory();
  const lights = createChunkLightState([new THREE.PointLight(), new THREE.PointLight()], [new THREE.SpotLight()]);
  const other = createChunkLightState([new THREE.PointLight(), new THREE.PointLight()], [new THREE.SpotLight()]);
  const plain = new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.2 });
  const a = f.materialFor(plain, 's1', 0, lights);
  const b = f.materialFor(plain, 's5', 0, other);
  assert.equal(a.customProgramCacheKey(), '|chunk|2|1');
  assert.equal(b.customProgramCacheKey(), a.customProgramCacheKey());
  assert.equal(a.isMeshPhysicalMaterial, true);
  assert.equal(a.opacity, 0.2);
  const sh = shaderFor();
  a.onBeforeCompile(sh, null);
  assert.equal(sh.uniforms.uChunkPoint.value, lights.points);
  const sh2 = shaderFor();
  b.onBeforeCompile(sh2, null);
  assert.equal(sh2.uniforms.uChunkPoint.value, other.points);
  assert.equal(sh2.fragmentShader, sh.fragmentShader); // misma clave, mismo texto
  // un compilador propio sin clave propia: la clave conserva su texto, como la de three
  const custom = new THREE.MeshStandardMaterial();
  custom.onBeforeCompile = (s) => s;
  assert.equal(f.materialFor(custom, 's1', 0, lights).customProgramCacheKey(), `${custom.onBeforeCompile.toString()}|chunk|2|1`);
  // sin luces en el fragmento: K = 0, sin arrays
  const none = createChunkLightState([], []);
  const c = f.materialFor(plain, 'agua-lejana', 0, none);
  const sh3 = shaderFor();
  c.onBeforeCompile(sh3, null);
  assert.equal(c.customProgramCacheKey(), '|chunk|0|0');
  assert.equal(once(sh3.fragmentShader, 'uChunk'), 0);
  assert.deepEqual(sh3.uniforms.uChunkPoint.value, []);
  assert.deepEqual(c.userData.chunkLights, []);
});

// ---------- Pruebas añadidas en la tarea 7 ----------

test('inyección: cada luz del fragmento solo se suma donde llega (directLight.visible); sol y direccionales, siempre', () => {
  const sh = base();
  injectChunkLights(sh, 1, 2);
  const f = sh.fragmentShader;
  // una guarda por bucle propio (antes de desenrollar), dentro de su bloque y detrás de leer la luz
  assert.equal(once(f, GUARDED), 2);
  const point = f.indexOf('pointLight = uChunkPoint[ i ];');
  const spot = f.indexOf('spotLight = uChunkSpot[ i ];');
  const sun = f.indexOf('#if ( NUM_SUN_LIGHTS > 0 )');
  assert.ok(point < f.indexOf(GUARDED) && f.indexOf(GUARDED) < spot);
  assert.ok(spot < f.lastIndexOf(GUARDED) && f.lastIndexOf(GUARDED) < sun);
  // las demás llamadas (sol, direccionales) quedan como en three
  assert.equal(once(f, RE_CALL), once(THREE.ShaderChunk.lights_fragment_begin, RE_CALL));
  assert.equal(once(f.slice(sun), GUARDED), 0);
  // sin luces de un tipo, su bloque y su guarda desaparecen
  const sp = base();
  injectChunkLights(sp, 0, 3);
  assert.equal(once(sp.fragmentShader, GUARDED), 1);
});
test('la guarda es la marca con la que three señala una luz que no aporta nada', () => {
  // getPointLightInfo y getSpotLightInfo ponen visible = ( color != vec3( 0.0 ) ), o false con color 0 fuera del cono
  const pars = THREE.ShaderChunk.lights_pars_begin;
  assert.equal(once(pars, 'light.visible = ( light.color != vec3( 0.0 ) );'), 2);
  assert.equal(once(pars, 'light.color = vec3( 0.0 );\n\t\t\tlight.visible = false;'), 1);
  // y todo lo que suma RE_Direct_Physical va multiplicado por la irradiancia (dotNL * color) o la del barniz
  // (dotNLcc * color): con color 0 suma ceros exactos (términos finitos), así que saltarse la llamada da la misma suma
  const physical = THREE.ShaderChunk.lights_physical_pars_fragment;
  const body = physical.slice(physical.indexOf('void RE_Direct_Physical'), physical.indexOf('void RE_IndirectDiffuse_Physical'));
  assert.equal(once(body, 'vec3 irradiance = dotNL * directLight.color;'), 1);
  assert.equal(once(body, 'vec3 ccIrradiance = dotNLcc * directLight.color;'), 1);
  const sums = body.split('\n').filter((l) => l.includes('+='));
  assert.ok(sums.length >= 4);
  for (const line of sums) assert.match(line, /\+= (cc)?[iI]rradiance \*/, line.trim());
  assert.equal(once(body, 'irradiance *='), 1); // el reparto de energía del brillo (sheen) también escala la irradiancia
});
