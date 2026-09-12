// Aquí vamos a guardar las tiendas una vez que lleguen del servidor
let tiendas = [];

// Pide las tiendas al servidor
async function cargarTiendas() {
 const respuesta = await fetch(`${URL_SERVIDOR}/api/tiendas`);
  tiendas = await respuesta.json();
}