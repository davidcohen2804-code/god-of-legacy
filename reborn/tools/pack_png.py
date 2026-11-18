"""Pack any file's bytes into a lossless PNG (3 bytes per pixel, opaque) so a page can carry it through an image
load: header = 8 bytes big-endian length + b'GOLV'. Pure Python (zlib), no Pillow.
usage: python3 pack_png.py <in file> <out.png>"""
import struct
import sys
import zlib

data = open(sys.argv[1], 'rb').read()
payload = struct.pack('>Q', len(data)) + b'GOLV' + data
W = 1024
H = -(-len(payload) // (3 * W))
payload += b'\0' * (W * H * 3 - len(payload))
raw = b''.join(b'\0' + payload[y * W * 3:(y + 1) * W * 3] for y in range(H))


def chunk(tag, body):
    return struct.pack('>I', len(body)) + tag + body + struct.pack('>I', zlib.crc32(tag + body) & 0xffffffff)


png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)) + \
    chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
open(sys.argv[2], 'wb').write(png)
print(sys.argv[2], W, 'x', H, len(png), 'bytes for', len(data))
