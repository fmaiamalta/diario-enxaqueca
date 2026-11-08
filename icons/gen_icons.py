from PIL import Image, ImageDraw

def lerp(a, b, t): return tuple(round(a[i] + (b[i]-a[i])*t) for i in range(3))
TOP, BOT = (109,144,182), (138,167,198)   # azul mate pastel
AMBER = (245, 176, 60)

def gradient(size):
    img = Image.new('RGB', (size, size)); px = img.load()
    for y in range(size):
        for x in range(size):
            tt = min(1.0, (y*0.7 + x*0.3)/(size-1))
            px[x, y] = lerp(TOP, BOT, tt)
    return img

def rounded(img, radius):
    size = img.size[0]
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0,0,size-1,size-1], radius=radius, fill=255)
    out = Image.new('RGBA', (size, size), (0,0,0,0))
    out.paste(img, (0,0), mask)
    return out

def glyph(draw, size, pad):
    # coordenadas no espaço 512, escaladas e deslocadas por pad
    s = (size - 2*pad) / 512.0
    def P(x, y): return (pad + x*s, pad + y*s)
    def box(x0, y0, x1, y1): return [pad + x0*s, pad + y0*s, pad + x1*s, pad + y1*s]
    white = (255, 255, 255)
    # cabeça (círculo) — silhueta de pessoa
    draw.ellipse(box(256-112, 196-112, 256+112, 196+112), fill=white)
    # ombros/busto (meia elipse que sai de baixo)
    draw.ellipse(box(104, 372, 408, 712), fill=white)
    # raio de dor na têmpora direita (amarelo)
    bolt = [(352,92),(320,236),(348,236),(330,352),(394,196),(360,196),(382,92)]
    draw.polygon([P(x, y) for (x, y) in bolt], fill=AMBER)

def make(size, radius_ratio=0.22, pad_ratio=0.0, apple=False):
    img = gradient(size).convert('RGBA')
    glyph(ImageDraw.Draw(img), size, int(size*pad_ratio))
    if apple:
        return img.convert('RGB')          # iOS: sem transparência
    return rounded(img, int(size*radius_ratio))

make(192).save('icon-192.png')
make(512).save('icon-512.png')
make(512, pad_ratio=0.14).save('icon-maskable-512.png')   # glyph na zona segura
make(180, apple=True).save('apple-touch-icon.png')
print('ok')
