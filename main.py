import os
import json
import asyncio
import shutil
import tempfile
from datetime import datetime
from typing import List, Any

# --- IMPORTACIONES DE BASE DE DATOS Y PDF ---
from sqlmodel import Field, Session, SQLModel, create_engine, select
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fpdf import FPDF

# --- 1. CONFIGURACIÓN DE BASE DE DATOS ---
class ScanHistory(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    url: str
    scan_date: datetime = Field(default_factory=datetime.utcnow)
    vulnerabilities_count: int

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url)

# --- 2. CONFIGURACIÓN DE LA APP ---
app = FastAPI()

# Crear la base de datos al arrancar
@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)

NUCLEI_PATH = shutil.which("nuclei") or "/usr/local/bin/nuclei" 

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

def cleanup_file(path: str):
    if os.path.exists(path):
        try:
            os.remove(path)
            print(f"🗑️ Archivo temporal eliminado: {path}")
        except Exception as e:
            print(f"⚠️ No se pudo eliminar {path}: {e}")

async def ejecutar_nuclei_async(url: str):
    if not NUCLEI_PATH:
        raise HTTPException(status_code=500, detail="Nuclei no encontrado")

    print(f"➡️ Iniciando escaneo asíncrono en: {url}")
    
    # Creamos el subproceso correctamente con await
    process = await asyncio.create_subprocess_exec(
        NUCLEI_PATH, "-u", url, "-jsonl",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    stdout, stderr = await process.communicate()
    
    findings = []
    output_text = stdout.decode()
    
    for line in output_text.split("\n"):
        if line.strip():
            try:
                findings.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    summary = []
    seen = set()

    for v in findings:
        info = v.get("info", {})
        key = f"{v.get('templateID')}-{v.get('matched-at')}"

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

# --- 3. ENDPOINT DE ESCANEO (CON BASE DE DATOS) ---
@app.post("/scan-json")
async def scan_url_json(request: ScanRequest):
    try:
        # Ejecutar escaneo
        summary, stderr = await ejecutar_nuclei_async(request.url)
        
        # --- GUARDAR EN BASE DE DATOS ---
        try:
            with Session(engine) as session:
                nuevo_registro = ScanHistory(
                    url=request.url,
                    vulnerabilities_count=len(summary)
                )
                session.add(nuevo_registro)
                session.commit()
                print(f"💾 Historial guardado: {request.url} - {len(summary)} hallazgos")
        except Exception as db_error:
            print(f"⚠️ Error guardando en DB: {db_error}")
        # -------------------------------

        return {
            "status": "ok",
            "count": len(summary),
            "vulnerabilities": summary
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- 5. NUEVO ENDPOINT PARA VER EL HISTORIAL ---
@app.get("/history")
def get_history():
    try:
        with Session(engine) as session:
            # Traer los últimos 50 registros, ordenados del más nuevo al más viejo
            statement = select(ScanHistory).order_by(ScanHistory.scan_date.desc()).limit(50)
            results = session.exec(statement).all()
            return results
    except Exception as e:
        return {"status": "error", "message": str(e)}        

# --- 4. ENDPOINT DE PDF (CON FPDF) ---
@app.post("/scan-pdf")
async def scan_url_pdf(request: ScanRequest, background_tasks: BackgroundTasks):
    try:
        summary = request.vulnerabilities
        
        if not summary:
            print("⚠️ Advertencia: Lista vacía")

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
        
        pdf.set_font("Arial", size=12)
        pdf.cell(0, 10, f"Objetivo: {request.url}", ln=True)
        pdf.cell(0, 10, f"Total hallazgos: {len(summary)}", ln=True)
        pdf.ln(5)

        if summary:
            pdf.set_fill_color(200, 220, 255)
            pdf.set_font("Arial", 'B', 10)
            pdf.cell(40, 10, "Severidad", 1, 0, 'C', fill=True)
            pdf.cell(60, 10, "Nombre", 1, 0, 'C', fill=True)
            pdf.cell(90, 10, "Detalle / Ruta", 1, 1, 'C', fill=True)

            pdf.set_font("Arial", size=9)
            for item in summary:
                severity = item.get("severity", "unknown").lower()
                if severity == "critical":
                    pdf.set_text_color(200, 0, 0)
                elif severity == "high":
                    pdf.set_text_color(255, 100, 0)
                else:
                    pdf.set_text_color(0, 0, 0)

                name_text = (item.get("name") or "")[:25]
                match_text = (item.get("matchedAt") or "")[:40]
                
                pdf.cell(40, 10, severity.upper(), 1, 0, 'C')
                pdf.cell(60, 10, name_text, 1, 0, 'L')
                pdf.cell(90, 10, match_text, 1, 1, 'L')
                
                pdf.set_text_color(0, 0, 0)
        else:
            pdf.cell(0, 10, "No se encontraron vulnerabilidades.", ln=True)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
            pdf.output(f.name)
            pdf_path = f.name
        
        background_tasks.add_task(cleanup_file, pdf_path)

        return FileResponse(
            pdf_path, 
            filename=f"reporte_scan.pdf", 
            media_type="application/pdf"
        )

    except Exception as e:
        print(f"❌ Error generando PDF: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")