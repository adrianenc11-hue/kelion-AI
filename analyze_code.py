"""
K SYSTEM - Deep Code Analyzer
Detectează automat probleme în JavaScript/HTML
"""

import re
import os
from collections import defaultdict

def analyze_file(filepath):
    """Analizează un fișier pentru probleme comune"""
    issues = []
    
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        lines = content.split('\n')
    
    # 1. FUNCȚII DUPLICATE
    func_pattern = r'(?:async\s+)?function\s+(\w+)\s*\('
    functions = re.findall(func_pattern, content)
    func_counts = defaultdict(int)
    for func in functions:
        func_counts[func] += 1
    for func, count in func_counts.items():
        if count > 1:
            issues.append(f"❌ DUPLICATE: Funcția '{func}' apare de {count} ori")
    
    # 2. AWAIT FĂRĂ TRY-CATCH
    in_try_block = False
    try_depth = 0
    for i, line in enumerate(lines, 1):
        if 'try {' in line or 'try{' in line:
            try_depth += 1
        if '} catch' in line or '}catch' in line:
            try_depth = max(0, try_depth - 1)
        
        if 'await ' in line and try_depth == 0:
            # Check if it's not in a try block
            stripped = line.strip()
            if not stripped.startswith('//') and 'catch' not in line:
                issues.append(f"⚠️ AWAIT fără try-catch: linia {i}")
    
    # 3. RETURN ÎN ASYNC FĂRĂ PROMISE HANDLING
    async_funcs = re.finditer(r'async function (\w+)[^{]*\{', content)
    for match in async_funcs:
        func_name = match.group(1)
        start = match.end()
        # Find function body (simple approximation)
        brace_count = 1
        pos = start
        while brace_count > 0 and pos < len(content):
            if content[pos] == '{':
                brace_count += 1
            elif content[pos] == '}':
                brace_count -= 1
            pos += 1
        func_body = content[start:pos]
        
        # Check for early returns without cleanup
        early_returns = re.findall(r'return;(?![^}]*finally)', func_body)
        if len(early_returns) > 0:
            issues.append(f"⚠️ EARLY RETURN în async '{func_name}': {len(early_returns)} return-uri potențial fără cleanup")
    
    # 4. TIMEOUTS FĂRĂ CLEAR
    set_timeouts = len(re.findall(r'setTimeout\(', content))
    clear_timeouts = len(re.findall(r'clearTimeout\(', content))
    if set_timeouts > clear_timeouts + 5:  # Allow some margin
        issues.append(f"⚠️ MEMORY LEAK: {set_timeouts} setTimeout vs {clear_timeouts} clearTimeout")
    
    # 5. EVENT LISTENERS FĂRĂ REMOVE
    add_listeners = len(re.findall(r'addEventListener\(', content))
    remove_listeners = len(re.findall(r'removeEventListener\(', content))
    if add_listeners > remove_listeners + 10:
        issues.append(f"⚠️ MEMORY LEAK: {add_listeners} addEventListener vs {remove_listeners} removeEventListener")
    
    # 6. HARDCODED API KEYS
    api_key_patterns = [
        r'["\']sk-[a-zA-Z0-9]{20,}["\']',  # OpenAI
        r'["\']AIza[a-zA-Z0-9_-]{35}["\']',  # Google
        r'Bearer [a-zA-Z0-9_-]{20,}',  # Bearer tokens
    ]
    for pattern in api_key_patterns:
        matches = re.findall(pattern, content)
        for match in matches:
            issues.append(f"🔐 SECURITY: Potențială cheie API expusă: {match[:20]}...")
    
    # 7. CATCH EMPTY (error swallowing)
    empty_catches = re.findall(r'catch\s*\([^)]*\)\s*\{\s*\}', content)
    if empty_catches:
        issues.append(f"❌ EMPTY CATCH: {len(empty_catches)} blocuri catch goale (errors înghițite)")
    
    # 8. INFINITE LOOPS POTENTIAL
    while_true = len(re.findall(r'while\s*\(\s*true\s*\)', content))
    if while_true > 0:
        issues.append(f"⚠️ INFINITE LOOP: {while_true} while(true) găsite")
    
    # 9. MISSING SEMICOLONS (potential issues)
    # Skip this for now - too many false positives
    
    # 10. CONSOLE.LOG în producție
    console_logs = len(re.findall(r'console\.log\(', content))
    console_errors = len(re.findall(r'console\.error\(', content))
    if console_logs > 50:
        issues.append(f"ℹ️ DEBUG: {console_logs} console.log (consider removing for production)")
    
    # 11. GLOBAL VARIABLES
    global_vars = re.findall(r'^\s*(?:var|let|const)\s+(\w+)\s*=', content, re.MULTILINE)
    if len(global_vars) > 100:
        issues.append(f"⚠️ GLOBALS: {len(global_vars)} variabile globale (consider modularizing)")
    
    # 12. PROMISES WITHOUT CATCH
    promise_new = len(re.findall(r'new Promise\(', content))
    promise_catch = len(re.findall(r'\.catch\(', content))
    if promise_new > promise_catch:
        issues.append(f"⚠️ UNHANDLED PROMISE: {promise_new} Promise vs {promise_catch} .catch()")
    
    # 13. FETCH WITHOUT ERROR CHECK
    fetch_calls = re.finditer(r'await fetch\([^)]+\)', content)
    for match in fetch_calls:
        # Check if response.ok is checked nearby
        start = match.start()
        next_200_chars = content[start:start+200]
        if 'response.ok' not in next_200_chars and '.ok' not in next_200_chars:
            line_num = content[:start].count('\n') + 1
            issues.append(f"⚠️ UNCHECKED FETCH: linia {line_num} - fetch fără verificare response.ok")
    
    return issues

def analyze_directory(directory):
    """Analizează toate fișierele din director"""
    all_issues = {}
    
    for root, dirs, files in os.walk(directory):
        # Skip node_modules and other irrelevant dirs
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'dist', 'build']]
        
        for file in files:
            if file.endswith(('.js', '.html', '.jsx', '.ts', '.tsx')):
                filepath = os.path.join(root, file)
                try:
                    issues = analyze_file(filepath)
                    if issues:
                        all_issues[filepath] = issues
                except Exception as e:
                    print(f"Error analyzing {filepath}: {e}")
    
    return all_issues

if __name__ == '__main__':
    import sys
    
    target = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    print("=" * 60)
    print("🔍 K SYSTEM - DEEP CODE ANALYZER")
    print("=" * 60)
    print()
    
    if os.path.isfile(target):
        issues = analyze_file(target)
        if issues:
            print(f"📁 {target}:")
            for issue in issues:
                print(f"   {issue}")
        else:
            print("✅ No issues found!")
    else:
        all_issues = analyze_directory(target)
        total = 0
        for filepath, issues in all_issues.items():
            print(f"\n📁 {filepath}:")
            for issue in issues:
                print(f"   {issue}")
                total += 1
        
        print()
        print("=" * 60)
        print(f"TOTAL: {total} probleme găsite în {len(all_issues)} fișiere")
        print("=" * 60)
