"""Cut clean RGBA sprites out of the green-screen sheets.
Chroma key (soft alpha) -> despill -> connected components -> group per grid cell
-> 1px alpha erode (no halos) -> crop. Walk frames share one canvas size and baseline.
Usage: python tools/extract_sprites.py public/character
"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = sys.argv[1] if len(sys.argv) > 1 else "public/character"

def key(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = g - np.maximum(r, b)              # how "green-screen" a pixel is
    alpha = np.clip(1.0 - (green - 25.0) / 70.0, 0, 1)
    # despill: never let green exceed the brighter of r/b
    g2 = np.minimum(g, np.maximum(r, b) * 1.02)
    rgb = np.stack([r, g2, b], -1)
    return rgb, alpha

def components(alpha, min_area):
    solid = alpha > 0.5
    solid = ndimage.binary_opening(solid, iterations=1)
    lab, n = ndimage.label(solid)
    objs = ndimage.find_objects(lab)
    areas = ndimage.sum(solid, lab, range(1, n + 1))
    comps = []
    for i, (sl, ar) in enumerate(zip(objs, areas)):
        if ar < min_area: continue
        cy = (sl[0].start + sl[0].stop) / 2; cx = (sl[1].start + sl[1].stop) / 2
        comps.append(dict(id=i + 1, sl=sl, cx=cx, cy=cy, area=ar))
    return lab, comps

def cut(rgb, alpha, lab, ids, pad=6):
    m = np.isin(lab, ids)
    m = ndimage.binary_fill_holes(m)
    m = ndimage.binary_dilation(m, iterations=2)  # keep the soft dark outline edge
    a = alpha * m
    a = ndimage.grey_erosion(a, size=(2, 2))       # shave 1px fringe -> no halo
    a[a < 0.08] = 0
    ys, xs = np.nonzero(a)
    y0, y1, x0, x1 = ys.min() - pad, ys.max() + pad + 1, xs.min() - pad, xs.max() + pad + 1
    y0, x0 = max(y0, 0), max(x0, 0)
    out = np.dstack([rgb, a * 255])[y0:y1, x0:x1]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA"), (x0, y0, x1, y1)

def grid_groups(comps, W, H, cols, rows):
    cells = {}
    for c in comps:
        col = min(int(c["cx"] / (W / cols)), cols - 1); row = min(int(c["cy"] / (H / rows)), rows - 1)
        cells.setdefault((row, col), []).append(c)
    return cells

os.makedirs(OUT, exist_ok=True)
meta = {}

# ---- gesture sheet: 3 cols x 4 rows ----
GEST = ["present_board", "read_book", "idea", "chart", "tablet", "confused",
        "laptop_sit", "star_board", "thinking", "shocked_wave", "explain", "hold_sign"]
rgb, al = key(os.path.join(OUT, "sheet_gestures.jpg"))
H, W = al.shape
lab, comps = components(al, 60)
cells = grid_groups(comps, W, H, 3, 4)
for (row, col), cs in sorted(cells.items()):
    name = GEST[row * 3 + col]
    img, box = cut(rgb, al, lab, [c["id"] for c in cs])
    img.save(os.path.join(OUT, f"{name}.png")); meta[name] = dict(w=img.width, h=img.height)

# ---- walk sheet: 4 cols x 4 rows; rows 1 and 3 are the neutral-face cycle ----
rgb, al = key(os.path.join(OUT, "sheet_walk.jpg"))
H, W = al.shape
lab, comps = components(al, 60)
cells = grid_groups(comps, W, H, 4, 4)
frames = []
for row in (0, 2):
    for col in range(4):
        cs = cells[(row, col)]
        main = max(cs, key=lambda c: c["area"])
        ids = [c["id"] for c in cs if c is main or c["area"] > 300]
        img, box = cut(rgb, al, lab, ids, pad=0)
        frames.append(img)
# common canvas: center horizontally on the head-ish column, align feet to one baseline
cw = max(f.width for f in frames) + 16; ch = max(f.height for f in frames) + 16
for i, f in enumerate(frames):
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.paste(f, ((cw - f.width) // 2, ch - 8 - f.height), f)
    canvas.save(os.path.join(OUT, f"walk_{i + 1}.png")); meta[f"walk_{i + 1}"] = dict(w=cw, h=ch)

# idle astronaut = walk_1 neutral standing pose stand-in; sit = laptop pose
Image.open(os.path.join(OUT, "walk_1.png")).save(os.path.join(OUT, "astronaut.png")); meta["astronaut"] = meta["walk_1"]
Image.open(os.path.join(OUT, "laptop_sit.png")).save(os.path.join(OUT, "astronaut_sit.png")); meta["astronaut_sit"] = meta["laptop_sit"]

# expression heads: largest connected blob of a pose (drops ?, !, bulbs), top ~60% = helmet+face
HEADS = {"head_surprised": "shocked_wave", "head_dizzy": "confused", "head_happy": "hold_sign",
         "head_thinking": "thinking", "head_idea": "idea", "head_neutral": "read_book"}
for hname, src in HEADS.items():
    im = Image.open(os.path.join(OUT, f"{src}.png"))
    arr = np.asarray(im).copy()
    lab, n = ndimage.label(arr[..., 3] > 40)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = ndimage.binary_dilation(lab == (np.argmax(sizes) + 1), iterations=2)
    arr[..., 3] = arr[..., 3] * keep
    ys, xs = np.nonzero(arr[..., 3])
    top = ys.min(); hh = int((ys.max() - top) * 0.60)
    band = arr[top:top + hh]
    # helmet is the widest part of the band: take columns of the dominant run in the lower helmet rows
    row_cols = np.nonzero(band[int(hh * 0.55):int(hh * 0.75), :, 3].max(0) > 0)[0]
    runs = np.split(row_cols, np.where(np.diff(row_cols) > 3)[0] + 1)
    run = max(runs, key=len)
    x0, x1 = max(run[0] - 6, 0), run[-1] + 7
    head = Image.fromarray(band[:, x0:x1], "RGBA")
    head.save(os.path.join(OUT, f"{hname}.png")); meta[hname] = dict(w=head.width, h=head.height)

# foot anchor: horizontal centroid of the lowest 10% of opaque rows (props sit higher)
for name in list(meta):
    a = np.asarray(Image.open(os.path.join(OUT, f"{name}.png")))[..., 3].astype(np.float32)
    ys = np.nonzero(a.max(1) > 40)[0]
    y1 = ys.max(); y0 = int(y1 - (y1 - ys.min()) * 0.10)
    band = a[y0:y1 + 1]
    xs = np.arange(a.shape[1])
    meta[name]["footX"] = round(float((band.sum(0) * xs).sum() / band.sum() / a.shape[1]), 4)
    meta[name]["footY"] = round(float(1 - (y1 + 1) / a.shape[0]), 4)

json.dump(meta, open(os.path.join(OUT, "sprites.json"), "w"), indent=1)
print(json.dumps(meta))
