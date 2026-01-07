# test_weasyprint.py
from weasyprint import HTML

HTML(string="<h1>Hola Andrés</h1>").write_pdf("test.pdf")
