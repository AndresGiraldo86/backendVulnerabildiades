import os
import json
import asyncio
import shutil
import tempfile
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

app = FastAPI()

# CONFIGURACIÓN: Usar variables de entorno o rutas relativas
# Intenta buscar 'nuclei' en el sistema, si no, usa una ruta por defecto
NUCLEI_PATH = shutil.which("nuclei") or "/usr/local/bin/nuclei" 
# Es mejor usar una ruta relativa para los templates
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_PATH = os.path.join(BASE_DIR, "nuclei-templates") 
HTML_TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScanRequest(BaseModel):
    url: str

# Función para borrar archivos temporales después de enviarlos
def cleanup_file(path: str):
    if os.path.exists(path):
        os.remove(path)
        print(f"🗑️ Archivo temporal eliminado: {path}")

# Función ASÍNCRONA para ejecutar Nuclei (No bloquea la API)
async def ejecutar_nuclei_async(url: str):
    if not NUCLEI_PATH:
        raise HTTPException(status_code=500, detail="Nuclei no encontrado en el sistema")

    print(f"➡️ Iniciando escaneo asíncrono en: {url}")
    
    # Creamos el subproceso sin bloquear el hilo principal
    process = await asyncio.create_subprocess_exec(
        NUCLEI_PATH, "-u", url, "-jsonl", # "-templates", TEMPLATES_PATH, # Descomenta si usas templates custom
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    stdout, stderr = await process.communicate()
    
    # Procesar salida
    findings = []
    output_text = stdout.decode()
    
    for line in output_text.split("\n"):
        if line.strip():
            try:
                findings.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    # Resumir hallazgos
    summary = []
    seen = set()

    for v in findings:
        info = v.get("info", {})
        key = f"{v.get('templateID')}-{v.get('matched-at')}" # Clave única compuesta

        if key not in seen:
            seen.add(key)
            summary.append({
                "templateID": v.get("template-id"),
                "matchedAt": v.get("matched-at"),
                "severity": info.get("severity"),
                "name": info.get("name"),
                "description": info.get("description") or "Sin descripción",
                "reference": info.get("reference", [])
            })

    return summary, stderr.decode().strip()

@app.post("/scan-json")
async def scan_url_json(request: ScanRequest):
    try:
        # Usamos await para permitir concurrencia
        summary, stderr = await ejecutar_nuclei_async(request.url)
        return {
            "status": "ok",
            "count": len(summary),
            "vulnerabilities": summary
            # Omitimos stderr en producción por limpieza, o lo dejamos para debug
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/scan-pdf")
async def scan_url_pdf(request: ScanRequest, background_tasks: BackgroundTasks):
    try:
        summary, stderr = await ejecutar_nuclei_async(request.url)

        # Cargar template HTML
        env = Environment(loader=FileSystemLoader(HTML_TEMPLATE_DIR))
        try:
            template = env.get_template("report_template.html")
        except Exception:
            raise HTTPException(status_code=500, detail="No se encontró report_template.html en la carpeta templates")

        html_out = template.render(
            url=request.url,
            vulnerabilities=summary,
            count=len(summary)
        )

        # Crear PDF temporal
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
            HTML(string=html_out).write_pdf(f.name)
            pdf_path = f.name
        
        # Programar la eliminación del archivo para DESPUÉS de enviar la respuesta
        background_tasks.add_task(cleanup_file, pdf_path)

        return FileResponse(
            pdf_path, 
            filename=f"reporte_{request.url.replace('://', '_')}.pdf", 
            media_type="application/pdf"
        )

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))