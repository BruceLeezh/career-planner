#!/bin/bash
# 合成演示视频：9 段 webm + 旁白 mp3 → 04-提交材料/职引-演示视频.mp4
set -e
cd "$(dirname "$0")"
RAW=04-提交材料/video-raw
NAR=04-提交材料/narration
TMP=04-提交材料/video-mp4
OUT=04-提交材料/职引-演示视频.mp4
mkdir -p "$TMP"
rm -f "$TMP"/*.mp4

for i in 1 2 3 4 5 6 7 8 9; do
  # 视频统一 1280x720 30fps h264，音频 aac；视频比音频长约 0.8s → apad 补静音后以视频长度为准
  ffmpeg -y -loglevel error -i "$RAW/seg$i.webm" -i "$NAR/seg$i.mp3" \
    -vf "scale=1280:720,fps=30,format=yuv420p" \
    -af "apad" -c:v libx264 -preset fast -crf 21 -c:a aac -b:a 128k -shortest \
    "$TMP/part$i.mp4"
  echo "part$i ok"
done

# concat（相对 list.txt 所在目录，只写文件名）
printf "file 'part%d.mp4'\n" 1 2 3 4 5 6 7 8 9 > "$TMP/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -c copy "$OUT"
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT"
