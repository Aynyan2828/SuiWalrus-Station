#!/bin/bash
# SuiWalrus Station を起動する（Finder でダブルクリック可）
# Windows の「Suiwalrus station起動.bat」の Mac 版
export PATH="/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$HOME/.local/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")" || exit 1
echo "Suiwalrus Station ば起動しよるばい... 🐋"
npm run tauri dev
