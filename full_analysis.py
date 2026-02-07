"""
Complete Error Analysis Report for K System
"""
import re
from collections import defaultdict
import os

def analyze_jshint_report():
    """Parse JSHint report and categorize errors"""
    try:
        with open('jshint_report.txt', 'r', encoding='utf-8', errors='ignore') as f:
            report = f.read()
    except FileNotFoundError:
        return {}
    
    lines = report.strip().split('\n')
    categories = defaultdict(list)
    
    for line in lines:
        if 'Misleading line break' in line:
            categories['MISLEADING_LINE_BREAK'].append(line)
        elif 'is defined but never used' in line:
            match = re.search(r"'(\w+)' is defined", line)
            if match:
                categories['UNUSED_VARIABLE'].append(match.group(1))
        elif 'is not defined' in line:
            match = re.search(r"'(\w+)' is not defined", line)
            if match:
                categories['UNDEFINED_VARIABLE'].append(match.group(1))
        elif 'redefined' in line:
            categories['REDEFINED'].append(line)
        elif line.strip():
            categories['OTHER'].append(line)
    
    return categories

def analyze_duplicate_functions():
    """Find duplicate function definitions"""
    try:
        with open('public/app.html', 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        return {}
    
    func_pattern = r'(?:async\s+)?function\s+(\w+)\s*\('
    functions = re.findall(func_pattern, content)
    
    counts = defaultdict(int)
    for func in functions:
        counts[func] += 1
    
    return {f: c for f, c in counts.items() if c > 1}

def analyze_backend_functions():
    """Analyze Netlify backend functions for issues"""
    issues = []
    backend_dir = 'netlify/functions'
    
    if not os.path.exists(backend_dir):
        return []
    
    for filename in os.listdir(backend_dir):
        if filename.endswith('.js'):
            filepath = os.path.join(backend_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Check for missing error handling
                if 'exports.handler' in content:
                    if 'try' not in content:
                        issues.append(f"{filename}: No try-catch in handler")
                    
                    # Check for missing API key validation
                    if 'process.env.' in content:
                        env_vars = re.findall(r'process\.env\.(\w+)', content)
                        for var in set(env_vars):
                            if f'!{var}' not in content and f'{var} ===' not in content and 'if (' not in content:
                                # Might be missing validation
                                pass
                    
                    # Check for hardcoded values
                    if re.search(r"'sk-[a-zA-Z0-9]{20,}'", content):
                        issues.append(f"{filename}: Potential hardcoded API key!")
                    
            except Exception as e:
                issues.append(f"{filename}: Error reading - {e}")
    
    return issues

def analyze_state_guards():
    """Check if state guards are properly reset"""
    try:
        with open('public/app.html', 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        return {}
    
    guards = ['isProcessingQuery', 'isSpeaking', 'isListening', 'translatorActive', 'vadActive']
    results = {}
    
    for guard in guards:
        sets = len(re.findall(f'{guard} = true', content))
        resets = len(re.findall(f'{guard} = false', content))
        results[guard] = {'sets': sets, 'resets': resets, 'ok': resets >= sets}
    
    return results

def main():
    print("=" * 60)
    print("K SYSTEM - COMPREHENSIVE ERROR ANALYSIS")
    print("=" * 60)
    print()
    
    # 1. JSHint Analysis
    print("=== JSHINT ERRORS ===")
    jshint = analyze_jshint_report()
    
    print(f"Misleading line breaks: {len(jshint.get('MISLEADING_LINE_BREAK', []))}")
    
    unused = list(set(jshint.get('UNUSED_VARIABLE', [])))
    print(f"\nUnused variables ({len(unused)}):")
    for var in sorted(unused):
        print(f"  - {var}")
    
    undefined = list(set(jshint.get('UNDEFINED_VARIABLE', [])))
    print(f"\nUndefined variables ({len(undefined)}):")
    for var in sorted(undefined):
        print(f"  - {var}")
    
    print(f"\nRedefinitions: {len(jshint.get('REDEFINED', []))}")
    print(f"Other issues: {len(jshint.get('OTHER', []))}")
    
    # 2. Duplicate Functions
    print("\n=== DUPLICATE FUNCTIONS ===")
    dupes = analyze_duplicate_functions()
    if dupes:
        for func, count in sorted(dupes.items()):
            print(f"  {func}: {count} definitions")
    else:
        print("  None found")
    
    # 3. Backend Analysis
    print("\n=== BACKEND FUNCTION ISSUES ===")
    backend = analyze_backend_functions()
    if backend:
        for issue in backend:
            print(f"  - {issue}")
    else:
        print("  No critical issues")
    
    # 4. State Guards
    print("\n=== STATE GUARD ANALYSIS ===")
    guards = analyze_state_guards()
    for guard, info in guards.items():
        status = "OK" if info['ok'] else "PROBLEM!"
        print(f"  {guard}: {info['sets']} sets, {info['resets']} resets [{status}]")
    
    # Summary
    total_issues = (
        len(jshint.get('MISLEADING_LINE_BREAK', [])) +
        len(unused) +
        len(undefined) +
        sum(c - 1 for c in dupes.values()) +
        len(backend) +
        sum(1 for g in guards.values() if not g['ok'])
    )
    
    print("\n" + "=" * 60)
    print(f"TOTAL ISSUES FOUND: {total_issues}")
    print("=" * 60)

if __name__ == '__main__':
    main()
