"""Jay's logo rebuilt as a posable rig: one drawing, posed by a few numbers.

The site animates this same figure live (main.js, "Logo idle animation"); keep
the two in step if the drawing changes. Still frames for review:
  python3 logo-src/rig.py <folder>
assets/logo.svg (the still logo, favicon and no-JS fallback) is the rest pose.

pose(level, look, lid, straw) -> SVG string on the original 540 x 639 canvas.
  level  y of the drink surface (193 = full, as drawn)
  look   0 = pupils left (as drawn), 1 = pupils fully right
  lid    0 = eyes open, 1 = closed
  straw  how far the straw has slid down into the drink (canvas units)
"""
import math, sys, os

# Straw: Jay's straw runs from its top opening down to the drink surface.
# Axis from the top centre (512, 11) towards (447.4, 192.4); 58 wide.
SX, SY = 512.07, 11.07
ANG = math.atan2(192.4 - 11.07, 447.4 - 512.07)          # pointing down-left
UX, UY = math.cos(ANG), math.sin(ANG)

SCLERA_L = ("M33.3336 460.225C75.3699 494.384 143.013 478.455 184.42 424.648C225.826 370.841 225.315 299.53 183.279 265.372"
            "C141.243 231.213 73.5994 247.141 32.1931 300.949C31.9697 301.239 31.7475 301.53 31.5265 301.821"
            "C4.89342 336.935 -4.01336 379.326 4.6985 413.963C9.3107 432.3 18.8611 448.465 33.3336 460.225Z")
EYE_DX = 155.758   # right eye is the left eye moved across


def pupil(dx):
    # A rounded parallelogram, the same slant as Jay's. Its left edge sits
    # outside the white at rest, so only the right part shows, as drawn.
    return (f'<path transform="translate({dx:.2f} 0)" d="M-19 301.83H129.375L103.977 396.208'
            f'C101.156 406.689 91.6527 413.972 80.7989 413.971H-44.6Z" fill="#0B091E"/>')


def eye(i, look):
    ox = EYE_DX * i
    cid = f"sclera{i}"
    # looking right: the pupil turns half way round inside the white, which is
    # how Jay drew it (the flat edge ends up along the bottom)
    turn = f' transform="rotate({180 * look:.1f} 115.2 366)"' if look else ""
    return "".join([
        f'<g transform="translate({ox:.3f} 0)" style="mix-blend-mode:hard-light">',
        f'<clipPath id="{cid}"><path d="{SCLERA_L}"/></clipPath>',
        f'<path d="{SCLERA_L}" fill="#FFFCFF"/>',
        f'<g clip-path="url(#{cid})"><g{turn}>', pupil(0), '</g></g></g>'])


def eyes(look):
    # Looking left, the right eye sits in front (as Jay drew it); looking
    # right, the left eye comes forward so its pupil isn't hidden.
    return eye(1, look) + eye(0, look) if look else eye(0, look) + eye(1, look)


def lids(lid):
    # Lids sit over the eyes in normal blending (the eyes' hard-light would
    # turn them orange): drink-brown, slightly curved lower edge, lash line.
    if lid <= 0:
        return ""
    top, bot = 245, 487
    y = top + (bot - top) * lid + (8 if lid >= 1 else 0)
    out = []
    for i in (0, 1):
        out.append(f'<g transform="translate({EYE_DX * i:.3f} 0)" clip-path="url(#sclera{i})">')
        out.append(f'<path d="M-10 {top - 10}H235V{y - 10:.1f}Q112 {y + 14:.1f} -10 {y - 10:.1f}Z" fill="url(#lid)"/>')
        if lid < 1:
            out.append(f'<path d="M-10 {y - 10:.1f}Q112 {y + 14:.1f} 235 {y - 10:.1f}" stroke="#4C2D0E" stroke-width="7" stroke-linecap="round"/>')
        out.append('</g>')
    return "".join(out)


