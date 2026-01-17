from pathlib import Path
a=[l for l in Path('docker-compose.env').read_text().splitlines() if '=' in l]
b=[l for l in Path('.env').read_text().splitlines() if '=' in l]
diff=[x for x in a if x not in b]
print('docker-compose.env =', len(a))
print('.env =', len(b))
print('missing =', len(diff))
print('\nFirst 20 missing lines:')
for x in diff[:20]:
    print(x)
