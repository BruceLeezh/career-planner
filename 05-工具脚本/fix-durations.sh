#!/bin/bash
# 把每段 part 补齐/裁剪到精确 TARGET 时长（旁白+0.8s），输出 final-partN.mp4
set -e
cd "$(dirname "$0")"
MP4=04-提交材料/video-mp4
declare -A TARGET=( [1]=21.0 [2]=16.1 [3]=37.0 [4]=17.9 [5]=20.7 [6]=26.2 [7]=25.2 [8]=29.7 [9]=9.5 [10]=19.0 )
for i in 1 2 3 4 5 10 6 7 8 9; do
  t=${TARGET[$i]}
  d=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$MP4/part$i.mp4")
  shorter=$(node -e "console.log($t > $d ? '1' : '0')")
  if [ "$shorter" = "1" ]; then
    pad=$(node -e "console.log(($t - $d).toFixed(3))")
    ffmpeg -y -loglevel error -i "$MP4/part$i.mp4" -vf "tpad=stop_mode=clone:stop_duration=$pad" -c:v libx264 -preset fast -crf 16 "$MP4/final-part$i.mp4"
  else
    ffmpeg -y -loglevel error -i "$MP4/part$i.mp4" -t "$t" -c:v libx264 -preset fast -crf 16 "$MP4/final-part$i.mp4"
  fi
  echo "part$i: $d -> $(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $MP4/final-part$i.mp4)"
done
# 只规范化每段时长（final-partN），最终成品由 build-final.sh 一次重编码拼装（音画单时间基）
