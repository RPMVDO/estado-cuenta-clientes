import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbykCtKQrjZYzGXiIA6kLIeWs-OCS3C6JwT932CIWylVT93N9JWtYflbcO1Z96eyC29AqQ/exec";

const TABS = ["Todas", "> 30 días", "< 30 días", "Pagadas", "Adeudadas"];

export default function EstadoCuentaERP() {
  const [facturas, setFacturas] = useState([]);
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [tabActiva, setTabActiva] = useState("Todas");

  useEffect(() => {
    fetch(GOOGLE_SHEET_API_URL)
      .then((res) => res.json())
      .then((data) => {
        const hoy = new Date();
        const adaptadas = data.map((row) => {
          const cliente = typeof row["CLIENTE"] === "string" ? row["CLIENTE"] : "";
          const fecha = row["FECHA"] || "";
          const dias = (hoy - new Date(fecha)) / (1000 * 60 * 60 * 24);
          const debe = row["DEBE"]?.toUpperCase();

          let estado = "PAGADO";
          if (debe === "SI") {
            estado = "IMPAGO";
          } else if (debe === "NO") {
            estado = "PENDIENTE";
          }

          return {
            fecha,
            nroFactura: row["FACTURA"] || "",
            importe: parseFloat((row["IMPORTE"] || "0").toString().replace(/[^0-9.-]+/g, "")),
            cliente,
            condicion: row["CONDICION"] || "",
            recibo: row["RECIBO"] || "",
            vencimiento: row["VENCIMIENTO"] || "",
            estado,
            dias,
            debe
          };
        });
        setFacturas(adaptadas);
      });
  }, []);

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
  const totalPorEstado = facturasFiltradas.reduce(
    (acc, f) => {
      acc[f.estado] = (acc[f.estado] || 0) + f.importe;
      return acc;
    },
    {}
  );

  const agrupadasPorCliente = clienteFiltro
    ? {
        pagadas: facturas.filter((f) => f.cliente.toLowerCase().includes(clienteFiltro.toLowerCase()) && f.estado === "PAGADO"),
        adeudadas: facturas.filter((f) => f.cliente.toLowerCase().includes(clienteFiltro.toLowerCase()) && (f.estado === "IMPAGO" || f.estado === "PENDIENTE"))
      }
    : null;

  return (
    <div className="flex bg-gray-100 min-h-screen font-sans">
      <aside className="w-64 bg-white border-r shadow-md p-6">
        <h2 className="text-xl font-semibold text-blue-700 mb-6">🧾 ERP Panel</h2>
        <nav className="space-y-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`block w-full text-left px-4 py-2 rounded-md font-medium ${
                tabActiva === tab ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
              }`}
              onClick={() => setTabActiva(tab)}
            >
              {tab}
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
              <TablaFacturas data={agrupadasPorCliente.pagadas} getEstadoColor={getEstadoColor} />
            </Section>
            <Section title="Facturas Adeudadas">
              <TablaFacturas data={agrupadasPorCliente.adeudadas} getEstadoColor={getEstadoColor} />
            </Section>
          </>
        ) : (
          <Section>
            <TablaFacturas data={facturasFiltradas} getEstadoColor={getEstadoColor} />
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

function TablaFacturas({ data, getEstadoColor }) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
