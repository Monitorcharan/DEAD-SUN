import subprocess
import os
import cv2

FFMPEG = r'C:\Users\cteja\AppData\Local\Programs\Python\Python311\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
BUILD_DIR = 'trailer_build'

clips = [
    'clip1_monolith.mp4',
    'clip2_visor.mp4',
    'clip3_transmission.mp4',
    'clip4_shade_dash.mp4',
    'clip5_sprint.mp4',
    'clip6_danger_climax.mp4',
    'clip7_terminal.mp4',
    'clip9_title.mp4'
]

list_path = os.path.join(BUILD_DIR, 'clips.txt')
with open(list_path, 'w', encoding='utf-8') as f:
    for c in clips:
        f.write(f"file '{c}'\n")

raw_video = os.path.join(BUILD_DIR, 'stitched_video.mp4')
final_output = 'THE_RED_SUN_OFFICIAL_TRAILER.mp4'
soundtrack = 'trailer_assets/trailer_soundtrack.mp3'

# 1. Stitch video
cmd_stitch = [
    FFMPEG, '-f', 'concat', '-safe', '0', '-i', list_path,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
    '-pix_fmt', 'yuv420p', raw_video, '-y'
]
subprocess.run(cmd_stitch, check=True)

# 2. Get duration of stitched video
cap = cv2.VideoCapture(raw_video)
dur = cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS)
cap.release()
print(f'Stitched video duration: {dur:.2f}s')

# 3. Mux with soundtrack, fade in at start, fade out at end
cmd_mux = [
    FFMPEG, '-i', raw_video, '-i', soundtrack,
    '-t', str(dur),
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '256k',
    '-af', f'afade=t=in:st=0:d=1.5,afade=t=out:st={dur-3.0}:d=3.0',
    final_output, '-y'
]
subprocess.run(cmd_mux, check=True)
print(f'Successfully built {final_output}!')
