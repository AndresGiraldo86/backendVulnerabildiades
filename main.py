from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from pydantic import HttpUrl #Validacion de Urls 
import shutil
import subprocess 
import subprocess
import json

app = FastAPI()
NUCLEI_PATH = "/opt/homebrew/bin/nuclei"
TEMPLATES_PATH = "/Users/andresgiraldo/Desktop/Proyecto WebApi Andres/nuclei-templates"



# Permitir llamadas desde cualquier origen (por ejemplo desde frontend local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelo de entrada para la solicitud
class ScanRequest(BaseModel):
    url: str # Solo acepta URLs validas

@app.get("/nuclei-version")
def get_nuclei_version():
    path = shutil.which("nuclei")
    result = subprocess.run(
        [path, "-version"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    return {
        "binary_path": path,
        "version": result.stdout.strip(),
        "stderr": result.stderr.strip()
    }

@app.post("/scan")
async def scan_url(request: ScanRequest):
    print("➡️ Recibida solicitud para escanear:", request.url)
    url = request.url
    TEMPLATES_PATH = "/Users/andresgiraldo/Desktop/Proyecto WebApi Andres/nuclei-templates"
 

    try:
        # Ejecutar nuclei con la URL proporcionada
        result = subprocess.run(
       # [NUCLEI_PATH, "-u", url, "-jsonl"],
        [NUCLEI_PATH, "-u", url, "-jsonl", "-templates", TEMPLATES_PATH],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # Parsear cada línea JSON de la salida
        print("STDOUT:", result.stdout),
        print("STDERR:", result.stderr),
        findings = [
            json.loads(line)
            for line in result.stdout.strip().split("\n")
            if line.strip()
        ]

        # Devolver resultado
        return {
            "status": "ok",
            "stdout": result.stdout,
            "stderr": result.stderr,
            "vulnerabilities": findings
        }

    except Exception as e:
        return {"error": str(e)}
