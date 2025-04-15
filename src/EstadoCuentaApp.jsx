import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

const API_PROXY_URL = "/api/marcarPagada"; // proxy para evitar CORS
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbybaSy-ZVcNJjbmQtUhAQlj9OOCysx4AV2rvsAPzuAxHFHZFkwd5z0gxh7JOiBNDgo3KQ/exec";

const TABS = [
  { name: "Todas", icon: "📋" },
  { name: "> 30 días", icon: "⏰" },
  { name: "< 30 días", icon: "🗓️" },
  { name: "Pagadas", icon: "✅" },
  { name: "Adeudadas", icon: "⚠️" }
];

export default function EstadoCuentaERP() {
  const [facturas, setFacturas] = useState([]);
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [tabActiva, setTabActiva] = useState("Todas");

  const formatearFecha = (str) => {
    if (!str) return "";
    const d = new Date(str);
    if (isNaN(d)) return str;
    const dd = d.getDate().toString().padStart(2, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const yy = d.getFullYear().toString().slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  useEffect(() => {
    fetch(GOOGLE_SHEET_API_URL)
      .then((res) => res.json())
      .then((data) => {
        const hoy = new Date();
        const adaptadas = data.map((row, index) => {
          const cliente = typeof row["CLIENTE"] === "string" ? row["CLIENTE"] : "";
          const fechaRaw = row["FECHA"] || "";
          const vencimientoRaw = row["VENCIMIENTO"] || "";
          const dias = (hoy - new Date(fechaRaw)) / (1000 * 60 * 60 * 24);
          const debe = row["DEBE"]?.toUpperCase();

          let estado = "PAGADO";
          if (debe === "SI") estado = "IMPAGO";
          else if (debe === "NO") estado = "PENDIENTE";

          return {
            id: index,
            fecha: formatearFecha(fechaRaw),
            nroFactura: row["FACTURA"] || "",
            importe: parseFloat((row["IMPORTE"] || "0").toString().replace(/[^0-9.-]+/g, "")),
            cliente,
            condicion: row["CONDICION"] || "",
            recibo: row["RECIBO"] || "",
            vencimiento: formatearFecha(vencimientoRaw),
            estado,
            dias,
            debe
          };
        });
        setFacturas(adaptadas);
      });
  }, []);

  const marcarComoPagada = (factura) => {
    console.log("🟢 Click en botón Marcar como pagada:", factura);
    const nuevaFactura = { ...factura, estado: "PAGADO", debe: "" };
    fetch(API_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevaFactura)
    })
      .then((res) => res.text())
      .then((res) => {
        console.log("🔄 Respuesta del servidor:", res);
        setFacturas((prev) =>
          prev.map((f) => (f.id === factura.id ? { ...f, estado: "PAGADO", debe: "" } : f))
        );
      })
      .catch((err) => console.error("❌ Error al marcar como pagada:", err));
  };

  const filtrarFacturas = () => {
    return facturas.filter((f) => {
      const cliente = typeof f.cliente === "string" ? f.cliente : "";
      const cumpleCliente = cliente.toLowerCase().includes(clienteFiltro.toLowerCase());

      switch (tabActiva) {
        case "> 30 días":
          return cumpleCliente && f.dias > 30;
        case "< 30 días":
          return cumpleCliente && f.dias <= 30;
        case "Pagadas":
          return cumpleCliente && f.estado === "PAGADO";
        case "Adeudadas":
          return cumpleCliente && (f.estado === "IMPAGO" || f.estado === "PENDIENTE");
        default:
          return cumpleCliente;
      }
    });
  };

  const getEstadoColor = (estado) => {
    if (estado === "PAGADO") return "text-green-500";
    if (estado === "PENDIENTE") return "text-yellow-500";
    if (estado === "IMPAGO") return "text-red-500";
    return "text-gray-500";
  };

  const facturasFiltradas = filtrarFacturas();
  const totalPorEstado = facturasFiltradas.reduce((acc, f) => {
    acc[f.estado] = (acc[f.estado] || 0) + f.importe;
    return acc;
  }, {});

  const agrupadasPorCliente = clienteFiltro
    ? {
        pagadas: facturas.filter(
          (f) => f.cliente.toLowerCase().includes(clienteFiltro.toLowerCase()) && f.estado === "PAGADO"
        ),
        adeudadas: facturas.filter(
          (f) => f.cliente.toLowerCase().includes(clienteFiltro.toLowerCase()) && (f.estado === "IMPAGO" || f.estado === "PENDIENTE")
        )
      }
    : null;

  return (
    <div className="flex bg-gray-100 min-h-screen font-sans">
      <aside className="w-64 bg-white border-r shadow-md p-6">
        <h2 className="text-xl font-bold text-blue-700 mb-6">📊 ERP Panel</h2>
        <nav className="space-y-2">
          {TABS.map(({ name, icon }) => (
            <button
              key={name}
              className={`block w-full text-left px-4 py-2 rounded-md font-medium flex items-center gap-2 ${
                tabActiva === name ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
              }`}
              onClick={() => setTabActiva(name)}
            >
              <span>{icon}</span> {name}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-10">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">Estado de Cuenta</h1>
        </header>

        <div className="mb-6">
          <input
            type="text"
            placeholder="🔍 Buscar cliente..."
            className="w-full px-4 py-2 text-sm rounded-md border shadow-sm focus:ring-2 focus:ring-blue-300 outline-none"
            value={clienteFiltro}
            onChange={(e) => setClienteFiltro(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {Object.entries(totalPorEstado).map(([estado, total]) => (
            <div
              key={estado}
              className={`p-4 rounded-lg shadow-md ${
                estado === "PAGADO"
                  ? "bg-green-100 text-green-800"
                  : estado === "IMPAGO"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              <div className="text-xs uppercase font-semibold tracking-wide">{estado}</div>
              <div className="text-xl font-bold mt-1">${total.toFixed(2)}</div>
            </div>
          ))}
        </div>

        {agrupadasPorCliente ? (
          <>
            <Section title="Facturas Pagadas">
              <TablaFacturas data={agrupadasPorCliente.pagadas} getEstadoColor={getEstadoColor} onMarcarPagada={marcarComoPagada} />
            </Section>
            <Section title="Facturas Adeudadas">
              <TablaFacturas data={agrupadasPorCliente.adeudadas} getEstadoColor={getEstadoColor} onMarcarPagada={marcarComoPagada} />
            </Section>
          </>
        ) : (
          <Section>
            <TablaFacturas data={facturasFiltradas} getEstadoColor={getEstadoColor} onMarcarPagada={marcarComoPagada} />
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-12">
      {title && <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">{title}</h2>}
      {children}
    </section>
  );
}

function TablaFacturas({ data, getEstadoColor, onMarcarPagada }) {
  return (
    <div className="overflow-x-auto bg-white rounded-md shadow-md">
      <table className="min-w-full text-sm">
        <thead className="bg-blue-50 text-blue-700">
          <tr>
            <th className="px-4 py-3 text-left">Fecha</th>
            <th className="px-4 py-3 text-left">Factura</th>
            <th className="px-4 py-3 text-left">Cliente</th>
            <th className="px-4 py-3 text-left">Importe</th>
            <th className="px-4 py-3 text-left">Condición</th>
            <th className="px-4 py-3 text-left">Vencimiento</th>
            <th className="px-4 py-3 text-left">Estado</th>
            <th className="px-4 py-3 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((f, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-2 whitespace-nowrap">{f.fecha}</td>
              <td className="px-4 py-2 whitespace-nowrap">{f.nroFactura}</td>
              <td className="px-4 py-2 whitespace-nowrap">{f.cliente}</td>
              <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-800">${f.importe.toFixed(2)}</td>
              <td className="px-4 py-2 whitespace-nowrap">{f.condicion}</td>
              <td className="px-4 py-2 whitespace-nowrap">{f.vencimiento}</td>
              <td className={`px-4 py-2 whitespace-nowrap font-semibold ${getEstadoColor(f.estado)}`}>{f.estado || "-"}</td>
              <td className="px-4 py-2 whitespace-nowrap">
                {f.estado !== "PAGADO" && (
                  <button
                    onClick={() => onMarcarPagada(f)}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-xs"
                  >
                    Marcar como pagada
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

