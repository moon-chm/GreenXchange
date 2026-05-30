import sys
path = "backend/alembic/versions/f60f71918573_schema.py"
with open(path, "r") as f:
    lines = f.readlines()
with open(path, "w") as f:
    for line in lines:
        if "postgresql_using='gist'" in line:
            continue
        f.write(line)
print("Migration fixed.")
