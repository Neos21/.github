#!/usr/bin/env bash


# ================================================================================
# Setup
# 
# 雛形ファイルを置きたいディレクトリから `$ ../_github/setup.bash` と呼び出す
# ================================================================================


# 実行確認
function confirm() {
  local message="$1"  # 第1引数で任意のメッセージに変えられるようにする
  if [ -z "${message}" ]; then message='実行してよろしいですか？'; fi
  local confirm
  while :; do  # 未入力は許可しない
    read -p "${message} (y/N) : " confirm
    if [ -n "${confirm}" ]; then break; fi
  done
  confirm="${confirm:0:1}"  # 先頭1文字が `y`・`Y` でなければエラー扱いにする
  if [ "${confirm}" != 'y' -a "${confirm}" != 'Y' ]; then return 1; fi
}

# この Bash ファイルを起点とした Templates ディレクトリのフルパス
src_dir="$(cd "$(dirname "$0")/templates" ; pwd)"
# 呼び出し元であるディレクトリのフルパス
dst_dir="$(pwd)"

echo 'Setup'
echo "  Source Directory Path : ${src_dir}"
echo "  Dest   Directory Path : ${dst_dir}"
echo ''
if ! confirm 'セットアップ作業を開始しますか？'; then
  echo ''
  echo '終了します'
  exit 1
fi


# ファイルをコピーしていく
# ================================================================================

# ルート直下のファイルをコピーする
function copy_root_file() {
  local file_name="$1"
  if confirm "[${file_name}] Copy ?"; then
    cp -i "${src_dir}/${file_name}" "${dst_dir}/${file_name}"
    echo "[${file_name}] Copied!"
  else
    echo "[${file_name}] Skipped"
  fi
  echo ''
}

# サブディレクトリを作ってコピーする
function copy_sub_dir_file() {
  local sub_dir="$1"
  local file_name="$2"
  if confirm "[${sub_dir}/${file_name}] Copy ?"; then
    mkdir -p "${dst_dir}/${sub_dir}"
    cp -i "${src_dir}/${sub_dir}/${file_name}" "${dst_dir}/${sub_dir}/${file_name}"
    echo "[${sub_dir}/${file_name}] Copied!"
  else
    echo "[${sub_dir}/${file_name}] Skipped"
  fi
  echo ''
}

echo ''
copy_root_file '.gitignore'
copy_root_file 'README.md'
copy_sub_dir_file '.github' 'FUNDING.yml'

copy_root_file 'package.json'

copy_root_file 'LICENSE'
copy_root_file '.npmignore'
copy_sub_dir_file '.github/workflows' 'publish-to-gpr.yaml'
copy_sub_dir_file '.github/workflows' 'publish-to-npm.yaml'
copy_sub_dir_file '.github/workflows' 'deploy-to-github-pages.yaml'

echo 'Finished'
