#!/usr/bin/env python3
"""
보안 코드 리뷰를 위한 고속 시크릿/민감정보 탐지 스크립트.
주요 API Key, Private Key, DB Connection String, JWT 등을 스캔합니다.
"""

import os
import re
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SECRET_PATTERNS = [
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID"),
    (r"(?i)aws_secret_access_key\s*[:=]\s*['\"][A-Za-z0-9/+=]{40}['\"]", "AWS Secret Key"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "Private Key (RSA/EC/OpenSSH)"),
    (r"(?i)(?:api_key|apikey|secret_key|app_secret)\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}['\"]", "Generic API Key/Secret"),
    (r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+", "JWT Token"),
    (r"(?i)(?:postgres|mysql|mongodb|mongodb\+srv|redis)://[^\s'\"]+:[^\s'\"]+@[^\s'\"]+", "DB Connection String with Password"),
    (r"(?i)(?:password|passwd|pwd)\s*[:=]\s*['\"][^\s'\"]{6,}['\"]", "Hardcoded Password Assignment"),
    (r"ghp_[A-Za-z0-9]{36}", "GitHub Personal Access Token"),
    (r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}", "Slack Token"),
]

EXCLUDED_DIRS = {
    ".git", ".svn", "node_modules", "dist", "build", ".next", 
    "venv", ".venv", "__pycache__", ".agents", "coverage"
}

EXCLUDED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2",
    ".ttf", ".eot", ".zip", ".tar", ".gz", ".lock", ".pyc"
}

def scan_file(filepath):
    findings = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for line_idx, line in enumerate(f, start=1):
                # Ignore comment-only lines that are test assertions if obvious
                for pattern, secret_type in SECRET_PATTERNS:
                    match = re.search(pattern, line)
                    if match:
                        snippet = line.strip()
                        if len(snippet) > 120:
                            snippet = snippet[:117] + "..."
                        findings.append({
                            "line": line_idx,
                            "type": secret_type,
                            "snippet": snippet
                        })
    except Exception as e:
        pass
    return findings

def scan_target(target_path):
    all_results = {}
    if os.path.isfile(target_path):
        res = scan_file(target_path)
        if res:
            all_results[target_path] = res
    elif os.path.isdir(target_path):
        for root, dirs, files in os.walk(target_path):
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in EXCLUDED_EXTENSIONS:
                    continue
                filepath = os.path.join(root, file)
                res = scan_file(filepath)
                if res:
                    all_results[filepath] = res

    return all_results

def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    print(f"[*] 시크릿 및 민감정보 스캔 시작: {os.path.abspath(target)}")
    results = scan_target(target)
    
    total_findings = sum(len(v) for v in results.values())
    if not results:
        print("[+] 하드코딩된 시크릿이나 민감 정보가 발견되지 않았습니다. (안전)")
        return

    print(f"\n[!] 총 {total_findings}건의 의심 항목 발견:")
    for filepath, items in results.items():
        rel_path = os.path.relpath(filepath, target)
        print(f"\n파일: {rel_path}")
        for item in items:
            print(f"  - [줄 {item['line']}] {item['type']}")
            print(f"    코드: {item['snippet']}")

if __name__ == "__main__":
    main()
