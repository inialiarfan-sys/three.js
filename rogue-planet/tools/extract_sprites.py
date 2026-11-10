"""Cut Luna's sprites out of the character sheets.

    pip install "rembg[cpu]" pillow numpy scipy
    python tools/extract_sprites.py

Per sheet: 2x Lanczos upscale -> soft green-screen key fused with rembg (isnet-anime)
-> connected components on the alpha mask (characters = big blobs; labels, stars,
hearts, "!", "?", puffs etc. are small blobs and are dropped) -> despill + defringe
(edge pixels take the colour of their opaque neighbours, so no white/green halos)
-> 20 px transparent padding. Writes public/character/*.png, sprites.json, preview.png.

Sheets (all on green):
  sheet_new.png       4x4 emotion poses (main source)
  sheet_gestures.jpg  3x4 gesture poses (waving, thinking, ...)
  sheet_walk.jpg      4x4 walk frames (only frame 1 is used, as the side view)
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CH = os.path.join(ROOT, "public", "character")
PAD = 20
USE_REMBG = "--no-rembg" not in sys.argv

session = None
if USE_REMBG:
    try:
        from rembg import new_session, remove
        session = new_session("isnet-anime")
    except Exception as e:  # rembg is optional; the green key alone is clean on these sheets
        print("rembg unavailable, using green key only:", e)

def load2x(name):
    im = Image.open(os.path.join(CH, name)).convert("RGB")
    return im.resize((im.width * 2, im.height * 2), Image.LANCZOS)

def green_alpha(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = g - np.maximum(r, b)
    return np.clip(1.0 - (green - 30.0) / 70.0, 0, 1)

def characters(alpha, min_frac=0.25):
    solid = ndimage.binary_opening(alpha > 0.5, iterations=2)
    lab, n = ndimage.label(solid)
    areas = ndimage.sum(solid, lab, range(1, n + 1))
    big = areas.max()
    keep = [i + 1 for i, a in enumerate(areas) if a >= big * min_frac]
    objs = ndimage.find_objects(lab)
    out = []
    for i in keep:
        sl = objs[i - 1]
        out.append(dict(id=i, y0=sl[0].start, y1=sl[0].stop, x0=sl[1].start, x1=sl[1].stop,
                        cy=(sl[0].start + sl[0].stop) / 2, cx=(sl[1].start + sl[1].stop) / 2))
    # reading order: cluster rows by centre y, then sort by x
    out.sort(key=lambda c: c["cy"])
    rows, cur = [], []
    for c in out:
        if cur and c["cy"] - cur[-1]["cy"] > (c["y1"] - c["y0"]) * 0.5:
            rows.append(sorted(cur, key=lambda k: k["cx"])); cur = []
        cur.append(c)
    if cur: rows.append(sorted(cur, key=lambda k: k["cx"]))
    return lab, rows

def defringe(rgb, alpha):
    """Edge pixels (alpha < 0.95) get the mean colour of nearby opaque pixels."""
    solid = alpha > 0.95
    w = ndimage.uniform_filter(solid.astype(np.float32), 7)
    out = rgb.copy()
    for c in range(3):
        s = ndimage.uniform_filter(rgb[..., c] * solid, 7)
        fill = np.where(w > 1e-3, s / np.maximum(w, 1e-3), rgb[..., c])
        out[..., c] = np.where(alpha < 0.95, fill, rgb[..., c])
    return out

def cut(img, lab, comp, margin=24):
    a = np.asarray(img).astype(np.float32)
    H, W = a.shape[:2]
    y0, y1 = max(comp["y0"] - margin, 0), min(comp["y1"] + margin, H)
    x0, x1 = max(comp["x0"] - margin, 0), min(comp["x1"] + margin, W)
    crop = a[y0:y1, x0:x1]
    mask = lab[y0:y1, x0:x1] == comp["id"]
    mask = ndimage.binary_fill_holes(mask)                      # keep see-through helmet interior
    keep = ndimage.binary_dilation(mask, iterations=3)          # soft outline edge
    alpha = green_alpha(crop) * keep
    if session is not None:
        r = np.asarray(remove(Image.fromarray(crop.astype(np.uint8)), session=session, only_mask=True)).astype(np.float32) / 255
        core = ndimage.binary_erosion(mask, iterations=6)       # rembg may only trim edges, never the body
        alpha = alpha * np.maximum(r, core)
    # despill green, then defringe edges, then shave a hair of fringe
    rgb = crop.copy()
    rgb[..., 1] = np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]) * 1.02)
    rgb = defringe(rgb, alpha)
    alpha = ndimage.grey_erosion(alpha, size=(2, 2))
    alpha[alpha < 0.06] = 0
    ys, xs = np.nonzero(alpha > 0)
    rgb, alpha = rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    out = np.zeros((alpha.shape[0] + 2 * PAD, alpha.shape[1] + 2 * PAD, 4), np.uint8)
    out[PAD:-PAD, PAD:-PAD, :3] = np.clip(rgb, 0, 255)
    out[PAD:-PAD, PAD:-PAD, 3] = np.clip(alpha * 255, 0, 255)
    return Image.fromarray(out, "RGBA")

sprites, meta = {}, {}
def save(name, im, note=""):
    im.save(os.path.join(CH, name + ".png")); sprites[name] = im
    a = np.asarray(im)[..., 3].astype(np.float32)
    ys = np.nonzero(a.max(1) > 40)[0]
    y1 = ys.max(); y0 = int(y1 - (y1 - ys.min()) * 0.1)
    band = a[y0:y1 + 1]; xs = np.arange(a.shape[1])
    meta[name] = dict(w=im.width, h=im.height, footX=round(float((band.sum(0) * xs).sum() / band.sum() / a.shape[1]), 4),
                      footY=round(float(1 - (y1 + 1) / a.shape[0]), 4), bodyH=int(y1 - ys.min()), note=note)

# --- emotion sheet ---
img = load2x("sheet_new.png")
lab, rows = characters(green_alpha(np.asarray(img).astype(np.float32)))
grid = [c for r in rows for c in r]
assert len(grid) == 16, f"expected 16 poses on sheet_new.png, found {len(grid)}"
NEW = ["crossed_arms", "pout", "scared", "excited_pose", "sad_pose", "crying_pose", "gloomy", "nervous",
       "surprised_pose", "confused_pose", "sleepy_pose", "love", "cheering", "shy", "pointing", "grumpy"]
cut_new = {n: cut(img, lab, c) for n, c in zip(NEW, grid)}

# --- gestures sheet (old) ---
img2 = load2x("sheet_gestures.jpg")
lab2, rows2 = characters(green_alpha(np.asarray(img2).astype(np.float32)), 0.35)
g2 = [c for r in rows2 for c in r]
OLD = ["present_board", "read_book", "idea", "chart", "tablet", "confused_old", "laptop_sit", "star_board",
       "thinking", "waving", "explain", "hold_sign"]
cut_old = {n: cut(img2, lab2, c) for n, c in zip(OLD, g2)}

# --- walk sheet: frame 1 = side view ---
img3 = load2x("sheet_walk.jpg")
lab3, rows3 = characters(green_alpha(np.asarray(img3).astype(np.float32)), 0.35)
side = cut(img3, lab3, rows3[0][0])

# files named as the brief asks
save("astronaut", side, "walk sheet frame 1: 3/4 view, used for hopping (flip for direction)")
save("side", side, "same as astronaut")
save("side_other", side.transpose(Image.FLIP_LEFT_RIGHT), "mirrored side")
save("front", cut_new["surprised_pose"], "front-facing, hands together")
save("astronaut_sit", cut_new["sleepy_pose"], "kneeling / resting pose")
save("laptop_sit", cut_old["laptop_sit"], "sitting with laptop (alt)")
for n in ["crossed_arms", "pointing", "cheering", "shy"]: save(n, cut_new[n])
save("proud", cut_new["pointing"], "sunglasses + pointing")
save("waving", cut_old["waving"], "from gestures sheet")
save("thinking", cut_old["thinking"], "from gestures sheet")
save("thumbs_up", cut_new["cheering"], "no thumbs-up pose on the sheets: cheering used")
save("peace", cut_new["excited_pose"], "no peace-sign pose on the sheets: excited used")
for n in ["scared", "nervous", "gloomy", "crying_pose", "sad_pose", "excited_pose", "confused_pose", "surprised_pose", "grumpy", "love"]:
    save(n, cut_new[n])

# expression heads: top part of a pose's main blob, for reaction bubbles
HEADS = {"happy": "cheering", "excited": "excited_pose", "angry": "crossed_arms", "sad": "sad_pose",
         "surprised": "surprised_pose", "embarrassed": "shy", "crying": "crying_pose", "sleepy": "sleepy_pose",
         "confused": "confused_pose", "dizzy": "scared", "thinking": "thinking", "neutral": "nervous"}
for h, src in HEADS.items():
    im = cut_new.get(src) or cut_old.get(src)
    arr = np.asarray(im).copy()
    l, n = ndimage.label(arr[..., 3] > 40)
    sizes = ndimage.sum(np.ones_like(l), l, range(1, n + 1))
    keepm = ndimage.binary_dilation(l == (np.argmax(sizes) + 1), iterations=2)
    arr[..., 3] = (arr[..., 3] * keepm).astype(np.uint8)
    ys, xs = np.nonzero(arr[..., 3])
    top = ys.min(); hh = int((ys.max() - top) * 0.7)
    band = arr[top:top + hh]
    cols = np.nonzero(band[int(hh * .55):int(hh * .75), :, 3].max(0) > 0)[0]
    runs = np.split(cols, np.where(np.diff(cols) > 3)[0] + 1); run = max(runs, key=len)
    head = band[:, max(run[0] - 8, 0):run[-1] + 9]
    padded = np.zeros((head.shape[0] + 2 * PAD, head.shape[1] + 2 * PAD, 4), np.uint8); padded[PAD:-PAD, PAD:-PAD] = head
    save("head_" + h, Image.fromarray(padded, "RGBA"), f"from {src}")

# missing from the sheets -> runtime fallbacks (see README)
meta["_missing"] = {"casual": "astronaut used (no casual outfit on the sheets)",
                    "winter": "3D puffy toon jacket built in code around astronaut",
                    "back": "astronaut_sit drawn as a dark rim-lit silhouette for the stargazing shot"}
json.dump(meta, open(os.path.join(CH, "sprites.json"), "w"), indent=1)

# --- preview.png ---
names = [k for k in sprites]
cols, cell = 7, 300
rows_n = (len(names) + cols - 1) // cols
pv = Image.new("RGBA", (cols * cell, rows_n * (cell + 40)), (15, 20, 56, 255))
d = ImageDraw.Draw(pv)
try: font = ImageFont.truetype("DejaVuSans-Bold.ttf", 20)
except Exception: font = ImageFont.load_default()
for i, n in enumerate(names):
    im = sprites[n]; s = min((cell - 20) / im.width, (cell - 20) / im.height)
    t = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    x, y = (i % cols) * cell, (i // cols) * (cell + 40)
    pv.alpha_composite(t, (x + (cell - t.width) // 2, y + (cell - t.height) // 2))
    d.text((x + cell // 2, y + cell + 8), n, fill=(255, 236, 210, 255), font=font, anchor="ma")
pv.convert("RGB").save(os.path.join(CH, "preview.png"))
print(f"{len(sprites)} sprites -> {CH}")
