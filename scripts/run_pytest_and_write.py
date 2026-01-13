import os, sys, subprocess

os.environ['BRIDGE_TEST_STUBS'] = '0'
if len(sys.argv) < 2:
    path = 'test/integration'
else:
    path = sys.argv[1]
out_file = 'pytest_' + path.replace('/', '_').replace('\\', '_') + '.txt'
cmd = [sys.executable, '-m', 'pytest', path, '-q', '-r', 'a']
with open(out_file, 'wb') as f:
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for chunk in iter(lambda: p.stdout.read(8192), b''):
        f.write(chunk)
    p.wait()
    exit_code = p.returncode
print('Wrote', out_file, 'exit code', exit_code)
sys.exit(exit_code)
