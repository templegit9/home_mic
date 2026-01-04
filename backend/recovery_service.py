#!/usr/bin/env python3
"""
HomeMic Recovery Service
A lightweight service that runs on port 8001 to restart the main backend (port 8000)
even when it's crashed. This solves the chicken-and-egg problem.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import json
import os

PORT = 8001
SERVICE_NAME = "homemic"

class RecoveryHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self._send_json({})

    def do_GET(self):
        if self.path == '/health':
            # Check if main service is running
            result = subprocess.run(['systemctl', 'is-active', SERVICE_NAME], capture_output=True, text=True)
            is_active = result.stdout.strip() == 'active'
            self._send_json({
                'recovery_service': 'online',
                'main_service': 'online' if is_active else 'offline',
                'service_name': SERVICE_NAME
            })
        elif self.path == '/':
            self._send_json({'service': 'HomeMic Recovery', 'port': PORT})
        else:
            self._send_json({'error': 'Not found'}, 404)

    def do_POST(self):
        if self.path == '/restart':
            try:
                # Restart the main service
                result = subprocess.run(
                    ['systemctl', 'restart', SERVICE_NAME],
                    capture_output=True, text=True
                )
                if result.returncode == 0:
                    self._send_json({'success': True, 'message': f'{SERVICE_NAME} restarted'})
                else:
                    self._send_json({'success': False, 'error': result.stderr}, 500)
            except Exception as e:
                self._send_json({'success': False, 'error': str(e)}, 500)
        
        elif self.path == '/update':
            try:
                # Git pull and restart
                os.chdir('/opt/homemic')
                subprocess.run(['git', 'pull'], capture_output=True)
                result = subprocess.run(
                    ['systemctl', 'restart', SERVICE_NAME],
                    capture_output=True, text=True
                )
                if result.returncode == 0:
                    self._send_json({'success': True, 'message': 'Updated and restarted'})
                else:
                    self._send_json({'success': False, 'error': result.stderr}, 500)
            except Exception as e:
                self._send_json({'success': False, 'error': str(e)}, 500)
        
        elif self.path == '/stop':
            try:
                result = subprocess.run(['systemctl', 'stop', SERVICE_NAME], capture_output=True, text=True)
                self._send_json({'success': result.returncode == 0, 'message': f'{SERVICE_NAME} stopped'})
            except Exception as e:
                self._send_json({'success': False, 'error': str(e)}, 500)
        
        elif self.path == '/start':
            try:
                result = subprocess.run(['systemctl', 'start', SERVICE_NAME], capture_output=True, text=True)
                self._send_json({'success': result.returncode == 0, 'message': f'{SERVICE_NAME} started'})
            except Exception as e:
                self._send_json({'success': False, 'error': str(e)}, 500)
        
        else:
            self._send_json({'error': 'Not found'}, 404)

    def log_message(self, format, *args):
        print(f"[Recovery] {args[0]}")

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), RecoveryHandler)
    print(f"HomeMic Recovery Service running on port {PORT}")
    print(f"Endpoints: GET /health, POST /restart, POST /update, POST /start, POST /stop")
    server.serve_forever()
