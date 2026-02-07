"""
DELETE REMAINING ROUND 7
"""
import re

with open('public/app.html', 'r', encoding='utf-8') as f:
    content = f.read()

original = len(content)

functions = ['isActivated']

variables = [
    'MIN_RESTART_INTERVAL', 'docPanelMode', 'BLINK_MIN_DELAY', 'BLINK_MAX_DELAY',
    'mapAnimations', 'lipSyncDelayMs', 'userLanguage'
]

deleted = 0

for func in functions:
    pattern = rf'(\n\s*)((?:async\s+)?function\s+{func}\s*\([^)]*\)\s*\{{)'
    match = re.search(pattern, content)
    if match:
        start = match.start()
        brace_count = 0
        pos = match.end() - 1
        while pos < len(content):
            if content[pos] == '{':
                brace_count += 1
            elif content[pos] == '}':
                brace_count -= 1
                if brace_count == 0:
                    content = content[:start] + '\n' + content[pos+1:]
                    print(f'Del: {func}')
                    deleted += 1
                    break
            pos += 1

for var in variables:
    # Single line
    pattern = rf'\n\s+(?:let|const|var)\s+{var}\s*=.*?;\n'
    if re.search(pattern, content):
        content = re.sub(pattern, '\n', content)
        print(f'Del: {var}')
        deleted += 1
    else:
        # Multi-line
        pattern = rf'\n(\s+)(?:let|const|var)\s+{var}\s*=\s*[\[{{]'
        match = re.search(pattern, content)
        if match:
            start = match.start()
            bracket_char = content[match.end()-1]
            close_char = ']' if bracket_char == '[' else '}'
            bracket_count = 1
            pos = match.end()
            while pos < len(content) and bracket_count > 0:
                if content[pos] == bracket_char:
                    bracket_count += 1
                elif content[pos] == close_char:
                    bracket_count -= 1
                pos += 1
            while pos < len(content) and content[pos] in ' \t\n;':
                pos += 1
            content = content[:start] + '\n' + content[pos:]
            print(f'Del: {var}')
            deleted += 1

with open('public/app.html', 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\nDeleted {deleted}, Removed: {original - len(content)} chars')
