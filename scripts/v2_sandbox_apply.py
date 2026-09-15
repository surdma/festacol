from pathlib import Path
import base64
import gzip
import hashlib

FILES = {
    "prisma/schema.prisma": ("prisma-schema.b64gz", "6ca0f68b1f5459a6da3fb54dfee7a3f13c064433ab55ddfb2ae754385408a592"),
    "src/types/db.ts": ("db-types.b64gz", "b877073ac29740fb6a0d6f3d85bd3cfdd6c3d24f6b15a67f232d3edfa9d55cbc"),
    "prisma/migrations/migration_lock.toml": ("migration-lock.b64gz", "1db17a8d051aa136110736752c5e1f8b7ed92b6ea8e803112fbbe2497047c210"),
    "prisma/migrations/20260915110000_relational_schema_v3/migration.sql": ("relational-v3.b64gz", "ef228a01db1ff10781f7987205e4f67f3b2835b9402c977f1783c0fe33a36ee8"),
    "supabase/auth-rpc.sql": ("auth-rpc.b64gz", "f3f26b4cd64717c8a5c32e4ac5af165411ffeb49524bed269faee2f6348b60bb"),
    "supabase/rls.sql": ("rls.b64gz", "34bcc471e9d7a7f5a815e541a1c313622b00f76ab53d0ae6829a5975004b1461"),
}

payload_root = Path("scripts/v2_payloads")
for rel, (payload_name, expected_sha256) in FILES.items():
    encoded = (payload_root / payload_name).read_text().strip()
    data = gzip.decompress(base64.b64decode(encoded))
    actual = hashlib.sha256(data).hexdigest()
    if actual != expected_sha256:
        raise RuntimeError(f"checksum mismatch for {rel}: {actual} != {expected_sha256}")
    path = Path(rel)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f"wrote {rel} {actual}")
