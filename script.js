const API_URL = "https://script.google.com/macros/s/AKfycbyZkkf8mP_rUNVNcFbPNbuN4oN4Xu2UH6s46oEkSHvFCA0PCx0DIvGBFbBzCVAxrQ2A/exec";

let isAdmin = false;
let tokenSesion = ""; // Token temporal que devuelve el servidor al iniciar sesión
let network = null;
let nodoActual = null; 
let todosLosGallos = [];
let datosCargados = false; // false mientras la base de datos aún se está cargando

// ==========================================
// INICIALIZACIÓN (Carga silenciosa al abrir)
// ==========================================
window.onload = async () => {
  try {
    const response = await fetch(API_URL + "?accion=obtener");
    todosLosGallos = await response.json();
  } catch (error) { console.error("Error cargando base de datos", error); }
  finally {
    datosCargados = true;
    const cargando = document.getElementById('cargando');
    if(cargando) cargando.classList.add('oculto');
    // Si el usuario ya está en una vista de datos, la refrescamos
    if(!document.getElementById('vista-lista').classList.contains('oculto')) renderizarLista(todosLosGallos, 'contenedor-lista');
    if(!document.getElementById('vista-arbol').classList.contains('oculto')) dibujarNodos();
    if(!document.getElementById('vista-buscar').classList.contains('oculto')) filtrarBusqueda();
  }
};

async function recargarDatosDesdeAPI() {
  const response = await fetch(API_URL + "?accion=obtener");
  todosLosGallos = await response.json();
}

async function enviarPeticion(datos) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(datos)
    });
    return await response.json();
  } catch (error) { return { mensaje: "Error de conexión." }; }
}

// ==========================================
// NAVEGACIÓN TIPO APP (SPA)
// ==========================================
function mostrarVista(vistaId, tituloStr) {
  document.querySelectorAll('.vista').forEach(v => v.classList.add('oculto'));
  document.getElementById(vistaId).classList.remove('oculto');
  
  document.getElementById('header-titulo').innerText = tituloStr;
  document.getElementById('btn-back').classList.remove('oculto');

  if (vistaId === 'vista-arbol') dibujarNodos();
  if (vistaId === 'vista-lista') renderizarLista(todosLosGallos, 'contenedor-lista');
  if (vistaId === 'vista-buscar') {
    document.getElementById('inputBuscar').value = "";
    document.getElementById('resultados-busqueda').innerHTML = "";
    document.getElementById('inputBuscar').focus();
  }
}

function irInicio() {
  document.querySelectorAll('.vista').forEach(v => v.classList.add('oculto'));
  document.getElementById('vista-inicio').classList.remove('oculto');
  document.getElementById('header-titulo').innerText = "Genealogía";
  document.getElementById('btn-back').classList.add('oculto');
}

// ==========================================
// NOMBRE A MOSTRAR (deriva de los padres si no tiene nombre)
// Formato: "Papá-Mamá"  (izquierda = padre, derecha = madre)
// Si un ancestro sin nombre se usa como componente, su guion se quita
// para que el único guion sea el que separa padre de madre en esa generación.
// ==========================================
function tieneNombreReal(g) {
  const n = (g && g.nombre ? String(g.nombre) : "").trim();
  return n !== "" && n.toLowerCase() !== "sin nombre";
}

function quitarGuion(texto) {
  // El guion interno se reemplaza por un espacio (RojoBlanca -> Rojo Blanca)
  return String(texto).replace(/-/g, " ").trim();
}

function nombreDerivado(g, esComponente, visitados) {
  if(!g) return "?";
  if(tieneNombreReal(g)) return String(g.nombre).trim();

  visitados = visitados || new Set();
  if(visitados.has(String(g.placa))) return String(g.placa); // corta ciclos
  visitados.add(String(g.placa));

  const padreObj = buscarGallo(g.padre);
  const madreObj = buscarGallo(g.madre);
  const hayPadre = padreObj || (g.padre && g.padre !== "undefined" && String(g.padre).trim() !== "");
  const hayMadre = madreObj || (g.madre && g.madre !== "undefined" && String(g.madre).trim() !== "");

  if(hayPadre || hayMadre) {
    const parteP = padreObj ? quitarGuion(nombreDerivado(padreObj, true, visitados)) : (hayPadre ? String(g.padre) : "?");
    const parteM = madreObj ? quitarGuion(nombreDerivado(madreObj, true, visitados)) : (hayMadre ? String(g.madre) : "?");
    return parteP + "-" + parteM;
  }
  // Sin nombre y sin padres: como componente usamos la placa; suelto, "Sin nombre".
  return esComponente ? String(g.placa) : "Sin nombre";
}

