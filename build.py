# Builds one self-contained page so the page and its code can never be out of step.
import re, sys
src='/home/claude/site/'
h=open(src+'index.html').read()
for f in ['logic.js','app.js']:
    tag='<script src="%s"></script>' % f
    assert h.count(tag)==1, tag
    code=open(src+f).read()
    assert '</script' not in code.lower(), f+' contains a closing script tag'
    h=h.replace(tag, '<script>\n'+code+'\n</script>')
open(sys.argv[1],'w').write(h)
print('built', sys.argv[1], len(h.encode())//1024, 'KB')
