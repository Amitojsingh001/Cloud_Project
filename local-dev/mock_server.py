#!/usr/bin/env python3
"""
Local Mock Server for Campus Issue Reporting and Tracking System
Course: UCS531 - Cloud Computing

Simulates:
1. Static website file serving (frontend/index.html, admin.html, etc.)
2. API Gateway REST API + Lambda business logic
3. In-memory DynamoDB storage with single-table design & StudentIndex simulation
4. SQS Queue message delivery simulation
5. SNS Topic notification broadcast console logging
"""

import http.server
import socketserver
import json
import uuid
from datetime import datetime, timezone
import os
import urllib.parse

PORT = 8000
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

# In-memory database simulating DynamoDB Issues table
mock_issues_db = [
    {
        "issueId": "e1a2b3c4-5678-90ab-cdef-111122223333",
        "studentId": "102103456",
        "studentEmail": "student1@thapar.edu",
        "category": "Electrical",
        "title": "Broken AC in Computer Lab 3",
        "description": "The split AC unit is making grinding noise and blowing warm air.",
        "photoUrl": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=80",
        "status": "Open",
        "createdAt": "2026-11-20T10:15:00.000Z",
        "updatedAt": "2026-11-20T10:15:00.000Z"
    },
    {
        "issueId": "f2b3c4d5-6789-01bc-def1-222233334444",
        "studentId": "102103789",
        "studentEmail": "student2@thapar.edu",
        "category": "Network",
        "title": "Wi-Fi Access Point unreachable in Hostel H",
        "description": "Students on the 2nd floor wing B cannot connect to Campus-WiFi.",
        "photoUrl": None,
        "status": "In Progress",
        "createdAt": "2026-11-21T14:30:00.000Z",
        "updatedAt": "2026-11-21T16:00:00.000Z"
    },
    {
        "issueId": "a3c4d5e6-7890-12cd-ef12-333344445555",
        "studentId": "102103456",
        "studentEmail": "student1@thapar.edu",
        "category": "Plumbing",
        "title": "Water dispenser tap leaking in Library",
        "description": "1st floor drinking water cooler tap is continuously dripping.",
        "photoUrl": None,
        "status": "Resolved",
        "createdAt": "2026-11-19T08:00:00.000Z",
        "updatedAt": "2026-11-19T11:45:00.000Z"
    }
]

class MockCampusHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token")

    def _send_json_response(self, status_code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # API Route: GET /issues or GET /issues?studentId=...
        if path == "/issues":
            student_id = query.get("studentId", [None])[0]
            if student_id:
                print(f"[DynamoDB GSI Query] Querying StudentIndex for studentId='{student_id}'")
                results = [item for item in mock_issues_db if item["studentId"] == student_id]
                results.sort(key=lambda x: x["createdAt"], reverse=True)
            else:
                print(f"[DynamoDB Table Scan] Scanning all items for admin view")
                results = sorted(mock_issues_db, key=lambda x: x["createdAt"], reverse=True)

            self._send_json_response(200, {
                "count": len(results),
                "issues": results
            })
            return

        # API Route: GET /issues/{id}
        if path.startswith("/issues/"):
            issue_id = path.replace("/issues/", "").split("/")[0]
            print(f"[DynamoDB GetItem] Getting item with issueId='{issue_id}'")
            matched = next((item for item in mock_issues_db if item["issueId"] == issue_id), None)
            if matched:
                self._send_json_response(200, {"issue": matched})
            else:
                self._send_json_response(404, {"error": "Issue not found"})
            return

        # Otherwise serve static frontend files
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length)

        try:
            body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:
            self._send_json_response(400, {"error": "Invalid JSON payload"})
            return

        # API Route: POST /issues (createIssue Lambda)
        if path == "/issues":
            student_id = body.get("studentId")
            student_email = body.get("studentEmail")
            category = body.get("category")
            title = body.get("title")
            description = body.get("description")
            photo_url = body.get("photoUrl")

            if not all([student_id, student_email, category, title, description]):
                self._send_json_response(400, {"error": "Missing required fields"})
                return

            now = datetime.now(timezone.utc).isoformat()
            issue_id = str(uuid.uuid4())

            new_issue = {
                "issueId": issue_id,
                "studentId": student_id.strip(),
                "studentEmail": student_email.strip().lower(),
                "category": category.strip(),
                "title": title.strip(),
                "description": description.strip(),
                "photoUrl": photo_url,
                "status": "Open",
                "createdAt": now,
                "updatedAt": now
            }

            mock_issues_db.append(new_issue)
            print(f"[Lambda createIssue] Inserted into DynamoDB: issueId={issue_id}")

            self._send_json_response(201, {
                "message": "Issue created successfully",
                "issue": new_issue
            })
            return

        # API Route: POST /uploads/presign (getUploadUrl Lambda)
        if path == "/uploads/presign":
            file_name = body.get("fileName", "photo.jpg")
            clean_name = "".join(c for c in file_name if c.isalnum() or c in ".-_")
            key = f"photos/{uuid.uuid4()}-{clean_name}"

            mock_upload_url = f"http://localhost:{PORT}/mock-s3-upload/{key}"
            mock_photo_url = f"https://mock-s3-bucket.s3.amazonaws.com/{key}"

            print(f"[Lambda getUploadUrl] Generated presigned URL for key='{key}'")
            self._send_json_response(200, {
                "uploadUrl": mock_upload_url,
                "photoUrl": mock_photo_url,
                "key": key,
                "expiresInSeconds": 300
            })
            return

        self._send_json_response(404, {"error": "Endpoint not found"})

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Handle Mock S3 direct upload PUT
        if path.startswith("/mock-s3-upload/"):
            content_length = int(self.headers.get("Content-Length", 0))
            _ = self.rfile.read(content_length)
            print(f"[Mock S3] Received direct binary file upload: {path}")
            self.send_response(200)
            self._send_cors_headers()
            self.end_headers()
            return

        # API Route: PUT /issues/{id}/status (updateIssueStatus Lambda)
        if path.startswith("/issues/") and path.endswith("/status"):
            parts = path.strip("/").split("/")
            issue_id = parts[1]

            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length)
            try:
                body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
            except Exception:
                self._send_json_response(400, {"error": "Invalid JSON"})
                return

            new_status = body.get("status")
            comment = body.get("comment", "")

            if new_status not in ["Open", "In Progress", "Resolved"]:
                self._send_json_response(400, {"error": "Invalid status value"})
                return

            matched = next((item for item in mock_issues_db if item["issueId"] == issue_id), None)
            if not matched:
                self._send_json_response(404, {"error": "Issue not found"})
                return

            prev_status = matched["status"]
            matched["status"] = new_status
            matched["updatedAt"] = datetime.now(timezone.utc).isoformat()

            print(f"\n=======================================================")
            print(f"[Lambda updateIssueStatus] DynamoDB updated for {issue_id}")
            print(f"[SQS Producer] Enqueued message to CampusIssue-StatusUpdateQueue:")
            sqs_message = {
                "issueId": issue_id,
                "studentId": matched["studentId"],
                "studentEmail": matched["studentEmail"],
                "title": matched["title"],
                "previousStatus": prev_status,
                "newStatus": new_status,
                "comment": comment
            }
            print(json.dumps(sqs_message, indent=2))
            print(f"-------------------------------------------------------")
            print(f"[SQS Consumer -> Lambda notifyStudent]")
            print(f"[SNS Publisher] Broadcasting email to topic CampusIssue-StatusNotifications:")
            print(f"  To:      {matched['studentEmail']}")
            print(f"  Subject: [Campus Issue Tracker] Status Update: {matched['title']} is now '{new_status}'")
            print(f"  Message: Status changed from '{prev_status}' to '{new_status}'.")
            print(f"=======================================================\n")

            self._send_json_response(200, {
                "message": "Issue status updated successfully",
                "issue": matched,
                "notificationEnqueued": True,
                "sqsMessageId": str(uuid.uuid4())
            })
            return

        self._send_json_response(404, {"error": "Endpoint not found"})


def run():
    print(f"==============================================================")
    print(f" Serverless Campus Issue Tracker - Local Development Server   ")
    print(f" Course: UCS531 - Cloud Computing                             ")
    print(f"==============================================================")
    print(f" Frontend Portal:   http://localhost:{PORT}/index.html")
    print(f" Admin Dashboard:   http://localhost:{PORT}/admin.html")
    print(f" REST API Endpoint: http://localhost:{PORT}")
    print(f" Serving Directory: {FRONTEND_DIR}")
    print(f" Press Ctrl+C to stop the server.")
    print(f"==============================================================\n")

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), MockCampusHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down local server.")

if __name__ == "__main__":
    run()

