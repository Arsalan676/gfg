import os
import glob
import re

html_files = glob.glob('/Users/arsalanaziz/Desktop/hackfest/frontend/src/stitch/*.html')
os.makedirs('/Users/arsalanaziz/Desktop/hackfest/frontend/src/components', exist_ok=True)

for fpath in html_files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Extract body inner HTML
    body_match = re.search(r'<body[^>]*>(.*?)</body>', content, re.IGNORECASE | re.DOTALL)
    if not body_match:
        continue
    body = body_match.group(1)
    
    # Simple React conversion
    body = body.replace('class="', 'className="')
    body = body.replace('for="', 'htmlFor="')
    body = re.sub(r'<!--(.*?)-->', r'{/* \1 */}', body, flags=re.DOTALL)
    
    # Convert inline styles for icons
    body = body.replace('''style="font-variation-settings: 'FILL' 1;"''', '''style={{ fontVariationSettings: "'FILL' 1" }}''')
    body = body.replace('''style="font-variation-settings: 'FILL' 0;"''', '''style={{ fontVariationSettings: "'FILL' 0" }}''')
    
    # Fix self-closing tags
    body = re.sub(r'<(img|input|hr|br)([^>]*?)(?<!/)>', r'<\1\2 />', body)
    
    comp_name = os.path.basename(fpath).replace('.html', '')
    
    jsx = f"""import React from 'react';

export default function {comp_name}() {{
  return (
    <div className="flex flex-col min-h-screen selection:bg-primary-container/30">
      {body}
    </div>
  );
}}
"""
    
    out_path = f'/Users/arsalanaziz/Desktop/hackfest/frontend/src/components/{comp_name}.jsx'
    with open(out_path, 'w', encoding='utf-8') as out:
        out.write(jsx)
    print(f"Generated {out_path}")
