#!/usr/bin/env python3
"""
Activity Dashboard Server
Automatically finds the latest activity_data JSON and serves the dashboard.
Usage: python server.py
Then open http://localhost:8050 in your browser.
"""

import http.server
import json
import os
import glob
import sys

DATA_DIR = os.path.expanduser(
    "~/Library/Mobile Documents/com~apple~CloudDocs/Documents/GitHub/mac_activity_tracker-2/activity_data"
)
PORT = 8050
DASHBOARD_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard.html")
print(DASHBOARD_PATH)

def get_latest_file():
    """Find the most recent activity_data JSON file."""
    pattern = os.path.join(DATA_DIR, "*.json")
    files = glob.glob(pattern)
    if not files:
        return None
    return max(files, key=os.path.getmtime)


def read_activity_data(filepath):
    """Read newline-delimited JSON entries from the file."""
    entries = []
    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return entries


class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.serve_dashboard()
        elif self.path == "/api/data":
            self.serve_data()
        elif self.path == "/api/files":
            self.serve_file_list()
        else:
            self.send_error(404)

    def serve_dashboard(self):
        with open(DASHBOARD_PATH, "r") as f:
            html = f.read()
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html.encode())

    def serve_data(self):
        filepath = get_latest_file()
        if not filepath:
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "No data files found"}).encode())
            return

        entries = read_activity_data(filepath)
        payload = {
            "filename": os.path.basename(filepath),
            "entries": entries,
        }
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode())

    def serve_file_list(self):
        pattern = os.path.join(DATA_DIR, "activity_data_*.json")
        files = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
        names = [os.path.basename(f) for f in files]
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(names).encode())

    def log_message(self, format, *args):
        # Quieter logging
        if "/api/data" not in str(args):
            super().log_message(format, *args)


if __name__ == "__main__":
    latest = get_latest_file()
    if latest:
        print(f"Latest data file: {os.path.basename(latest)}")
    else:
        print(f"Warning: No data files found in {DATA_DIR}")
        print("The dashboard will show an empty state until data appears.")

    print(f"\nDashboard running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.\n")

    server = http.server.HTTPServer(("", PORT), DashboardHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()