function nombreParaMostrar(g) {
  return nombreDerivado(g, false, new Set());
}

// ==========================================
// LISTAS Y BÚSQUEDAS
// ==========================================
function renderizarLista(arrayGallos, contenedorId) {
  const contenedor = document.getElementById(contenedorId);
  contenedor.innerHTML = "";
  
  if(arrayGallos.length === 0) {
    const msg = datosCargados ? "No hay registros." : "Cargando base de datos…";
    contenedor.innerHTML = `<p style='text-align:center; color:#86868b; margin-top:20px;'>${msg}</p>`;
    return;
  }

  arrayGallos.forEach(g => {
    const div = document.createElement('div');
    div.className = "list-item";
    const claseBadge = g.sexo === "Gallina" ? "gallina" : (g.sexo === "Gallo" ? "gallo" : "");
    
    div.innerHTML = `
      <div class="list-item-info">
        <span class="list-item-title">Placa: ${g.placa}</span>
        <span class="list-item-sub">${nombreParaMostrar(g)}</span>
      </div>
      <span class="badge ${claseBadge}">${g.sexo}</span>
    `;
    div.onclick = () => abrirModalNodo(g.placa);
    contenedor.appendChild(div);
  });
}

function filtrarBusqueda() {
  const texto = document.getElementById('inputBuscar').value.toLowerCase();
  if (texto === "") {
    document.getElementById('resultados-busqueda').innerHTML = "";
    return;
  }
  const filtrados = todosLosGallos.filter(g =>
    String(g.placa).toLowerCase().includes(texto) ||
    (g.nombre && String(g.nombre).toLowerCase().includes(texto)) ||
    nombreParaMostrar(g).toLowerCase().includes(texto)
  );
  renderizarLista(filtrados, 'resultados-busqueda');
}

// ==========================================
// SEGURIDAD
// ==========================================
function mostrarLogin() { document.getElementById('modal-login').classList.remove('oculto'); }
function cerrarModal(id) { document.getElementById(id).classList.add('oculto'); }

async function iniciarSesion() {
  const pass = document.getElementById('inputPassword').value;
  document.getElementById('mensaje-login').innerText = "Verificando...";
  const resultado = await enviarPeticion({ accion: "login", password: pass });

  if(resultado.valido) {
    isAdmin = true; tokenSesion = resultado.token;
    cerrarModal('modal-login');
    document.getElementById('inputPassword').value = '';
    document.getElementById('mensaje-login').innerText = '';
    document.getElementById('btn-login-header').classList.add('oculto');
    document.getElementById('btn-logout').classList.remove('oculto');
    document.querySelectorAll('.admin-solo').forEach(el => el.classList.remove('oculto'));
  } else {
    document.getElementById('mensaje-login').innerText = "Contraseña incorrecta";
  }
}

// Si el servidor avisa que la sesión venció, cerramos y pedimos clave de nuevo
function manejarSesionExpirada(mensaje) {
  if(mensaje && mensaje.toLowerCase().includes("sesión")) {
    cerrarSesion();
    mostrarLogin();
  }
}

function cerrarSesion() {
  isAdmin = false; tokenSesion = "";
  document.getElementById('btn-login-header').classList.remove('oculto');
  document.getElementById('btn-logout').classList.add('oculto');
  document.querySelectorAll('.admin-solo').forEach(el => el.classList.add('oculto'));
  
  // Limpiamos formularios y volvemos al inicio
  prepararNuevoRegistro();
  irInicio();
}

