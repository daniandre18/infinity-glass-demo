/* El iPhone del banner, en 3D de verdad.
   Lo que se ve de entrada es el telefono dibujado con CSS: aparece al
   instante y no cuesta nada. Este modulo carga el modelo aparte y, cuando
   esta listo, lo cambia con un fundido. Si algo falla —sin WebGL, conexion
   limitada, el visitante pidio menos movimiento— el banner se queda con el
   telefono CSS y nadie se entera.

   montar() se puede llamar las veces que haga falta: la pantalla se vuelve a
   dibujar entera cada vez que cambia el estado (tema, favoritos, carrusel) y
   el lienzo se pierde con ella. El modelo ya descargado se guarda aqui y se
   reaprovecha, asi que volver a montarlo no cuesta otra descarga. */

/* De donde salen los tres archivos. Por defecto, junto a este modulo; el
   lienzo de diseno sirve sus archivos por otra ruta y los pasa al montar. */
let rutas = {
  tres: new URL('./tres.min.js', import.meta.url).href,
  modelo: new URL('./iphone.glb', import.meta.url).href,
  datos: new URL('./iphone-datos.js', import.meta.url).href
};

let modulo = null;      // three.js, una sola vez
let equipo = null;      // el modelo ya cargado
let bajando = null;     // la descarga en curso: se guarda la promesa, no el
                        // resultado, o dos montajes a la vez bajan el archivo dos veces
let vivo = null;        // lo que haya montado ahora mismo

function noConviene(escena) {
  if (!escena || !document.getElementById('igFono')) return true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  const con = navigator.connection;
  if (con && (con.saveData || /^(slow-)?2g$/.test(con.effectiveType || ''))) return true;
  if (navigator.deviceMemory && navigator.deviceMemory < 2) return true;
  try {
    const c = document.createElement('canvas');
    if (!(c.getContext('webgl2') || c.getContext('webgl'))) return true;
  } catch (e) { return true; }
  return false;
}

export function montar(donde) {
  if (donde) rutas = Object.assign({}, rutas, donde);
  const caja = document.getElementById('igEscena');
  if (!caja || caja.querySelector('canvas')) return;     // ya esta puesto
  if (noConviene(caja)) return;
  if (vivo) { vivo.soltar(); vivo = null; }

  // No se descarga nada hasta que el banner esta a la vista.
  const vigia = new IntersectionObserver((e) => {
    if (!e[0].isIntersecting) return;
    vigia.disconnect();
    dibujar(caja).catch((err) => console.warn('3D del banner:', err));
  }, { rootMargin: '200px' });
  vigia.observe(caja);
}