def pose(level=193.0, look=0.0, lid=0.0, straw=0.0, sid=""):
    L = level
    # surface colour: latte while the light layer is still there, coffee once
    # the level has dropped into the dark layer
    t = min(1, max(0, (L - 395) / 40))
    mix = lambda a, b: "#" + "".join(f"{round(int(a[k:k+2],16)*(1-t)+int(b[k:k+2],16)*t):02x}" for k in (1, 3, 5))
    surface = mix("#EBD6B4", "#6B4826")
    sx, sy = SX + UX * straw, SY + UY * straw
    straw_g = (f'<g transform="translate({UX*straw:.2f} {UY*straw:.2f})">'
               # body: long enough to reach into the drink; the drink covers the rest
               f'<path d="M538.279 18.9721L345.4 560L287.4 560L485.867 3.1615Z" fill="url(#straw)"/>'
               f'<ellipse cx="3.35588" cy="27.3723" rx="3.35588" ry="27.3723" transform="matrix(0.335799 -0.941934 0.957387 0.288808 484.75 6.32812)" fill="#9F9999"/>'
               f'<ellipse cx="2.91432" cy="23.8686" rx="2.91432" ry="23.8686" transform="matrix(0.335799 -0.941934 0.957387 0.288808 488.227 7.00781)" fill="#767676"/>'
               '</g>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="540" height="639" viewBox="0 0 540 639" fill="none">
<defs>
<linearGradient id="glass" x1="34" y1="0" x2="530" y2="0" gradientUnits="userSpaceOnUse">
<stop stop-color="#C9DADD"/><stop offset=".22" stop-color="#D8E6E8"/><stop offset=".78" stop-color="#D1DFE1"/><stop offset="1" stop-color="#C4D5D8"/>
</linearGradient>
<linearGradient id="latte" x1="152.196" y1="323.496" x2="281.227" y2="546.984" gradientUnits="userSpaceOnUse">
<stop stop-color="#DFC9A6"/><stop offset="0.72959" stop-color="#E7C39E"/>
</linearGradient>
<linearGradient id="coffee" x1="411.5" y1="291.504" x2="281" y2="618.004" gradientUnits="userSpaceOnUse">
<stop stop-color="#E6C39E"/><stop offset="1" stop-color="#4C2D0E"/>
</linearGradient>
<linearGradient id="straw" x1="0" y1="0" x2="1" y2="0">
<stop stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F7F7F7"/><stop offset="1" stop-color="#E4E6E7"/>
</linearGradient>
<linearGradient id="lid" x1="0" y1="245" x2="0" y2="487" gradientUnits="userSpaceOnUse">
<stop stop-color="#9A6A3C"/><stop offset="1" stop-color="#7A5230"/>
</linearGradient>
<linearGradient id="shine" x1="0" y1="150" x2="0" y2="560" gradientUnits="userSpaceOnUse">
<stop stop-color="#FFFFFF" stop-opacity=".7"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
</linearGradient>
<clipPath id="drink">
<path d="M50.7266 {L:.2f}H511.727V550.294C511.727 587.581 408.469 617.808 281.228 617.808C153.988 617.808 50.8393 587.581 50.8393 550.294Z"/>
</clipPath>
<clipPath id="above"><rect x="0" y="0" width="540" height="{L:.2f}"/></clipPath>
<clipPath id="below"><rect x="0" y="{L:.2f}" width="540" height="{639 - L:.2f}"/></clipPath>
<mask id="rimfront" maskUnits="userSpaceOnUse" x="0" y="0" width="540" height="639"><rect x="0" y="116.963" width="540" height="40" fill="#fff"/></mask>
</defs>
<!-- ground shadows (light from the top left): a lighter cast shadow back and to the right, a dark contact shadow where the base touches -->
<ellipse cx="332" cy="590" rx="262" ry="50" fill="#1B3A5C" fill-opacity=".14"/>
<ellipse cx="291" cy="592" rx="252" ry="58" fill="#1B3A5C" fill-opacity=".34"/>
<!-- glass: body and rim -->
<path d="M529.466 576.294C529.466 610.586 418.575 638.385 281.784 638.385C144.993 638.385 34.1016 610.586 34.1016 576.294V133.448C34.1016 122.112 44.0917 112.922 56.4153 112.922H507.152C519.476 112.922 529.466 122.112 529.466 133.448Z" fill="url(#glass)"/>
<ellipse cx="281.782" cy="116.963" rx="237.641" ry="17.447" fill="#D0DFE1"/>
<ellipse cx="281.782" cy="116.963" rx="232" ry="14.6" stroke="#DAF9FC" stroke-width="5.6"/>
<!-- the glass's thick base, the floor inside, and the last drop: drawn under
     the drink, so they only show as it's drunk (flat shapes, no outlines) -->
<path d="M34.1 576.3C34.1 610.6 145 638.4 281.8 638.4C418.6 638.4 529.5 610.6 529.5 576.3V556H34.1Z" fill="#BCCFD3"/>
<g clip-path="url(#drink)">
<ellipse cx="281.5" cy="566" rx="228" ry="47" fill="#BFD2D6"/>
<ellipse cx="281.5" cy="561" rx="212" ry="37" fill="#CADBDE"/>
<ellipse cx="300" cy="572" rx="64" ry="12" fill="#D9BE98"/>
<ellipse cx="304" cy="574" rx="44" ry="7" fill="#C49E74"/>
<ellipse cx="284" cy="569" rx="16" ry="2.6" fill="#FFFFFF" fill-opacity=".8"/>
</g>
<!-- drink -->
<g clip-path="url(#drink)">
<rect x="40" y="{L:.2f}" width="480" height="420" fill="url(#latte)"/>
<path d="M166.032 408.512C188.626 408.512 191.991 434.804 223.631 434.804C255.271 434.804 273.949 419.516 281.226 408.512C294.749 377.025 307.185 434.804 338.825 434.804C370.465 434.804 369.923 405.824 396.421 408.512C406.157 411.018 431.035 461.063 454.02 434.804C477.005 408.546 495.998 416.122 506.208 411.315L511.617 408.512V630H50.8393V408.512C59.2069 419.919 87.9358 442.818 108.437 434.804C128.937 426.791 112.493 408.512 166.032 408.512Z" fill="url(#coffee)"/>
</g>
<ellipse cx="281.227" cy="{L:.2f}" rx="230.5" ry="17" fill="{surface}"/>
<!-- straw: pierces the surface, in front of the foam; the milky drink hides the rest -->
<g clip-path="url(#above)">{straw_g}</g>
<!-- front of the glass: a soft highlight down the left wall, and the near rim lip over the straw -->
<rect x="40" y="150" width="7" height="400" rx="3.5" fill="url(#shine)"/>
<ellipse cx="281.782" cy="116.963" rx="232" ry="14.6" stroke="#DAF9FC" stroke-width="5.6" mask="url(#rimfront)"/>
<!-- eyes -->
{eyes(look)}{lids(lid)}
</svg>'''


FRAMES = {
    "rest":       dict(),
    "blink":      dict(lid=1),
    "look-right": dict(look=1),
    "sleep-1":    dict(lid=0.42),
    "sleep-2":    dict(lid=0.62),
    "sleep-3":    dict(lid=0.42),
    "sleep-4":    dict(lid=1),
    "drink-1":    dict(straw=18, level=250),
    "drink-2":    dict(straw=26, level=320),
    "drink-3":    dict(straw=30, level=432),
}

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, p in FRAMES.items():
        open(f"{out}/{name}.svg", "w").write(pose(**p))
    print("wrote", len(FRAMES))
