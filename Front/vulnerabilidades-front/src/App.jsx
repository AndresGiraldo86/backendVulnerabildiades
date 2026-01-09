import { useState } from "react";

function App() {
  const [url, setUrl] = useState("");
  const [vulnerabilidades, setVulnerabilidades] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // Tu URL del backend (la tomé de tu código anterior)
  const BACKEND_URL = "https://8000-firebase-scan-vulnes-1767823093448.cluster-f73ibkkuije66wssuontdtbx6q.cloudworkstations.dev";

  const escanear = async () => {
    setError("");
    setCargando(true);
    setVulnerabilidades([]);

    try {
      console.log("🚀 Intentando conectar a:", `${BACKEND_URL}/scan-json`);
      
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
    <div className="p-6 max-w-7xl mx-auto">
    <h1 className="text-3xl font-bold mb-4">🔍 Escáner de Vulnerabilidades</h1>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Ingresa una URL (ej: http://testphp.vulnweb.com)"
          className="border px-3 py-2 w-full rounded"
        />
        <button
          onClick={escanear}
          disabled={cargando}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {cargando ? "Escaneando..." : "Escanear"}
        </button>
      </div>

      {cargando && <p className="text-blue-600 animate-pulse">⏳ Ejecutando Nuclei...</p>}
      {error && <p className="text-red-600 font-bold">{error}</p>}

      {vulnerabilidades.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Resultados ({vulnerabilidades.length})</h2>
          
          <div className="overflow-auto max-h-[500px] border border-gray-300 rounded mb-4">
            <table className="min-w-full table-auto">
              <thead className="sticky top-0 bg-gray-200">
                <tr>
                  <th className="p-2 border">Severidad</th>
                  <th className="p-2 border">Nombre</th>
                  <th className="p-2 border">Ubicación</th>
              </tr>
              </thead>
              <tbody>
                {vulnerabilidades.map((vuln, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className={`p-2 border font-bold text-center ${severidadColor(vuln.severity)}`}>
                      {vuln.severity}
                    </td>
                    <td className="p-2 border">{vuln.name}</td>
                    <td className="p-2 border text-xs">{vuln.matchedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* BOTÓN CORREGIDO CON LA SOLUCIÓN */}
          <button
            onClick={async () => {
              try {
                alert("Generando PDF... (Esto puede tardar unos segundos)"); 
                
                const res = await fetch(`${BACKEND_URL}/scan-pdf`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ 
                    url: url, 
                    vulnerabilities: vulnerabilidades // <--- ¡AQUÍ ESTÁ LA CORRECCIÓN!
                  }),
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
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold"
          >
            📄 Descargar PDF
          </button>
        </div>
      )}
    </div>
  );
}

  export default App;