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
    if (estado === "PAGADO") return "text-green-600";
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
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-semibold mb-8 text-blue-700">Estado de Cuenta ERP</h1>

      <input
        type="text"
        placeholder="Buscar cliente..."
        className="border px-4 py-3 rounded-xl w-full mb-6 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        value={clienteFiltro}
        onChange={(e) => setClienteFiltro(e.target.value)}
      />

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm ${
              tabActiva === tab ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => setTabActiva(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(totalPorEstado).map(([estado, total]) => (
          <div
            key={estado}
            className={`rounded-xl p-4 shadow border-l-4 ${
              estado === "PAGADO"
                ? "border-green-500 bg-green-50"
                : estado === "IMPAGO"
                ? "border-red-500 bg-red-50"
                : "border-yellow-500 bg-yellow-50"
            }`}
          >
            <div className="text-sm text-gray-600">{estado}</div>
            <div className="text-xl font-bold">${total.toFixed(2)}</div>
          </div>
        ))}
      </div>

      {agrupadasPorCliente ? (
        <>
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Pagadas</h2>
          <TablaFacturas data={agrupadasPorCliente.pagadas} getEstadoColor={getEstadoColor} />
          <h2 className="text-2xl font-semibold mt-10 mb-4 text-gray-800">Impagas</h2>
          <TablaFacturas data={agrupadasPorCliente.adeudadas} getEstadoColor={getEstadoColor} />
        </>
      ) : (
        <TablaFacturas data={facturasFiltradas} getEstadoColor={getEstadoColor} />
      )}
    </div>
  );
}

function TablaFacturas({ data, getEstadoColor }) {
  return (
    <div className="overflow-auto rounded-xl shadow border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 text-gray-700 text-left">
          <tr>
            <th className="p-3">Fecha</th>
            <th className="p-3">Factura</th>
            <th className="p-3">Cliente</th>
            <th className="p-3">Importe</th>
            <th className="p-3">Condición</th>
            <th className="p-3">Vencimiento</th>
            <th className="p-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {data.map((f, idx) => (
            <tr key={idx} className="border-t hover:bg-gray-50">
              <td className="p-3 whitespace-nowrap">{f.fecha}</td>
              <td className="p-3 whitespace-nowrap">{f.nroFactura}</td>
              <td className="p-3 whitespace-nowrap">{f.cliente}</td>
              <td className="p-3 whitespace-nowrap font-semibold">${f.importe.toFixed(2)}</td>
              <td className="p-3 whitespace-nowrap">{f.condicion}</td>
              <td className="p-3 whitespace-nowrap">{f.vencimiento}</td>
              <td className={`p-3 whitespace-nowrap font-semibold ${getEstadoColor(f.estado)}`}>{f.estado || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
