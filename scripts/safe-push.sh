#!/usr/bin/env bash
# 서비스/허브 저장소에 안전하게 커밋·push 한다. 여러 저장소를 한꺼번에 고칠 때 반드시 이 순서를 지킨다.
# 사용: bash scripts/safe-push.sh <저장소 폴더> <커밋 메시지 파일>
# 멈추는 경우(종료코드 1): 원격이 앞서 있음 / 충돌 표시 있음 / 공백 오류 / 변경 없음 / 충돌 상태(unmerged) 파일 있음
# 이전에 `git stash pop` 충돌 상태에서 `git add -A` 로 충돌 표시가 그대로 push 된 사고가 있어 만든 스크립트.
set -euo pipefail
dir="${1:?저장소 폴더}"; msg="${2:?커밋 메시지 파일}"
cd "$dir"
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse FETCH_HEAD)" ]; then
  echo "✋ $dir: 원격 main 이 앞서 있습니다. 변경을 stash 하지 말고, 먼저 git merge --ff-only FETCH_HEAD 후 다시 수정하거나 rebase 하세요."; exit 1; fi
if [ -n "$(git diff --name-only --diff-filter=U)" ]; then echo "✋ $dir: 충돌 상태(unmerged) 파일이 있습니다."; exit 1; fi
if grep -rnE '^(<<<<<<<|>>>>>>>)' --include=*.html --include=*.css --include=*.js --include=*.json --include=*.md . 2>/dev/null | grep -v '^./.git/' | grep -q .; then
  echo "✋ $dir: 충돌 표시(<<<<<<< / >>>>>>>)가 있습니다."; exit 1; fi
if git diff --check | grep -q .; then echo "✋ $dir: git diff --check 경고"; git diff --check | head -5; exit 1; fi
git add -A
if git diff --cached --quiet; then echo "✋ $dir: 커밋할 변경이 없습니다."; exit 1; fi
git -c user.name="${GIT_AUTHOR_NAME:-arenarun23}" -c user.email="${GIT_AUTHOR_EMAIL:-ahsa2000@usedu.ai.kr}" commit -q -F "$msg"
# 네트워크·서버 일시 오류는 재시도(2s,4s,8s,16s). 원격이 앞서 있어 거절된 경우(non-fast-forward)만 재시도해도 소용없으므로 즉시 실패시킨다.
for wait in 0 2 4 8 16; do
  [ "$wait" -gt 0 ] && { echo "…push 재시도(${wait}초 대기)"; sleep "$wait"; }
  if out=$(git push -u origin main 2>&1); then echo "$out" | tail -1; ok=1; break; fi
  echo "$out" | grep -qE "non-fast-forward|fetch first|Updates were rejected" && { echo "$out" | tail -3; echo "✋ $dir: push 거절됨(원격 변경 확인 필요)"; exit 1; }
done
[ "${ok:-0}" = 1 ] || { echo "✋ $dir: push 실패(재시도 소진)"; exit 1; }
echo "✔ $dir $(git rev-parse --short HEAD)"