// ==========================================
// ÁRBOL VIS.JS
// ==========================================
function dibujarNodos() {
  const nodos = []; const conexiones = [];
  todosLosGallos.forEach(g => {
    let colorBg = g.sexo === "Gallina" ? "#ffe5ec" : (g.sexo === "Gallo" ? "#e5f0ff" : "#f0f0f5");
    let colorBorder = g.sexo === "Gallina" ? "#ffb3c6" : (g.sexo === "Gallo" ? "#b3d4ff" : "#d2d2d7");
    
    nodos.push({
      id: g.placa, label: `Placa ${g.placa}\n${nombreParaMostrar(g)}`,
      shape: "box", margin: 14,
      widthConstraint: { maximum: 150 }, // nombres largos bajan de línea, no ensanchan
      color: { background: colorBg, border: colorBorder, highlight: { background: "#fff", border: "#0071e3" } },
      font: { face: "-apple-system, sans-serif", color: "#1d1d1f", size: 14 },
      shapeProperties: { borderRadius: 12 }
    });
    
    if (g.padre && g.padre !== "undefined" && g.padre !== "") conexiones.push({ from: g.padre, to: g.placa, arrows: "to", color: {color: "#c7c7cc"} });
    if (g.madre && g.madre !== "undefined" && g.madre !== "") conexiones.push({ from: g.madre, to: g.placa, arrows: "to", color: {color: "#c7c7cc"} });
  });

  const contenedor = document.getElementById("red-nodos");
  if (network !== null) network.destroy();
  network = new vis.Network(contenedor, { nodes: nodos, edges: conexiones }, {
    layout: { hierarchical: { direction: "UD", sortMethod: "directed", levelSeparation: 140, nodeSpacing: 220, blockShifting: true, parentCentralization: true } },
    interaction: { hover: true },
    edges: { smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.5 } }
  });

  network.on("click", function (params) {
    if (params.nodes.length > 0) abrirModalNodo(params.nodes[0]);
  });
}

// ==========================================
// CRUD Y DETALLES
// ==========================================
async function guardarFormulario() {
  const placasInput = document.getElementById("inputPlacas").value;
  if(!placasInput) return;

  const modo = document.getElementById("inputModo").value;
  // Limpiamos placas: quitamos espacios y descartamos vacías (comas sobrantes)
  const placas = placasInput.split(",").map(p => p.trim()).filter(p => p !== "");

  if(placas.length === 0) {
    document.getElementById("mensaje-estado").innerText = "Debes ingresar al menos una placa.";
    return;
  }

  // No permitir placas duplicadas dentro del mismo formulario
  const setPlacas = new Set(placas.map(p => p.toLowerCase()));
  if(setPlacas.size !== placas.length) {
    document.getElementById("mensaje-estado").innerText = "Hay placas repetidas en el formulario.";
    return;
  }

  // Al AGREGAR: no permitir placas que ya existan en la base de datos
  if(modo === "agregar") {
    const existentes = placas.filter(p =>
      todosLosGallos.some(g => String(g.placa).toLowerCase() === p.toLowerCase())
    );
    if(existentes.length > 0) {
      document.getElementById("mensaje-estado").innerText =
        `La placa ${existentes.join(", ")} ya existe. Usa otra.`;
      return;
    }
  }

  document.getElementById("mensaje-estado").innerText = "Guardando...";

  const datosForm = {
    modo: modo,
    placas: placas,
    nombre: document.getElementById("inputNombre").value,
    sexo: document.getElementById("selectSexo").value,
    padre: document.getElementById("inputPadre").value.trim(),
    madre: document.getElementById("inputMadre").value.trim(),
    fecha: document.getElementById("inputFecha").value
  };

  const resultado = await enviarPeticion({ accion: "guardar", token: tokenSesion, datos: datosForm });

  if(resultado.mensaje && resultado.mensaje.includes("✅")) {
    await recargarDatosDesdeAPI(); // Actualizar caché
    prepararNuevoRegistro(); // Limpiamos la pantalla
    alert("¡Guardado correctamente!");
    irInicio(); // Volvemos al inicio
  } else {
    document.getElementById("mensaje-estado").innerText = resultado.mensaje || "No se pudo guardar. Intenta de nuevo.";
    manejarSesionExpirada(resultado.mensaje);
  }
}

