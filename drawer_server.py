import http.server
import socketserver
import win32print
import sys

# --- Configuração ---
PORT = 9100
# O nome da impressora deve ser exatamente como aparece no Windows.
PRINTER_NAME = "Bematech MP-4200 HS" 

# Este é o comando ESC/POS para abrir a gaveta (gaveta #1).
# Pode variar dependendo do modelo da sua impressora.
KICK_COMMAND = b'\x1b\x70\x00\x19\xfa' 

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/open-drawer':
            try:
                hPrinter = win32print.OpenPrinter(PRINTER_NAME)
                try:
                    # Inicia um novo trabalho de impressão RAW.
                    hJob = win32print.StartDocPrinter(hPrinter, 1, ("Cash Drawer Kick", None, "RAW"))
                    try:
                        win32print.StartPagePrinter(hPrinter)
                        # Envia o comando bruto para a impressora.
                        win32print.WritePrinter(hPrinter, KICK_COMMAND)
                        win32print.EndPagePrinter(hPrinter)
                    finally:
                        win32print.EndDocPrinter(hPrinter)
                finally:
                    win32print.ClosePrinter(hPrinter)
                
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'Comando para abrir a gaveta enviado com sucesso.')
                print(f"Comando enviado para a impressora '{PRINTER_NAME}'.")

            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(f'Erro: {e}'.encode('utf-8'))
                print(f"ERRO: Não foi possível enviar o comando para a impressora. Detalhes: {e}")
                print("Verifique se o nome da impressora está correto e se ela está online.")
        else:
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'Endpoint nao encontrado.')

    def do_OPTIONS(self):
        # Lida com as requisições CORS pre-flight do navegador.
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

# Verifica se o pywin32 está instalado
try:
    import win32print
except ImportError:
    print("ERRO: A biblioteca 'pywin32' não está instalada.")
    print("Por favor, instale-a executando o comando: pip install pywin32")
    sys.exit(1)

with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
    print("====================================================================")
    print(" Servidor da Gaveta Iniciado")
    print("====================================================================")
    print(f"  - Escutando na porta: {PORT}")
    print(f"  - Controlando a impressora: '{PRINTER_NAME}'")
    print("  - Pressione CTRL+C para parar o servidor.")
    print("====================================================================")
    print("Deixe este terminal aberto para que o sistema de caixa funcione.")
    httpd.serve_forever()