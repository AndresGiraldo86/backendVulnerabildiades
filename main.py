import os
import json
import asyncio
import shutil
import tempfile
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fpdf import FPDF
from typing import List, Any

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
    allow_credentials=True
)

class ScanRequest(BaseModel):
    url: str
    vulnerabilities: List[Any] = []

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
        summary = request.vulnerabilities
        
        if not summary:
            print("⚠️ Advertencia: Lista vacía")

        # --- GENERACIÓN DE PDF CON FPDF (Sin dependencias de Linux) ---
        class PDF(FPDF):
            def header(self):
                self.set_font('Arial', 'B', 15)
                self.cell(0, 10, 'Reporte de Vulnerabilidades', 0, 1, 'C')
                self.ln(5)

            def footer(self):
                self.set_y(-15)
                self.set_font('Arial', 'I', 8)
                self.cell(0, 10, f'Pagina {self.page_no()}', 0, 0, 'C')

        pdf = PDF()
        pdf.add_page()
        
        # Titulo y URL
        pdf.set_font("Arial", size=12)
        pdf.cell(0, 10, f"Objetivo: {request.url}", ln=True)
        pdf.cell(0, 10, f"Total hallazgos: {len(summary)}", ln=True)
        pdf.ln(5)

        # Tabla de vulnerabilidades
        if summary:
            # Cabecera
            pdf.set_fill_color(200, 220, 255)
            pdf.set_font("Arial", 'B', 10)
            pdf.cell(40, 10, "Severidad", 1, 0, 'C', fill=True)
            pdf.cell(60, 10, "Nombre", 1, 0, 'C', fill=True)
            pdf.cell(90, 10, "Detalle / Ruta", 1, 1, 'C', fill=True)

            # Filas
            pdf.set_font("Arial", size=9)
            for item in summary:
                # Color según severidad
                severity = item.get("severity", "unknown").lower()
                if severity == "critical":
                    pdf.set_text_color(200, 0, 0) # Rojo
                elif severity == "high":
                    pdf.set_text_color(255, 100, 0) # Naranja
                else:
                    pdf.set_text_color(0, 0, 0) # Negro

                # Imprimir celdas (usando multi_cell para texto largo sería mejor, pero cell es simple)
                # Cortamos texto largo para que no rompa la tabla simple
                name_text = (item.get("name") or "")[:25]
                match_text = (item.get("matchedAt") or "")[:40]
                
                pdf.cell(40, 10, severity.upper(), 1, 0, 'C')
                pdf.cell(60, 10, name_text, 1, 0, 'L')
                pdf.cell(90, 10, match_text, 1, 1, 'L')
                
                pdf.set_text_color(0, 0, 0) # Reset color

        else:
            pdf.cell(0, 10, "No se encontraron vulnerabilidades.", ln=True)

        # Guardar archivo temporal
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
            pdf.output(f.name)
            pdf_path = f.name
        
        # Limpieza programada
        background_tasks.add_task(cleanup_file, pdf_path)

        return FileResponse(
            pdf_path, 
            filename=f"reporte_scan.pdf", 
            media_type="application/pdf"
        )

    except Exception as e:
        print(f"❌ Error generando PDF: {str(e)}")
        # Importante: Imprimir el error completo para debug
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))