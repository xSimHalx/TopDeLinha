import http.server
import socketserver
import threading
import webbrowser
import os
import sys
import time

# --- Configuração ---
WEB_PORT = 8000
DRAWER_PORT = 9100

def run_web_server():
    """Inicia o servidor web simples para servir os arquivos do site."""
    handler = http.server.SimpleHTTPRequestHandler
    # Força o uso de UTF-8 (útil para sistemas Windows antigos)
    handler.extensions_map.update({
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
    })
    
    try:
        with socketserver.TCPServer(("", WEB_PORT), handler) as httpd:
            print(f"✅ Servidor Web rodando em: http://localhost:{WEB_PORT}")
            httpd.serve_forever()
    except OSError as e:
        print(f"❌ Erro ao iniciar servidor web na porta {WEB_PORT}: {e}")

def run_drawer_service():
    """
    Tenta iniciar o servidor da gaveta.
    Se o script drawer_server.py estivesse aqui, poderíamos importá-lo.
    Como ele é um script separado que bloqueia, o ideal é rodá-lo como subprocesso
    ou importar o módulo se ele for bem comportado. 
    Vou tentar rodar o scrip existente usando subprocess para isolamento.
    """
    import subprocess
    
    script_path = os.path.join(os.getcwd(), "drawer_server.py")
    if os.path.exists(script_path):
        print(f"🔄 Iniciando serviço de impressão/gaveta ({script_path})...")
        try:
            # Executa e deixa rodando
            subprocess.Popen([sys.executable, script_path])
        except Exception as e:
            print(f"❌ Falha ao iniciar drawer_server.py: {e}")
    else:
        print("⚠️ Aviso: drawer_server.py não encontrado. O controle de gaveta não funcionará.")

def main():
    print("🚀 Inicializando Sistema PDV TopDeLinha Local...")
    
    # 1. Iniciar Servidor da Gaveta (em background)
    run_drawer_service()
    
    # 2. Iniciar Servidor Web (em uma thread para não bloquear a abertura do browser)
    web_thread = threading.Thread(target=run_web_server)
    web_thread.daemon = True
    web_thread.start()
    
    # Aguarda um pouco para garantir que o server subiu
    time.sleep(2)
    
    # 3. Abrir Navegador
    url = f"http://localhost:{WEB_PORT}"
    print(f"globe_with_meridians: Abrindo navegador em {url}...")
    webbrowser.open(url)
    
    print("\nℹ️  PARA FECHAR: Pressione CTRL+C ou feche esta janela.\n")
    
    # Mantém o script principal rodando
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Encerrando sistema...")
        sys.exit(0)

if __name__ == "__main__":
    main()
