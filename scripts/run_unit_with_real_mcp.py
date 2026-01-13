import os, sys, subprocess

os.environ['BRIDGE_TEST_STUBS'] = '0'
print('BRIDGE_TEST_STUBS=', os.environ['BRIDGE_TEST_STUBS'])
cmd = [sys.executable, '-m', 'pytest', 'test/unit', '-q', '-r', 'a']
print('Running:', cmd)
proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
print(proc.stdout.decode(errors='replace'))
sys.exit(proc.returncode)
