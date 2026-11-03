/* Motor del sitio estatico de Infinity Glass.
   Ejecuta la misma logica que el lienzo de diseno fuera de la plataforma:
   resuelve los huecos {{...}}, repite <sc-for>, decide <sc-if>, engancha los
   onClick y vuelve a dibujar cuando cambia el estado. Solo cubre lo que usan
   estas pantallas: no pretende ser un framework. */
(function () {
  'use strict';

  var PAGINAS = {
    'Main.dc.html': 'index.html',
    'Producto.dc.html': 'producto.html',
    'ProductoNuevo.dc.html': 'producto-nuevo.html',
    'ProductoMovil.dc.html': 'producto-movil.html',
    'Tienda.dc.html': 'catalogo.html',
    'Accesorios.dc.html': 'accesorios.html',
    'Carrito.dc.html': 'carrito.html',
    'Nosotros.dc.html': 'nosotros.html'
  };

  var BANDERAS = ['igNav', 'igAnim', '__igHero', '__igMirada', '__igVuelo',
                  '__igGiro360', '__igPausaPulso', '__igBusca'];

  // ---------- resolver {{ruta.con.puntos}} ----------
  function valorDe(ruta, ambito) {
    ruta = String(ruta).trim();
    if (ruta === 'true') return true;
    if (ruta === 'false') return false;
    var partes = ruta.split('.'), v = ambito;
    for (var i = 0; i < partes.length; i++) {
      if (v === null || v === undefined) return undefined;
      v = v[partes[i]];
    }
    return v;
  }
  function hueco(texto, ambito) {
    return String(texto).replace(/\{\{([^}]+)\}\}/g, function (_, r) {
      var v = valorDe(r, ambito);
      if (v === undefined || v === null || typeof v === 'function') return '';
      return String(v);
    });
  }
  function huecoUnico(texto, ambito) {       // devuelve el valor crudo, sin pasar a texto
    var m = /^\s*\{\{([^}]+)\}\}\s*$/.exec(texto);
    return m ? valorDe(m[1], ambito) : undefined;
  }

  var EVENTOS = { onclick: 'click', onchange: 'change', oninput: 'input',
                  onsubmit: 'submit', onkeydown: 'keydown' };

  /* Atributos booleanos de HTML: lo que cuenta es si estan puestos, no su
     valor. Dejar checked="false" marcaria la casilla igual, asi que cuando
     el hueco da falso hay que quitar el atributo entero. */
  var BOOLEANOS = { checked: 1, disabled: 1, selected: 1, readonly: 1,
                    required: 1, multiple: 1, hidden: 1, open: 1, autofocus: 1 };

  function procesar(nodo, ambito) {
    var hijos = Array.prototype.slice.call(nodo.childNodes);
    for (var i = 0; i < hijos.length; i++) {
      var n = hijos[i];

      if (n.nodeType === 3) {                                  // texto
        if (n.nodeValue.indexOf('{{') >= 0) n.nodeValue = hueco(n.nodeValue, ambito);
        continue;
      }
      if (n.nodeType !== 1) continue;
      var etiqueta = n.tagName.toLowerCase();

      if (etiqueta === 'sc-for') {
        var lista = huecoUnico(n.getAttribute('list') || '', ambito) || [];
        var alias = n.getAttribute('as') || 'item';
        var salida = document.createDocumentFragment();
        for (var k = 0; k < lista.length; k++) {
          var copia = n.cloneNode(true);
          var sub = Object.create(ambito);
          sub[alias] = lista[k];
          procesar(copia, sub);
          while (copia.firstChild) salida.appendChild(copia.firstChild);
        }
        n.parentNode.replaceChild(salida, n);
        continue;
      }

      if (etiqueta === 'sc-if') {
        if (huecoUnico(n.getAttribute('value') || '', ambito)) {
          procesar(n, ambito);
          var trozo = document.createDocumentFragment();
          while (n.firstChild) trozo.appendChild(n.firstChild);
          n.parentNode.replaceChild(trozo, n);
        } else {
          n.parentNode.removeChild(n);
        }
        continue;
      }

      var attrs = Array.prototype.slice.call(n.attributes);
      for (var a = 0; a < attrs.length; a++) {
        var nombre = attrs[a].name, valor = attrs[a].value;
        var evento = EVENTOS[nombre.toLowerCase()];
        if (evento) {
          var fn = huecoUnico(valor, ambito);
          n.removeAttribute(nombre);
          if (typeof fn === 'function') {
            if (evento === 'change' && n.type === 'range') evento = 'input';
            n.addEventListener(evento, fn);
          }
          continue;
        }
        if (BOOLEANOS[nombre.toLowerCase()] && valor.indexOf('{{') >= 0) {
          var crudo = huecoUnico(valor, ambito);
          var puesto = crudo === undefined ? hueco(valor, ambito) : crudo;
          if (!puesto || puesto === 'false') n.removeAttribute(nombre);
          else n.setAttribute(nombre, '');
          continue;
        }
        if (valor.indexOf('{{') >= 0) n.setAttribute(nombre, hueco(valor, ambito));
      }
      procesar(n, ambito);
    }
  }

  // Los enlaces del lienzo apuntan a *.dc.html; aca son paginas sueltas.
  // Tambien el formulario del buscador, que manda al catalogo con ?q=.
  function cambiar(el, attr) {
    var h = el.getAttribute(attr) || '';
    var corte = h.indexOf('#');
    var base = corte >= 0 ? h.slice(0, corte) : h;
    if (PAGINAS[base]) el.setAttribute(attr, PAGINAS[base] + (corte >= 0 ? h.slice(corte) : ''));
  }
  function enlazar(raiz) {
    var enlaces = raiz.querySelectorAll('a[href]');
    for (var i = 0; i < enlaces.length; i++) cambiar(enlaces[i], 'href');
    var formularios = raiz.querySelectorAll('form[action]');
    for (var f = 0; f < formularios.length; f++) cambiar(formularios[f], 'action');
  }

  // ---------- base de los componentes ----------
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (parcial) {
    var nuevo = typeof parcial === 'function' ? parcial(this.state) : parcial;
    for (var k in nuevo) if (Object.prototype.hasOwnProperty.call(nuevo, k)) this.state[k] = nuevo[k];
    if (window.__igPintar) window.__igPintar();
  };
  window.DCLogic = DCLogic;

  /* Los modulos de interaccion (cabecera, visor 360, vuelo al carrito...) se
     escribieron para correr una sola vez sobre nodos que no cambian. Aca el
     dibujo se rehace entero, asi que hay que reengancharlos — y quitar antes
     los listeners que dejaron en window/document, o se irian acumulando. */
  function rastrear(fn) {
    var previos = window.__igOyentes || [];
    for (var i = 0; i < previos.length; i++) {
      try { previos[i][0].removeEventListener(previos[i][1], previos[i][2], previos[i][3]); } catch (e) {}
    }
    var nuevos = [];
    var oWin = window.addEventListener, oDoc = document.addEventListener;
    window.addEventListener = function (t, h, o) { nuevos.push([window, t, h, o]); return oWin.call(window, t, h, o); };
    document.addEventListener = function (t, h, o) { nuevos.push([document, t, h, o]); return oDoc.call(document, t, h, o); };
    var r;
    try { r = fn(); }
    finally {
      window.addEventListener = oWin;
      document.addEventListener = oDoc;
      window.__igOyentes = nuevos;
    }
    return r;
  }

  function reenganchar(comp, metodos) {
    rastrear(function () {
      if (window.igNav && window.igNav.destruir) { try { window.igNav.destruir(); } catch (e) {} }
      for (var b = 0; b < BANDERAS.length; b++) window[BANDERAS[b]] = undefined;
      for (var m = 0; m < metodos.length; m++) {
        if (typeof comp[metodos[m]] === 'function') {
          try { comp[metodos[m]](); } catch (e) { console.warn('modulo', metodos[m], e); }
        }
      }
    });
  }

  // ---------- carga inicial ----------
  /* Las fotos fuera de la cabecera se piden cuando se van a ver y no todas
     de golpe al abrir: asi no le quitan ancho de banda a las fuentes ni al
     banner. Se marca sobre la copia de la plantilla, antes de meterla en la
     pagina, porque una <img> empieza a descargarse apenas entra al documento. */
  function diferirImagenes(fragmento) {
    var imgs = fragmento.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (img.hasAttribute('loading') || img.closest('.ign')) continue;
      img.setAttribute('loading', 'lazy');
    }
  }

  /* El cargador (cargador.css) se va cuando la primera pantalla esta
     completa: fuentes listas e imagenes visibles descargadas. Nunca espera
     mas de MAX_ESPERA; con conexion lenta es mejor mostrar la pagina
     mientras termina que dejar al visitante mirando un anillo. */
  var MAX_ESPERA = 2500;
  function quitarCargador(raiz) {
    var hecho = false;
    function listo() {
      if (hecho) return;
      hecho = true;
      requestAnimationFrame(function () {
        document.documentElement.classList.add('ig-listo');
      });
    }
    setTimeout(listo, MAX_ESPERA);

    var esperas = [];
    if (document.fonts && document.fonts.load) {
      ['400', '600', '700', '800'].forEach(function (peso) {
        esperas.push(document.fonts.load(peso + ' 1em "Plus Jakarta Sans"').catch(function () {}));
      });
    }
    var alto = window.innerHeight || 800;
    var imgs = raiz.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.complete) continue;
      var caja = img.getBoundingClientRect();
      if (caja.bottom < 0 || caja.top > alto || !caja.width) continue;   // no se ve de entrada
      esperas.push(new Promise(function (ok) {
        img.addEventListener('load', ok, { once: true });
        img.addEventListener('error', ok, { once: true });
      }));
    }
    Promise.all(esperas).then(listo, listo);
  }

  // ---------- ciclo de dibujo ----------
  window.__igArrancar = function (Componente, metodos) {
    var plantilla = document.getElementById('ig-plantilla');
    var raiz = document.getElementById('ig-raiz');
    var comp = rastrear(function () { return new Componente({}); });
    var pendiente = false;

    function pintar() {
      var vals = comp.renderVals ? comp.renderVals() : {};
      var copia = plantilla.content.cloneNode(true);
      procesar(copia, vals);
      diferirImagenes(copia);
      raiz.textContent = '';
      raiz.appendChild(copia);
      enlazar(raiz);
      reenganchar(comp, metodos || []);
      document.documentElement.setAttribute(
        'data-tema-raiz', (raiz.firstElementChild && raiz.firstElementChild.getAttribute('data-tema')) || 'claro');
    }
    window.__igPintar = function () {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () { pendiente = false; pintar(); });
    };
    pintar();
    quitarCargador(raiz);
  };
})();