async function dibujar(caja) {
  const fono = document.getElementById('igFono');
  if (!caja.isConnected || caja.querySelector('canvas')) return;

  if (!modulo) modulo = await import(/* @vite-ignore */ rutas.tres);
  const T = modulo;

  if (!equipo) {
    if (!bajando) {
      const cargador = new T.GLTFLoader().setMeshoptDecoder(T.MeshoptDecoder);
      bajando = (rutas.modelo
        ? new Promise((listo, falla) => cargador.load(rutas.modelo, listo, undefined, falla))
        : Promise.reject()
      ).catch(async () => {
        /* Hay sitios que no sirven archivos .glb: ahi se usa la copia escrita
           como texto dentro de un modulo, que si es un tipo conocido. */
        const { modeloEnTexto } = await import(/* @vite-ignore */ rutas.datos);
        const crudo = atob(modeloEnTexto);
        const bytes = new Uint8Array(crudo.length);
        for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
        return new Promise((listo, falla) =>
          cargador.parse(bytes.buffer, '', listo, falla));
      });
    }
    const gltf = await bajando;
    if (!equipo) {
      equipo = gltf.scene;
      const limites = new T.Box3().setFromObject(equipo);
      equipo.userData.tam = limites.getSize(new T.Vector3());
      const centro = limites.getCenter(new T.Vector3());
      equipo.position.sub(centro);
      equipo.userData.baseY = equipo.position.y;
      /* Las ocho esquinas de la caja, ya centradas: con ellas se calcula
         cuanto hay que alejar la camara para que el equipo no se salga del
         recuadro en NINGUN angulo. */
      const e = [];
      for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
        e.push(new T.Vector3(sx * equipo.userData.tam.x, sy * equipo.userData.tam.y, sz * equipo.userData.tam.z));
      }
      equipo.userData.esquinas = e;
    }
  }
  if (!caja.isConnected || caja.querySelector('canvas')) return;   // se redibujo mientras cargaba

  const tam = equipo.userData.tam, baseY = equipo.userData.baseY;
  const TOPE_X = 34;                      // cuanto se deja inclinar, en grados

  const lienzo = document.createElement('canvas');
  lienzo.setAttribute('aria-hidden', 'true');
  Object.assign(lienzo.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    opacity: '0', transition: 'opacity .55s ease',
    pointerEvents: 'auto', cursor: 'grab',
    /* en el telefono, arrastrar de lado gira el equipo y arrastrar hacia
       arriba o abajo sigue haciendo scroll en la pagina */
    touchAction: 'pan-y'
  });
  caja.appendChild(lienzo);

  const render = new T.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  render.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  render.toneMapping = T.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.15;

  const escena = new T.Scene();
  const pmrem = new T.PMREMGenerator(render);
  escena.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;

  const camara = new T.PerspectiveCamera(26, 1, 0.01, 50);

  const clave = new T.DirectionalLight(0xffffff, 2.4);
  clave.position.set(1.4, 2.6, 2.2);
  const contra = new T.DirectionalLight(0x3f8cff, 1.7);   // filo azul, como el resto del banner
  contra.position.set(-2.2, 0.6, -1.4);
  escena.add(clave, contra, new T.AmbientLight(0x7fa6ff, 0.3), equipo);

  /* A que distancia poner la camara. No basta con encajar el equipo de frente:
     al inclinarlo, el extremo que se acerca crece por la perspectiva y se sale
     del recuadro (se veia cortado por abajo). Aca se prueban las ocho esquinas
     de la caja en todas las vueltas posibles y en los dos topes de inclinacion,
     y se toma la distancia que las deja a todas dentro con un margen. */
  const esquinas = equipo.userData.esquinas;
  const BORDE = 0.94;                     // deja un 6% de aire contra el borde
  const giro = new T.Matrix4(), angulos = new T.Euler();
  const punto = new T.Vector3();

  function distanciaSegura(proporcion) {
    const t = Math.tan((camara.fov * Math.PI / 180) / 2);
    let d = 0;
    for (let ry = 0; ry < 360; ry += 10) {
      for (const rx of [-TOPE_X, 0, TOPE_X]) {
        angulos.set(rx * Math.PI / 180, ry * Math.PI / 180, 0);
        giro.makeRotationFromEuler(angulos);
        for (let i = 0; i < esquinas.length; i++) {
          punto.copy(esquinas[i]).applyMatrix4(giro);
          d = Math.max(d,
            punto.z + Math.abs(punto.y) / (BORDE * t),
            punto.z + Math.abs(punto.x) / (BORDE * t * proporcion));
        }
      }
    }
    return d;
  }

  function encuadrar() {
    const c = caja.getBoundingClientRect();
    const ancho = Math.max(c.width, 1), alto = Math.max(c.height, 1);
    render.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    camara.position.set(0, 0, distanciaSegura(camara.aspect));
  }
  encuadrar();
  addEventListener('resize', encuadrar, { passive: true });

  /* El angulo lo sigue mandando el modulo del banner, que ya sabe girar el
     equipo con el scroll y seguir el cursor: aca solo se copia, asi el 3D
     hereda ese control en vez de repetirlo. */
  /* Giro a mano. Lo que mande el scroll sigue contando: el arrastre se le
     suma, asi el equipo no pega un salto cuando el visitante lo suelta y
     sigue bajando. El eje vertical se limita para que no se vuelque. */
  let manualY = 0, manualX = 0, velY = 0, velX = 0, arrastrando = false;
  let desdeX = 0, desdeY = 0;

  const tope = (v) => Math.max(-TOPE_X, Math.min(TOPE_X, v));

  lienzo.addEventListener('pointerdown', (e) => {
    arrastrando = true;
    desdeX = e.clientX; desdeY = e.clientY;
    velY = velX = 0;
    lienzo.style.cursor = 'grabbing';
    if (lienzo.setPointerCapture) { try { lienzo.setPointerCapture(e.pointerId); } catch (err) {} }
  });

  lienzo.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    velY = (e.clientX - desdeX) * 0.42;      // grados por pixel
    velX = (e.clientY - desdeY) * 0.26;
    desdeX = e.clientX; desdeY = e.clientY;
    manualY += velY;
    manualX = tope(manualX + velX);
  });

  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    lienzo.style.cursor = 'grab';
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  addEventListener('pointerup', soltar);

  // El rotulo del banner ya no dice solo "baja": ahora tambien se arrastra.
  const pista = document.querySelector('.ig-hero__pista');
  if (pista && pista.lastChild && pista.lastChild.nodeType === 3) {
    pista.lastChild.nodeValue = ' Arrástralo para girarlo, o baja y gira solo';
  }

  let aLaVista = true, cortado = false, anterior = 0;
  const mirando = new IntersectionObserver((e) => { aLaVista = e[0].isIntersecting; }, { threshold: 0 });
  mirando.observe(caja);
  const nacio = performance.now();

  function marco(t) {
    if (cortado) return;
    requestAnimationFrame(marco);
    if (!aLaVista || document.hidden) return;
    /* Mientras se arrastra o queda inercia se dibuja a todo lo que de el
       equipo; en reposo, 30 cuadros por segundo bastan y gastan la mitad. */
    const movido = arrastrando || Math.abs(velY) > 0.02 || Math.abs(velX) > 0.02;
    if (!movido && t - anterior < 32) return;
    anterior = t;

    if (!arrastrando) {                       // se va frenando sola al soltar
      if (Math.abs(velY) > 0.02) { manualY += velY; velY *= 0.93; } else velY = 0;
      if (Math.abs(velX) > 0.02) { manualX = tope(manualX + velX); velX *= 0.88; } else velX = 0;
    }

    const delScroll = typeof window.__igAngulo === 'number' ? window.__igAngulo : -18;
    equipo.rotation.y = (delScroll + manualY) * Math.PI / 180;
    equipo.rotation.x = manualX * Math.PI / 180;
    equipo.position.y = baseY + Math.sin((t - nacio) / 6000 * Math.PI * 2) * 0.006;  // el vaiven del CSS
    render.render(escena, camara);
  }
  requestAnimationFrame(marco);

  vivo = {
    soltar() {
      cortado = true;
      mirando.disconnect();
      removeEventListener('resize', encuadrar);
      removeEventListener('pointerup', soltar);
      escena.remove(equipo);            // el modelo se guarda para el proximo montaje
      pmrem.dispose();
      render.dispose();
      if (lienzo.parentNode) lienzo.parentNode.removeChild(lienzo);
    }
  };

  // Cambio: el CSS se apaga, el modelo se enciende.
  fono.style.transition = 'opacity .45s ease';
  fono.style.opacity = '0';
  lienzo.style.opacity = '1';
  setTimeout(() => { if (!cortado) fono.style.visibility = 'hidden'; }, 500);
  document.documentElement.dataset.fono3d = 'si';
}

montar();    // para quien lo cargue con una etiqueta <script type="module">
