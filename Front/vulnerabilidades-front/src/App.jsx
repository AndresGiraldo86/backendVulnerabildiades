import { useState, useEffect } from "react";

function App() {
  const [url, setUrl] = useState("");
  const [vulnerabilidades, setVulnerabilidades] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [vista, setVista] = useState("escaneo");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  
  // ESTADOS NUEVOS PARA LA BARRA DE PROGRESO VISUAL
  const [progreso, setProgreso] = useState(0);
  const [mensajeEstado, setMensajeEstado] = useState("Iniciando...");

  const BACKEND_URL = "https://8000-firebase-scan-vulnes-1767823093448.cluster-f73ibkkuije66wssuontdtbx6q.cloudworkstations.dev";

  // EFECTO SIMULADO DE BARRA DE CARGA
  useEffect(() => {
    let intervalo;
    if (cargando) {
      setProgreso(10);
      setMensajeEstado("🚀 Iniciando motores de Nuclei...");
      
      intervalo = setInterval(() => {
        setProgreso((old) => {
          // Truco: Avanza rápido al principio, lento al final, nunca llega a 100 solo
          if (old < 30) {
             setMensajeEstado("🔍 Resolviendo DNS y conectando...");
             return old + 5; 
          }
          if (old < 60) {
             setMensajeEstado("💣 Ejecutando pruebas de vulnerabilidad...");
             return old + 2;
          }
          if (old < 90) {
             setMensajeEstado("📊 Analizando resultados y clasificando...");
             return old + 0.5;
          }
          return old; // Se queda esperando en 90%
        });
      }, 800);
    } else {
      setProgreso(100);
      setMensajeEstado("✅ ¡Análisis completado!");
    }
    return () => clearInterval(intervalo);
  }, [cargando]);

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
      setCargando(false); // Esto hará que la barra salte al 100%
    }
  };

  const cargarHistorial = async () => {
    setVista("historial");
    // Pequeño truco visual para cargar historial
    setCargando(true);
    try {
      const res = await fetch(`${BACKEND_URL}/history`);
      const data = await res.json();
      setHistorial(data);
    } catch (e) {
      console.error(e);
      setError("No se pudo cargar el historial");
    } finally {
      setCargando(false);
    }
  };

  const severidadColor = (nivel) => {
    switch (nivel) {
      case "critical": return "bg-red-600 text-white ring-red-300";
      case "high": return "bg-orange-500 text-white ring-orange-300";
      case "medium": return "bg-yellow-500 text-white ring-yellow-300";
      case "low": return "bg-blue-400 text-white ring-blue-200";
      default: return "bg-gray-400 text-white ring-gray-200";
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            🛡️ Escáner de Vulnerabilidades <span className="text-blue-600">Pro</span>
          </h1>
          <p className="text-slate-500">Auditoría de seguridad automatizada con tecnología Nuclei</p>
        </div>

        {/* PANEL DE CONTROL */}
        <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 border border-slate-100">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full flex gap-3">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400">🌐</span>
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Ingresa URL (ej: http://testphp.vulnweb.com)"
                  className="pl-10 border border-gray-300 px-4 py-3 w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm"
                />
              </div>
              <button
                onClick={escanear}
                disabled={cargando}
                className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition transform active:scale-95 ${
                  cargando ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30"
                }`}
              >
                {cargando ? "Analizando..." : "🚀 Escanear"}
              </button>
            </div>

            <div className="w-full md:w-auto border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-4">
               <button
                onClick={cargarHistorial}
                className="w-full bg-white border-2 border-purple-100 text-purple-700 px-6 py-3 rounded-xl hover:bg-purple-50 font-bold transition flex items-center justify-center gap-2"
              >
                📜 Ver Historial
              </button>
            </div>
          </div>

          {/* BARRA DE PROGRESO MEJORADA */}
          {cargando && (
            <div className="mt-6 animate-fade-in">
              <div className="flex justify-between text-sm font-medium text-slate-600 mb-1">
                <span>{mensajeEstado}</span>
                <span>{Math.round(progreso)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300 ease-out relative"
                  style={{ width: `${progreso}%` }}
                >
                   {/* Efecto de brillo en la barra */}
                   <div className="absolute top-0 left-0 bottom-0 right-0 bg-white opacity-20 w-full animate-pulse"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r-lg shadow-sm flex items-center gap-3">
             <span>⚠️</span> {error}
          </div>
        )}

        {/* VISTA: RESULTADOS */}
        {vista === "escaneo" && vulnerabilidades.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                 <h2 className="text-xl font-bold text-slate-800">Resultados del Análisis</h2>
                 <p className="text-sm text-slate-500 mt-1">Se encontraron {vulnerabilidades.length} hallazgos</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    alert("Generando PDF... 📄"); 
                    const res = await fetch(`${BACKEND_URL}/scan-pdf`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url: url, vulnerabilities: vulnerabilidades }),
                    });
                    if (!res.ok) throw new Error("Fallo al generar");
                    const blob = await res.blob();
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = `reporte_scan.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  } catch (err) {
                    alert("Error PDF: " + err.message);
                  }
                }}
                className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 font-bold shadow-md hover:shadow-green-500/20 transition flex items-center gap-2 text-sm"
              >
                📥 Descargar PDF
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="py-4 px-6 text-left">Severidad</th>
                    <th className="py-4 px-6 text-left">Vulnerabilidad</th>
                    <th className="py-4 px-6 text-left">Ubicación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vulnerabilidades.map((vuln, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition">
                      <td className="py-4 px-6">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ring-1 ring-inset ${severidadColor(vuln.severity)}`}>
                          {vuln.severity}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-800">{vuln.name}</td>
                      <td className="py-4 px-6 text-sm text-slate-500 font-mono bg-slate-50/50 rounded">{vuln.matchedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA: HISTORIAL */}
        {vista === "historial" && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 bg-purple-50">
              <h2 className="text-xl font-bold text-purple-900">📂 Historial de Escaneos</h2>
            </div>
            {historial.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <p>No hay historial guardado aún.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-purple-100 text-purple-900 uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="py-4 px-6 text-left">ID</th>
                      <th className="py-4 px-6 text-left">Fecha</th>
                      <th className="py-4 px-6 text-left">URL</th>
                      <th className="py-4 px-6 text-center">Hallazgos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50">
                    {historial.map((item) => (
                      <tr key={item.id} className="hover:bg-purple-50/30 transition">
                        <td className="py-4 px-6 font-bold text-slate-400">#{item.id}</td>
                        <td className="py-4 px-6 text-sm text-slate-600">{new Date(item.scan_date).toLocaleString()}</td>
                        <td className="py-4 px-6 text-blue-600 font-medium">{item.url}</td>
                        <td className="py-4 px-6 text-center">
                          <span className="bg-slate-200 text-slate-700 py-1 px-3 rounded-full text-xs font-bold">
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
    </div>
  );
}

export default App;