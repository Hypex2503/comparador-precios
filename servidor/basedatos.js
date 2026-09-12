const Database = require("better-sqlite3");

const db = new Database("tienda.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS tiendas (
    id INTEGER PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    direccion TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS precios (
    id INTEGER PRIMARY KEY,
    producto_id INTEGER NOT NULL,
    tienda_clave TEXT NOT NULL,
    precio REAL NOT NULL,
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    FOREIGN KEY (tienda_clave) REFERENCES tiendas(clave)
  );

  CREATE TABLE IF NOT EXISTS solicitudes_borrado (
    id INTEGER PRIMARY KEY,
    tipo TEXT NOT NULL,
    referencia TEXT NOT NULL
  );
`);

function agregarColumnaSiNoExiste(tabla, definicionColumna) {
  try {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${definicionColumna}`);
    console.log(`Columna agregada a ${tabla}: ${definicionColumna}`);
  } catch (error) {
    if (!error.message.includes("duplicate column name")) {
      throw error;
    }
  }
}

agregarColumnaSiNoExiste("productos", "estado TEXT DEFAULT 'aprobado'");
agregarColumnaSiNoExiste("tiendas", "estado TEXT DEFAULT 'aprobado'");
agregarColumnaSiNoExiste("productos", "descripcion TEXT");
agregarColumnaSiNoExiste("productos", "marca TEXT");
agregarColumnaSiNoExiste("productos", "imagen TEXT");

const yaHayTiendas = db.prepare("SELECT COUNT(*) AS total FROM tiendas").get().total;

if (yaHayTiendas === 0) {
  console.log("Insertando datos de ejemplo por primera vez...");

  const insertarTienda = db.prepare(
    "INSERT INTO tiendas (clave, nombre, direccion, lat, lng, estado) VALUES (?, ?, ?, ?, ?, 'aprobado')"
  );
  insertarTienda.run("TiendaA", "TiendaA - Centro", "Calle 60 con 55, Centro, Mérida, Yuc.", 20.9674, -89.6237);
  insertarTienda.run("TiendaB", "TiendaB - Norte", "Av. Prolongación Montejo, Mérida, Yuc.", 21.0154, -89.6167);
  insertarTienda.run("TiendaC", "TiendaC - Altabrisa", "Calle 21 x 30, Altabrisa, Mérida, Yuc.", 21.0075, -89.5804);

  const insertarProducto = db.prepare("INSERT INTO productos (nombre, estado) VALUES (?, 'aprobado')");
  const idAudifonos = insertarProducto.run("Audífonos Bluetooth").lastInsertRowid;
  const idMouse = insertarProducto.run("Mouse Inalámbrico").lastInsertRowid;
  const idTeclado = insertarProducto.run("Teclado Mecánico").lastInsertRowid;

  const insertarPrecio = db.prepare(
    "INSERT INTO precios (producto_id, tienda_clave, precio) VALUES (?, ?, ?)"
  );
  insertarPrecio.run(idAudifonos, "TiendaA", 450);
  insertarPrecio.run(idAudifonos, "TiendaB", 399);
  insertarPrecio.run(idAudifonos, "TiendaC", 420);

  insertarPrecio.run(idMouse, "TiendaA", 199);
  insertarPrecio.run(idMouse, "TiendaB", 210);
  insertarPrecio.run(idMouse, "TiendaC", 189);

  insertarPrecio.run(idTeclado, "TiendaA", 899);
  insertarPrecio.run(idTeclado, "TiendaB", 950);
  insertarPrecio.run(idTeclado, "TiendaC", 875);

  console.log("Datos de ejemplo insertados.");
}

module.exports = db;