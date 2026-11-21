# Chi dong goi source lien quan; khong kem dependencies, build, .env hoac ZIP cu.
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys
root=Path(__file__).resolve().parent.parent
name=sys.argv[1] if len(sys.argv)>1 else 'BookMarket-stage2-3-light.zip'
files=[
    path
    for path in [root/'package.json',root/'README.md',root/'.gitignore',root/'setup.bat',root/'run.bat']
    if path.is_file()
]
for folder in ['frontend','backend','docs','scripts']:
    directory=root/folder
    for path in directory.rglob('*'):
        if not path.is_file(): continue
        rel=path.relative_to(root)
        if any(part in {'node_modules','dist','build','test-results','.git','.gradle','.idea','.cxx','coverage','__pycache__'} for part in rel.parts): continue
        if path.name.startswith('.env') and path.name not in {'.env.example','.env.mobile'}: continue
        if path.name == 'local.properties': continue
        if rel.as_posix().startswith('frontend/android/app/src/main/assets/public/'): continue
        if path.suffix in {'.zip','.log','.apk','.aab','.jks','.keystore'}: continue
        files.append(path)
output=root/'exports'/'source'
output.mkdir(parents=True,exist_ok=True)
archive=output/Path(name).name
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=9) as out:
    for file in sorted(set(files)): out.write(file,'BookMarket/'+file.relative_to(root).as_posix())
with ZipFile(archive) as out:
    assert out.testzip() is None
    for file in set(files): assert out.read('BookMarket/'+file.relative_to(root).as_posix())==file.read_bytes()
print(f'{archive}: {archive.stat().st_size} bytes, {len(set(files))} files, CRC/content verified')
