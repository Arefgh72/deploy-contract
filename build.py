import re
from pathlib import Path

OZ_SRC_DIR = Path("oz_src")
CONTRACTS_DIR = Path("contracts")
FLATTENED_DIR = Path("flattened")
FLATTENED_DIR.mkdir(exist_ok=True)

def recursive_flatten(contract_path, contracts_dir, already_included=None):
    if already_included is None:
        already_included = set()
    code = ""
    with open(contract_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for line in lines:
        import_match = re.match(r'^\s*import\s+[\'"]([^\'"]+)[\'"]\s*;', line)
        if import_match:
            import_path = import_match.group(1)
            if import_path.startswith("@openzeppelin/contracts/"):
                rel_path = import_path.replace("@openzeppelin/contracts/", "")
                full_import_path = OZ_SRC_DIR / rel_path
                if full_import_path.exists() and full_import_path not in already_included:
                    already_included.add(full_import_path)
                    code += recursive_flatten(full_import_path, OZ_SRC_DIR, already_included)
                else:
                    code += f"// {line}"
            elif not import_path.startswith("@") and not import_path.startswith("http"):
                full_import_path = (contracts_dir / import_path).resolve()
                if full_import_path not in already_included and full_import_path.exists():
                    already_included.add(full_import_path)
                    code += recursive_flatten(full_import_path, contracts_dir, already_included)
                else:
                    code += f"// {line}"
            else:
                code += f"// {line}"
        else:
            code += line
    return code

def flatten_contract(contract_filename):
    contract_path = CONTRACTS_DIR / contract_filename
    if not contract_path.exists():
        print(f"Error: contract {contract_filename} not found in {CONTRACTS_DIR}")
        return
    print(f"Flattening {contract_path} ...")
    flattened_code = recursive_flatten(contract_path, CONTRACTS_DIR)
    out_path = FLATTENED_DIR / contract_filename
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(flattened_code)
    print(f"Flattened contract written to {out_path}")

def flatten_all_contracts():
    for contract_file in CONTRACTS_DIR.glob("*.sol"):
        flatten_contract(contract_file.name)

if __name__ == "__main__":
    import sys
    if len(sys.argv) == 2:
        flatten_contract(sys.argv[1])
    else:
        flatten_all_contracts()
