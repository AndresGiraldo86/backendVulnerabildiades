import { useState } from "react";

function App() {
  const [url, setUrl] = useState("");
  const [vulnerabilidades, setVulnerabilidades] = useState([]);
  const [historial, setHistorial] = useState([]); // <--- Estado para el historial
  const [vista, setVista] = useState("escaneo"); // 'escaneo' o 'historial'
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // URL de tu backend
  const BACKEND_URL = "https://8000-firebase-scan-vulnes-1767823093448.cluster-f73ibkkuije66wssuontdtbx6q.cloudworkstations.dev";

  const escanear = async () => {
    setError("");
    setCargando(true);
    setVulnerabilidades([]);
    setVista("escaneo");

    try {
      const res = await fetch(`${BACKEND_URL}/scan-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (data.status === "ok") {
        setVulnerabilidades(data.vulnerabilities);
      } else {
        setError("Error del backend: " + (data.message || "Desconocido"));
      }
    } catch (e) {
      console.error(e);
      setError("Error de conexión. Revisa que el backend esté activo.");
    } finally {
      setCargando(false);
    }
  };

  // Función para obtener el historial
  const cargarHistorial = async () => {
    setVista("historial");
    setCargando(true);
    try {
      const res = await fetch(`${BACKEND_URL}/history`);
      const data = await res.json();
      setHistorial(data); // Guardamos los datos recibidos
    } catch (e) {
      console.error(e);
      setError("No se pudo cargar el historial");
    } finally {
      setCargando(false);
    }
  };

  const severidadColor = (nivel) => {
    switch (nivel) {
      case "critical": return "bg-red-700 text-white";
      case "high": return "bg-red-500 text-white";
      case "medium": return "bg-orange-400 text-white";
      case "low": return "bg-yellow-300 text-black";
      default: return "bg-gray-300 text-black";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans text-gray-800">
      <h1 className="text-3xl font-bold mb-6 text-center text-blue-900">🛡️ Escáner de Vulnerabilidades Pro</h1>

      {/* BARRA DE CONTROL */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-col md:flex-row gap-4 items-center justify-between border border-gray-200">
        <div className="flex gap-2 w-full md:w-2/3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL Objetivo (ej: http://testphp.vulnweb.com)"
            className="border border-gray-300 px-4 py-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={escanear}
            disabled={cargando}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 font-bold transition"
          >
            {cargando && vista === 'escaneo' ? "Escaneando..." : "🚀 Escanear"}
          </button>
        </div>

        {/* BOTÓN DE HISTORIAL */}
        <button
          onClick={cargarHistorial}
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 font-bold transition flex items-center gap-2"
        >
          📜 Ver Historial
        </button>
      </div>

      {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">{error}</div>}

      {/* VISTA: RESULTADOS DEL ESCANEO ACTUAL */}
      {vista === "escaneo" && vulnerabilidades.length > 0 && (
        <div className="animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Resultados Actuales ({vulnerabilidades.length})</h2>
            <button
            onClick={async () => {
              try {
                alert("Generando PDF... (Esto puede tardar unos segundos)"); 
                const res = await fetch(`${BACKEND_URL}/scan-pdf`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ url: url, vulnerabilities: vulnerabilidades }),
                });
                if (!res.ok) throw new Error("Fallo al generar PDF");
                const blob = await res.blob();
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `reporte_scan.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              } catch (err) {
                console.error(err);
                alert("Error descargando PDF: " + err.message);
              }
            }}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold shadow-lg"
          >
            📄 Descargar PDF
          </button>
          </div>
          
          <div className="overflow-hidden rounded-lg shadow-lg border border-gray-200">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="py-3 px-4 text-left">Severidad</th>
                  <th className="py-3 px-4 text-left">Nombre</th>
                  <th className="py-3 px-4 text-left">Ubicación / Detalle</th>
                </tr>
              </thead>
              <tbody>
                {vulnerabilidades.map((vuln, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50 transition">
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${severidadColor(vuln.severity)}`}>
                        {vuln.severity}
                      </span>
                    </td>
                    <td className="p-3 font-medium">{vuln.name}</td>
                    <td className="p-3 text-sm text-gray-600 font-mono">{vuln.matchedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA: HISTORIAL DE ESCANEOS */}
      {vista === "historial" && (
        <div className="animate-fade-in">
          <h2 className="text-2xl font-semibold mb-4 text-purple-800">📂 Historial de Escaneos</h2>
          {historial.length === 0 ? (
            <p className="text-gray-500">No hay historial guardado aún.</p>
          ) : (
            <div className="overflow-hidden rounded-lg shadow-lg border border-gray-200 bg-white">
              <table className="min-w-full">
                <thead className="bg-purple-700 text-white">
                  <tr>
                    <th className="py-3 px-4 text-left">ID</th>
                    <th className="py-3 px-4 text-left">Fecha (UTC)</th>
                    <th className="py-3 px-4 text-left">URL Analizada</th>
                    <th className="py-3 px-4 text-center">Hallazgos</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-purple-50 transition">
                      <td className="p-3 font-bold text-gray-500">#{item.id}</td>
                      <td className="p-3 text-sm">{new Date(item.scan_date).toLocaleString()}</td>
                      <td className="p-3 text-blue-600 font-medium">{item.url}</td>
                      <td className="p-3 text-center">
                        <span className="bg-gray-200 text-gray-800 py-1 px-3 rounded-full text-xs font-bold">
                          {item.vulnerabilities_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;