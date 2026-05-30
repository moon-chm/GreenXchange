import base64
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

def generate_keys():
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    private_b64 = base64.b64encode(private_pem).decode('utf-8')
    public_b64 = base64.b64encode(public_pem).decode('utf-8')
    
    with open("e:/GreenXchange/.env", "a") as f:
        f.write(f"\n# RS256 Keys for JWT\n")
        f.write(f"JWT_PRIVATE_KEY_B64={private_b64}\n")
        f.write(f"JWT_PUBLIC_KEY_B64={public_b64}\n")
    print("Keys generated and appended to .env")

if __name__ == "__main__":
    generate_keys()
