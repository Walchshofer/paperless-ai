import os, sys, subprocess

if len(sys.argv) < 2:
    print('usage: run_integration_file.py <test_path>')
    sys.exit(2)

test_path = sys.argv[1]
os.environ['BRIDGE_TEST_STUBS'] = '0'
out_file = f'integration_{os.path.basename(test_path)}.txt'
cmd = [sys.executable, '-m', 'pytest', test_path, '-q', '-r', 'a']
with open(out_file, 'wb') as f:
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for chunk in iter(lambda: p.stdout.read(8192), b''):
        f.write(chunk)
    p.wait()
    exit_code = p.returncode
print('Wrote', out_file, 'exit code', exit_code)
sys.exit(exit_code)
