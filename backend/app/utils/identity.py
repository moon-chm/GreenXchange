import base64
import uuid
import qrcode
import io

def encode_base62(num: int) -> str:
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if num == 0:
        return alphabet[0]
    arr = []
    base = len(alphabet)
    while num:
        num, rem = divmod(num, base)
        arr.append(alphabet[rem])
    arr.reverse()
    return "".join(arr)

def generate_scan_id(plant_uuid: uuid.UUID) -> str:
    # Use the first 8 bytes of the UUID to generate a collision-resistant int
    short_int = int.from_bytes(plant_uuid.bytes[:8], byteorder='big')
    return encode_base62(short_int)

def generate_qr_code(scan_id: str) -> str:
    url = f"https://greenxchange.io/scan/{scan_id}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_bytes = buf.getvalue()
    
    return base64.b64encode(img_bytes).decode('utf-8')
