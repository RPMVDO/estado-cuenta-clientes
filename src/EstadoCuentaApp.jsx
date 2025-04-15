import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbzxYNLUYa8Q1dstm-WP7r5hUIOAeOW_KAGI8x4WbzSRJ5AVoCODTJs7Fp14xFekowigdA/exec";

const TABS = ["Todas", "> 30 días", "< 30 días", "Pagadas", "Adeudadas"];

export default function EstadoCuentaERP() {
  const [facturas, setFacturas] = useState([]);
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [tabActiva, setTabActiva] = useState("Todas");

  useEffect(() => {
    fetch(GOOGLE_SHEET_API_URL)
      .then((res) => res.json())
      .then((data) => {
        const adaptadas = data.map((row) => ({
          fecha: row["FECHA"] || "",
          nroFactura: row["FACTURA"] || "",
          importe: parseFloat((row["IMPORTE"] || "0").toString().replace(/[^0-9.-]+/g, "")),
          cliente: row["CLIENTE"] || "",
          condicion: row["CONDICION"] || "",
          recibo: row["RECIBO"] || "",
          vencimiento: row["VENCIMIENTO"] || "",
          estado: row["DEBE"] || ""
        }));
        setFacturas(adaptadas);
      });
  }, []);

  const filtrarFacturas = () => {
    const hoy = new Date();
    return facturas.filter((f) => {
      const cumpleCliente = f.cliente.toLowerCase().includes(clienteFiltro.toLowerCase());
      const fechaFactura = new Date(f.fecha);
      const dias = (hoy - fechaFactura) / (1000 * 60 * 60 * 24);

      switch (tabActiva) {
        case "> 30 días":
          return cumpleCliente && dias > 30;
        case "< 30 días":
          return cumpleCliente && dias <= 30;
        case "Pagadas":
          return cumpleCliente && f.estado?.toUpperCase() === "PAGADO";
        case "Adeudadas":
          return cumpleCliente && ["DEBE", "IMPAGO"].includes(f.estado?.toUpperCase());
        default:
          return cumpleCliente;
      }
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Estado de Cuenta ERP</h1>

      <input
        type="text"
        placeholder="Buscar cliente..."
        className="border px-4 py-2 rounded w-full mb-4"
        value={clienteFiltro}
        onChange={(e) => setClienteFiltro(e.target.value)}
      />

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 rounded ${
              tabActiva === tab ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setTabActiva(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {filtrarFacturas().length === 0 ? (
        <p className="text-gray-500 text-center">No hay facturas para mostrar.</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">Fecha</th>
                <th className="p-2 border">Factura</th>
                <th className="p-2 border">Cliente</th>
                <th className="p-2 border">Importe</th>
                <th className="p-2 border">Condición</th>
                <th className="p-2 border">Vencimiento</th>
                <th className="p-2 border">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrarFacturas().map((f, idx) => (
                <tr key={idx} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 border">{f.fecha}</td>
                  <td className="p-2 border">{f.nroFactura}</td>
                  <td className="p-2 border">{f.cliente}</td>
                  <td className="p-2 border">${f.importe.toFixed(2)}</td>
                  <td className="p-2 border">{f.condicion}</td>
                  <td className="p-2 border">{f.vencimiento}</td>
                  <td className={`p-2 border font-semibold ${
                    f.estado?.toUpperCase() === "PAGADO"
                      ? "text-green-600"
                      : ["DEBE", "IMPAGO"].includes(f.estado?.toUpperCase())
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}>
                    {f.estado || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
