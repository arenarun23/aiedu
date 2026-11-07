"""허브 dist 위에 로컬 앱 작업본(/home/user/<앱>)을 얹은 시험 사이트를 만든다. 사용: python3 scripts/security/make-test-site.py <출력 폴더>"""
import os, shutil, subprocess, sys

out = sys.argv[1]
if os.path.isdir(out):
    shutil.rmtree(out)
shutil.copytree('/home/user/aiedu/dist', out)
EXCLUDE = ['.git', '.github', '.claude', 'CLAUDE.md', 'README.md', 'vercel.json', 'package.json']
for app in ['flagmap', 'hangul', 'hanja', 'calcul', 'word', 'game', 'miro']:
    dst = f'{out}/{app}'
    shutil.rmtree(dst, ignore_errors=True)
    os.makedirs(dst)
    args = ['tar', '-C', f'/home/user/{app}', '-cf', '-'] + [f'--exclude={x}' for x in EXCLUDE] + ['.']
    p1 = subprocess.Popen(args, stdout=subprocess.PIPE)
    subprocess.run(['tar', '-C', dst, '-xf', '-'], stdin=p1.stdout, check=True)
    p1.wait()
print('시험 사이트:', out)