async function eliminarNodoSeleccionado() {
  if(confirm(`¿Estás seguro de que quieres eliminar al gallo placa ${nodoActual.placa}?`)) {
    cerrarModal('modal-nodo');
    const resultado = await enviarPeticion({ accion: "borrar", token: tokenSesion, placa: nodoActual.placa });
    if(resultado.mensaje && resultado.mensaje.includes("✅")) {
        await recargarDatosDesdeAPI();
        alert("Eliminado correctamente.");
        if(!document.getElementById('vista-lista').classList.contains('oculto')) mostrarVista('vista-lista', 'Directorio');
        if(!document.getElementById('vista-arbol').classList.contains('oculto')) dibujarNodos();
        if(!document.getElementById('vista-buscar').classList.contains('oculto')) filtrarBusqueda();
    } else {
        alert(resultado.mensaje || "No se pudo eliminar.");
        manejarSesionExpirada(resultado.mensaje);
    }
  }
}

function buscarGallo(placa) {
  return todosLosGallos.find(g => String(g.placa) === String(placa));
}

function abrirModalNodo(placa) {
  nodoActual = buscarGallo(placa);
  if(!nodoActual) return;

  const infoHTML = `
    <b>Placa</b> ${nodoActual.placa}<br>
    <b>Nombre</b> ${nombreParaMostrar(nodoActual)}<br>
    <b>Sexo</b> ${nodoActual.sexo}<br>
    <b>Padres</b> ${nodoActual.padre || "N/A"} / ${nodoActual.madre || "N/A"}<br>
    <b>Nació</b> ${nodoActual.fechaNac ? new Date(nodoActual.fechaNac).toLocaleDateString('es-ES') : "Sin registro"}
  `;
  document.getElementById('modal-info').innerHTML = infoHTML;
  document.getElementById('modal-nodo').classList.remove('oculto');

  // Árboles de antecedentes y descendientes
  const antecedentes = [];
  recolectarAntecedentes(nodoActual.placa, antecedentes, new Set());
  dibujarMiniArbol('mini-antecedentes', antecedentes, nodoActual, 'ant');

  const descendientes = [];
  recolectarDescendientes(nodoActual.placa, descendientes, new Set());
  dibujarMiniArbol('mini-descendientes', descendientes, nodoActual, 'desc');
}

// ==========================================
// MINI-ÁRBOLES (Antecedentes / Descendientes)
// ==========================================
let redAntecedentes = null;
let redDescendientes = null;

function estiloNodoGallo(g, resaltar) {
  const colorBg = g.sexo === "Gallina" ? "#ffe5ec" : (g.sexo === "Gallo" ? "#e5f0ff" : "#f0f0f5");
  const colorBorder = g.sexo === "Gallina" ? "#ffb3c6" : (g.sexo === "Gallo" ? "#b3d4ff" : "#d2d2d7");
  return {
    id: String(g.placa),
    label: `Placa ${g.placa}\n${nombreParaMostrar(g)}`,
    shape: "box", margin: 12,
    widthConstraint: { maximum: 130 }, // evita cajas anchas con nombres largos
    borderWidth: resaltar ? 3 : 1,
    color: {
      background: resaltar ? "#fff7d6" : colorBg,
      border: resaltar ? "#ffcc00" : colorBorder,
      highlight: { background: "#fff", border: "#0071e3" }
    },
    font: { face: "-apple-system, sans-serif", color: "#1d1d1f", size: 13 },
    shapeProperties: { borderRadius: 10 }
  };
}

// Sube por la línea padre/madre recolectando ancestros (sin duplicar ni ciclar)
function recolectarAntecedentes(placa, acumulado, visitados) {
  const g = buscarGallo(placa);
  if(!g) return;
  [g.padre, g.madre].forEach(pp => {
    if(pp && pp !== "undefined" && String(pp) !== "" && !visitados.has(String(pp))) {
      const ancestro = buscarGallo(pp);
      if(ancestro) {
        visitados.add(String(pp));
        acumulado.push(ancestro);
        recolectarAntecedentes(pp, acumulado, visitados);
      }
    }
  });
}

