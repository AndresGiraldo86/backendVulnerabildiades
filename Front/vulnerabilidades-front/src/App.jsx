import { useState } from "react";

function App() {
  const [url, setUrl] = useState("");
  const [vulnerabilidades, setVulnerabilidades] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const escanear = async () => {
    setError("");
    setCargando(true);
    setVulnerabilidades([]);

    try {
      const res = await fetch("http://127.0.0.1:8000/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (data.status === "ok") {
        setVulnerabilidades(data.vulnerabilities);
      } else {
        setError("Error al procesar la respuesta del backend.");
      }
    } catch (e) {
      setError("Hubo un error al hacer el escaneo");
    } finally {
      setCargando(false);
    }
  };

  const severidadColor = (nivel) => {
    switch (nivel) {
      case "critical":
        return "bg-red-700 text-white";
      case "high":
        return "bg-red-500 text-white";
      case "medium":
        return "bg-orange-400 text-white";
      case "low":
        return "bg-yellow-300 text-black";
      default:
        return "bg-gray-300 text-black";
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
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Escanear
        </button>
      </div>

      {cargando && <p className="text-blue-600">⏳ Escaneando...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {vulnerabilidades.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">
            Resultados ({vulnerabilidades.length})
          </h2>
          <div className="overflow-auto">
            <table className="min-w-full table-auto border border-gray-300">
              <thead>
                <tr className="bg-gray-200">
                  <th className="p-2 border">Nombre</th>
                  <th className="p-2 border">Severidad</th>
                  <th className="p-2 border">Ubicación</th>
                  <th className="p-2 border">Descripción</th>
                  <th className="p-2 border">Referencias</th>
                </tr>
              </thead>
              <tbody>
                {vulnerabilidades.map((vuln, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-2 border">{vuln.name || "N/A"}</td>
                    <td className={`p-2 border font-semibold text-center ${severidadColor(vuln.severity)}`}>
                      {vuln.severity || "info"}
                    </td>
                    <td className="p-2 border">{vuln.matchedAt}</td>
                    <td className="p-2 border text-sm">{vuln.description || "Sin descripción"}</td>
                    <td className="p-2 border text-sm">
                      {vuln.reference && vuln.reference.length > 0 ? (
                        <ul className="list-disc pl-4">
                          {vuln.reference.map((ref, i) => (
                            <li key={i}>
                              <a href={ref} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                {ref}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "N/A"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
