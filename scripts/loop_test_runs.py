import subprocess
import sys

for i in range(1, 21):
    print(f"Run {i}")
    rc = subprocess.call([sys.executable, 'scripts/run_single_test_syspath_prepend.py'])
    if rc != 0:
        print(f"Failed on run {i} (rc={rc})")
        sys.exit(rc)
print('All runs passed')
