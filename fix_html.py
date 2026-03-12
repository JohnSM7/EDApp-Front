import os

file_path = 'src/views/AnalystView.vue'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken lines
content = content.replace('<input               <div class="form-row"', '<div class="form-row"')
content = content.replace('</div>>', '</div>')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