// Baja recolectando todos los que tienen a este como padre o madre
function recolectarDescendientes(placa, acumulado, visitados) {
  todosLosGallos.forEach(g => {
    const esHijo = String(g.padre) === String(placa) || String(g.madre) === String(placa);
    if(esHijo && !visitados.has(String(g.placa))) {
      visitados.add(String(g.placa));
      acumulado.push(g);
      recolectarDescendientes(g.placa, acumulado, visitados);
    }
  });
}

function dibujarMiniArbol(contenedorId, relacionados, galloCentro, tipo) {
  const contenedor = document.getElementById(contenedorId);

  // Destruimos la red anterior para no acumular
  if(tipo === 'ant' && redAntecedentes) { redAntecedentes.destroy(); redAntecedentes = null; }
  if(tipo === 'desc' && redDescendientes) { redDescendientes.destroy(); redDescendientes = null; }

  if(relacionados.length === 0) {
    contenedor.classList.add('vacio');
    contenedor.innerHTML = tipo === 'ant' ? "Sin antecedentes registrados" : "Sin descendientes registrados";
    return;
  }
  contenedor.classList.remove('vacio');
  contenedor.innerHTML = "";

  const conjunto = [galloCentro, ...relacionados];
  const idsSet = new Set(conjunto.map(g => String(g.placa)));

  const nodos = conjunto.map(g => estiloNodoGallo(g, String(g.placa) === String(galloCentro.placa)));
  const edges = [];
  conjunto.forEach(g => {
    [g.padre, g.madre].forEach(pp => {
      if(pp && idsSet.has(String(pp))) {
        edges.push({ from: String(pp), to: String(g.placa), arrows: "to", color: { color: "#c7c7cc" } });
      }
    });
  });

  const red = new vis.Network(contenedor, { nodes: nodos, edges: edges }, {
    layout: { hierarchical: { direction: "UD", sortMethod: "directed", levelSeparation: 100, nodeSpacing: 170, blockShifting: true, parentCentralization: true } },
    interaction: { hover: false, dragNodes: false },
    physics: false,
    edges: { smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.5 } }
  });

  // Al tocar otro nodo del mini-árbol, abrimos ese gallo
  red.on("click", function (params) {
    if(params.nodes.length > 0) abrirModalNodo(params.nodes[0]);
  });

  if(tipo === 'ant') redAntecedentes = red; else redDescendientes = red;
}

// === EL FIX: FUNCIÓN PARA LIMPIAR ANTES DE AGREGAR ===
function prepararNuevoRegistro() {
  // Limpiamos variables y habilitamos campos
  document.getElementById('inputModo').value = "agregar";
  document.getElementById('inputPlacas').disabled = false;
  document.getElementById('btn-cancelar').classList.add('oculto');
  document.getElementById('mensaje-estado').innerText = "";
  
  // Vaciamos los inputs (el contenedor real es #vista-formulario, no .panel-formulario)
  document.querySelectorAll('#vista-formulario input:not([type="hidden"])').forEach(input => input.value = '');
  document.getElementById('selectSexo').value = 'Gallo';
  
  // Abrimos la vista con el título correcto
  mostrarVista('vista-formulario', 'Nuevo Registro');
}

function prepararEdicion() {
  mostrarVista('vista-formulario', 'Editar Registro');
  document.getElementById('inputModo').value = "editar";
  document.getElementById('inputPlacas').value = nodoActual.placa;
  document.getElementById('inputPlacas').disabled = true; // Bloqueamos la placa para no alterar el árbol
  document.getElementById('inputNombre').value = nodoActual.nombre || '';
  document.getElementById('selectSexo').value = nodoActual.sexo || 'Gallo';
  document.getElementById('inputPadre').value = nodoActual.padre || '';
  document.getElementById('inputMadre').value = nodoActual.madre || '';
  if(nodoActual.fechaNac) {
    const f = new Date(nodoActual.fechaNac);
    document.getElementById('inputFecha').value = f.toISOString().split('T')[0];
  } else {
    document.getElementById('inputFecha').value = '';
  }
  document.getElementById('mensaje-estado').innerText = '';
  document.getElementById('btn-cancelar').classList.remove('oculto');
  cerrarModal('modal-nodo');
}

function cancelarEdicion() {
  prepararNuevoRegistro(); // Aprovechamos la función nueva para limpiar todo
  irInicio(); // Y volvemos
}