import os, sys, subprocess

os.environ['BRIDGE_TEST_STUBS'] = '0'
out_file = 'integration_tests_real_mcp.txt'
cmd = [sys.executable, '-m', 'pytest', 'test/integration', '-q']
with open(out_file, 'wb') as f:
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for chunk in iter(lambda: p.stdout.read(8192), b''):
        f.write(chunk)
    p.wait()
    exit_code = p.returncode
print('Wrote', out_file, 'exit code', exit_code)
sys.exit(exit_code)
