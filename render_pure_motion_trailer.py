import cv2
import numpy as np
import os
import subprocess

FFMPEG = r'C:\Users\cteja\AppData\Local\Programs\Python\Python311\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe'
BUILD_DIR = 'trailer_build_mg'
os.makedirs(BUILD_DIR, exist_ok=True)

TARGET_W = 1920
TARGET_H = 1080
LETTERBOX = 140

def apply_letterbox(frame):
    frame[:LETTERBOX, :] = 0
    frame[-LETTERBOX:, :] = 0
    return frame

def make_clip1_walk(out_path, dur=7.0, fps=30):
    img = cv2.imread('trailer_assets/shot1_walk_moon.jpg')
    h, w = img.shape[:2]
    total_frames = int(dur * fps)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(out_path, fourcc, fps, (TARGET_W, TARGET_H))
    
    for i in range(total_frames):
        t = i / total_frames
        # Slow horizontal tracking pan with subtle push-in
        zoom = 1.0 + 0.08 * t
        pan_x = int(0.06 * w * t)
        
        crop_w = int(w / zoom)
        crop_h = int(h / zoom)
        
        x1 = max(0, min(w - crop_w, (w - crop_w)//2 + pan_x))
        y1 = max(0, min(h - crop_h, (h - crop_h)//2))
        
        cropped = img[y1:y1+crop_h, x1:x1+crop_w]
        frame = cv2.resize(cropped, (TARGET_W, TARGET_H), interpolation=cv2.INTER_LANCZOS4)
        
        # Subtle dust motes/atmosphere (faint floaters)
        if i % 2 == 0:
            noise = np.random.normal(0, 1.2, frame.shape).astype(np.float32)
            frame = np.clip(frame.astype(np.float32) + noise, 0, 255).astype(np.uint8)
            
        out.write(apply_letterbox(frame))
    out.release()
    print("Clip 1 generated: Walk on Moon")

def make_clip2_stop(out_path, dur=4.5, fps=30):
    img = cv2.imread('trailer_assets/shot2_stop.jpg')
    h, w = img.shape[:2]
    total_frames = int(dur * fps)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(out_path, fourcc, fps, (TARGET_W, TARGET_H))
    
    for i in range(total_frames):
        t = i / total_frames
        # Quick zoom to halt
        zoom = 1.0 + 0.06 * (1 - np.exp(-3.5 * t))
        crop_w = int(w / zoom)
        crop_h = int(h / zoom)
        
        x1 = (w - crop_w) // 2
        y1 = int((h - crop_h) * 0.4) # Slightly tilt up toward helmet
        
        cropped = img[y1:y1+crop_h, x1:x1+crop_w]
        frame = cv2.resize(cropped, (TARGET_W, TARGET_H), interpolation=cv2.INTER_LANCZOS4)
        
        # Red ambient glow creeps in after halfway
        if t > 0.45:
            red_intensity = (t - 0.45) / 0.55 * 35.0
            red_overlay = np.zeros_like(frame, dtype=np.float32)
            red_overlay[:, :, 2] = red_intensity # BGR red channel
            frame = np.clip(frame.astype(np.float32) + red_overlay, 0, 255).astype(np.uint8)
            
        out.write(apply_letterbox(frame))
    out.release()
    print("Clip 2 generated: Astronaut Stops & Red Creep")

def make_clip3_arises(out_path, dur=8.5, fps=30):
    img = cv2.imread('trailer_assets/shot3_arises.jpg')
    h, w = img.shape[:2]
    total_frames = int(dur * fps)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(out_path, fourcc, fps, (TARGET_W, TARGET_H))
    
    for i in range(total_frames):
        t = i / total_frames
        # Smooth pedestal tilt: starts lower showing the terrain, tilts up to reveal the massive rising sun
        tilt_y = (1.0 - t) * 0.15 # start lower, pan up
        zoom = 1.05 + 0.12 * t
        
        crop_w = int(w / zoom)
        crop_h = int(h / zoom)
        
        x1 = (w - crop_w) // 2
        y1 = max(0, min(h - crop_h, int(h * tilt_y)))
        
        cropped = img[y1:y1+crop_h, x1:x1+crop_w]
        frame = cv2.resize(cropped, (TARGET_W, TARGET_H), interpolation=cv2.INTER_LANCZOS4)
        
        # Heat wave shimmer / micro vibration as the sun rises
        if t > 0.4:
            shake = np.sin(i * 0.4) * (t * 2.5)
            M = np.float32([[1, 0, 0], [0, 1, shake]])
            frame = cv2.warpAffine(frame, M, (TARGET_W, TARGET_H))
            
        out.write(apply_letterbox(frame))
    out.release()
    print("Clip 3 generated: Red Giant Arises So Big")

def make_clip4_runs(out_path, dur=8.0, fps=30):
    img = cv2.imread('trailer_assets/shot4_run.jpg')
    h, w = img.shape[:2]
    total_frames = int(dur * fps)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(out_path, fourcc, fps, (TARGET_W, TARGET_H))
    
    for i in range(total_frames):
        t = i / total_frames
        # Dynamic running camera: zoom out + intense camera footsteps rumble
        step_phase = i * 0.8
        step_bob_y = np.sin(step_phase) * 5.0
        step_bob_x = np.cos(step_phase * 0.5) * 3.5
        
        zoom = 1.0 + 0.14 * (t ** 0.8)
        crop_w = int(w / zoom)
        crop_h = int(h / zoom)
        
        x1 = max(0, min(w - crop_w, int((w - crop_w)//2 + step_bob_x)))
        y1 = max(0, min(h - crop_h, int((h - crop_h)//2 + step_bob_y)))
        
        cropped = img[y1:y1+crop_h, x1:x1+crop_w]
        frame = cv2.resize(cropped, (TARGET_W, TARGET_H), interpolation=cv2.INTER_LANCZOS4)
        
        out.write(apply_letterbox(frame))
    out.release()
    print("Clip 4 generated: Astronaut Running in Terror")

def make_clip5_fast_camera(out_path, dur=6.0, fps=30):
    img = cv2.imread('trailer_assets/shot5_fast_camera.jpg')
    h, w = img.shape[:2]
    total_frames = int(dur * fps)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(out_path, fourcc, fps, (TARGET_W, TARGET_H))
    
    for i in range(total_frames):
        t = i / total_frames
        # Exponential speed acceleration: rushing forward into the center flare
        zoom = 1.0 + 0.65 * (t ** 2.2)
        crop_w = int(w / zoom)
        crop_h = int(h / zoom)
        
        # Wild camera shake as speed reaches hypersonic
        rumble = (t ** 2.0) * 8.0
        rx = np.random.uniform(-rumble, rumble)
        ry = np.random.uniform(-rumble, rumble)
        
        x1 = max(0, min(w - crop_w, int((w - crop_w)//2 + rx)))
        y1 = max(0, min(h - crop_h, int((h - crop_h)//2 + ry)))
        
        cropped = img[y1:y1+crop_h, x1:x1+crop_w]
        frame = cv2.resize(cropped, (TARGET_W, TARGET_H), interpolation=cv2.INTER_LANCZOS4)
        
        # Climax blinding white-hot flash on the final 0.6 seconds
        if t > 0.85:
            flash_p = (t - 0.85) / 0.15
            white = np.full_like(frame, 255)
            frame = cv2.addWeighted(frame, 1.0 - flash_p, white, flash_p, 0)
            
        out.write(apply_letterbox(frame))
    out.release()
    print("Clip 5 generated: Fast Moving Camera Rush & Flash")

def make_clip6_logo(out_path, dur=10.0, fps=30):
    img = cv2.imread('trailer_assets/logo_widescreen.jpg')
    h, w = img.shape[:2]
    total_frames = int(dur * fps)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(out_path, fourcc, fps, (TARGET_W, TARGET_H))
    
    for i in range(total_frames):
        t = i / total_frames
        
        # Start from high-speed snap-in out of the white flash
        if t < 0.12:
            snap_t = t / 0.12
            # Rapid backward snap zoom: 1.35 down to 1.0
            zoom = 1.35 - 0.35 * (snap_t ** 0.5)
            # Fade out from white flash
            flash_remain = 1.0 - snap_t
        else:
            # Majestic slow cinematic breathe / drift
            drift_t = (t - 0.12) / 0.88
            zoom = 1.0 + 0.05 * drift_t
            flash_remain = 0.0
            
        crop_w = int(w / zoom)
        crop_h = int(h / zoom)
        x1 = (w - crop_w) // 2
        y1 = (h - crop_h) // 2
        
        cropped = img[y1:y1+crop_h, x1:x1+crop_w]
        frame = cv2.resize(cropped, (TARGET_W, TARGET_H), interpolation=cv2.INTER_LANCZOS4)
        
        # Apply remaining flash fade
        if flash_remain > 0:
            white = np.full_like(frame, 255)
            frame = cv2.addWeighted(frame, 1.0 - flash_remain, white, flash_remain, 0)
            
        # Subtle cosmic pulse on the ring of fire
        pulse = 1.0 + 0.04 * np.sin(i * 0.25)
        
        # Fade out to black on the final 2 seconds
        if t > 0.80:
            fade_black = (t - 0.80) / 0.20
            black = np.zeros_like(frame)
            frame = cv2.addWeighted(frame, 1.0 - fade_black, black, fade_black, 0)
            
        out.write(apply_letterbox(frame))
    out.release()
    print("Clip 6 generated: Cinematic Official Logo Reveal")

if __name__ == '__main__':
    c1 = f'{BUILD_DIR}/c1_walk.mp4'
    c2 = f'{BUILD_DIR}/c2_stop.mp4'
    c3 = f'{BUILD_DIR}/c3_arises.mp4'
    c4 = f'{BUILD_DIR}/c4_runs.mp4'
    c5 = f'{BUILD_DIR}/c5_fast_cam.mp4'
    c6 = f'{BUILD_DIR}/c6_logo.mp4'
    
    make_clip1_walk(c1)
    make_clip2_stop(c2)
    make_clip3_arises(c3)
    make_clip4_runs(c4)
    make_clip5_fast_camera(c5)
    make_clip6_logo(c6)
    
    # Write concat list
    list_file = f'{BUILD_DIR}/concat_list.txt'
    with open(list_file, 'w', encoding='utf-8') as f:
        for c in ['c1_walk.mp4', 'c2_stop.mp4', 'c3_arises.mp4', 'c4_runs.mp4', 'c5_fast_cam.mp4', 'c6_logo.mp4']:
            f.write(f"file '{c}'\n")
            
    stitched_raw = f'{BUILD_DIR}/stitched_motion_graphics.mp4'
    final_output = 'THE_RED_SUN_ANIMATED_TRAILER.mp4'
    soundtrack = 'trailer_assets/trailer_soundtrack.mp3'
    
    cmd_stitch = [
        FFMPEG, '-f', 'concat', '-safe', '0', '-i', list_file,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
        '-pix_fmt', 'yuv420p', stitched_raw, '-y'
    ]
    subprocess.run(cmd_stitch, check=True)
    
    cap = cv2.VideoCapture(stitched_raw)
    dur = cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    print(f'Motion graphics stitched video duration: {dur:.2f}s')
    
    cmd_mux = [
        FFMPEG, '-i', stitched_raw, '-i', soundtrack,
        '-t', str(dur),
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '320k',
        '-af', f'afade=t=in:st=0:d=1.5,afade=t=out:st={dur-2.5}:d=2.5',
        final_output, '-y'
    ]
    subprocess.run(cmd_mux, check=True)
    print(f'SUCCESS! Official Animated Trailer created: {final_output}')
