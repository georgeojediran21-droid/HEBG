from pathlib import Path
from html.parser import HTMLParser
path = Path('vegetarian.html')
lines = path.read_text(encoding='utf-8').splitlines()
for n in [187,210,233,256,279,302,325,348,371]:
    print(f'{n}: {lines[n-1]}')
class MyParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.errors=[]
    def error(self, message):
        self.errors.append(message)
parser = MyParser()
text = path.read_text(encoding='utf-8')
parser.feed(text)
print('PARSER_ERRORS', parser.errors)
