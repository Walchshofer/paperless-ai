import sys
import zipfile

zip_path = 'unit_logs_5107520118.zip'
try:
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        print('entries:', names)
        for name in names:
            print('\n---', name)
            try:
                print(z.read(name).decode('utf-8'))
            except Exception as e:
                print('<binary or decode error>', e)
except FileNotFoundError:
    print('zip not found:', zip_path)
    sys.exit(2)
