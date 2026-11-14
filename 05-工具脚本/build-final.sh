#!/bin/bash
# 最终拼装：10 段无声视频 concat + 10 段旁白按段 apad 后 concat，一次重编码。
# 段顺序：1 2 3 4 5 10(求职准备) 6 7 8 9 —— 全片单时间基，杜绝逐段 -c copy 时间戳漂移。
# 输出 1920x1080 crf18（源为 2x DPI 2560x1440 超采样帧）。
set -e
cd "$(dirname "$0")"
MP4=04-提交材料/video-mp4
OUT="04-提交材料/高级-职引-【姓名+学工号】-演示视频.mp4"
ORDER=(1 2 3 4 5 10 6 7 8 9)
DUR=([1]=21.0 [2]=16.1 [3]=37.0 [4]=17.9 [5]=20.7 [6]=26.2 [7]=25.2 [8]=29.7 [9]=9.5 [10]=19.0)

IN=""
for i in "${ORDER[@]}"; do IN="$IN -i $MP4/final-part$i.mp4"; done
for i in "${ORDER[@]}"; do IN="$IN -i 04-提交材料/narration/seg$i.mp3"; done

NV=${#ORDER[@]}   # 10
VLAB=""; ALAB=""
for k in $(seq 0 $((NV-1))); do
  VLAB="$VLAB[$k:v]"; ALAB="$ALAB[$((NV+k)):a]"
done
FC="${VLAB}concat=n=${NV}:v=1:a=0[vc];[vc]scale=1920:1080:flags=lanczos[v]"
for k in $(seq 0 $((NV-1))); do
  seg=${ORDER[$k]}
  FC="$FC;[$((NV+k)):a]aresample=48000,apad=whole_dur=${DUR[$seg]}[a$k]"
done
ACAT=""
for k in $(seq 0 $((NV-1))); do ACAT="$ACAT[a$k]"; done
FC="$FC;${ACAT}concat=n=${NV}:v=0:a=1[a]"

ffmpeg -y -loglevel warning $IN \
  -filter_complex "$FC" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 \
  "$OUT"

echo "DUR: $(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT")"
echo "SIZE: $(du -m "$OUT" | cut -f1) MB"
