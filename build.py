import os
import json
import re
import shutil
from pathlib import Path
from solcx import compile_files, install_solc, set_solc_version

SOLC_VERSION = "0.8.28"

def recursive_flatten(contract_path, contracts_dir, already_included=None):
    """
    باز کردن همه importهای داخلی و تولید کد flatten شده قرارداد
    """
    if already_included is None:
        already_included = set()
    code = ""
    with open(contract_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for line in lines:
        import_match = re.match(r'^\s*import\s+[\'"]([^\'"]+)[\'"]\s*;', line)
        if import_match:
            import_path = import_match.group(1)
            # فقط فایل‌های داخلی را flatten کن
            if not import_path.startswith("@") and not import_path.startswith("openzeppelin") and not import_path.startswith("http"):
                full_import_path = (contracts_dir / import_path).resolve()
                if full_import_path not in already_included and full_import_path.exists():
                    already_included.add(full_import_path)
                    code += recursive_flatten(full_import_path, contracts_dir, already_included)
            else:
                code += f"// {line}" # Importهای خارجی را به صورت کامنت نگه دار
        else:
            code += line
    return code

def build():
    contracts_dir = Path("contracts")
    output_dir = Path("flattened")
    output_dir.mkdir(parents=True, exist_ok=True)
    verification_dir = Path("verification")
    verification_dir.mkdir(parents=True, exist_ok=True)
    public_dir = Path("public")
    public_dir.mkdir(parents=True, exist_ok=True)

    main_contract_files = [
        "YazdParadiseNFT.sol",
        "ParsToken.sol",
        "MainContract.sol",
        "InteractFeeProxy.sol",
        "GenericNFT.sol",
        "GenericToken.sol",
        "SimpleContract.sol"
    ]

    # کد flatten و فایل verification بساز
    for contract_file in main_contract_files:
        contract_path = contracts_dir / contract_file
        flatten_code = recursive_flatten(contract_path, contracts_dir)
        
        # اگر pragma و SPDX نداشت اضافه کن
        if not re.search(r'pragma solidity', flatten_code):
            flatten_code = f'pragma solidity ^{SOLC_VERSION};\n' + flatten_code
        if not re.search(r'SPDX-License-Identifier:', flatten_code):
            flatten_code = '// SPDX-License-Identifier: MIT\n' + flatten_code

        # خروجی فایل flatten
        flattened_file_path = output_dir / contract_file
        with open(flattened_file_path, "w", encoding="utf-8") as f:
            f.write(flatten_code)
        shutil.copy(flattened_file_path, public_dir / contract_file)

        # ساخت فایل verification input (جوس)
        verification_input = {
            "language": "Solidity",
            "sources": {
                contract_file: {
                    "content": flatten_code
                }
            },
            "settings": {
                "optimizer": {
                    "enabled": False,
                    "runs": 200
                },
                "outputSelection": {
                    "*": {
                        "*": [
                            "*"
                        ]
                    }
                }
            }
        }
        verification_file_path = verification_dir / f"verification_{contract_file.replace('.sol','.json')}"
        with open(verification_file_path, "w", encoding="utf-8") as f:
            json.dump(verification_input, f, indent=2)
        shutil.copy(verification_file_path, public_dir / f"verification_{contract_file.replace('.sol','.json')}")

        print(f"Flattened and verification input created for {contract_file}")

    # ساخت artifacts.json برای داشبورد و UI
    install_solc(SOLC_VERSION)
    set_solc_version(SOLC_VERSION)
    main_contract_paths = [contracts_dir / f for f in main_contract_files]
    compiled_sol = compile_files(
        main_contract_paths,
        output_values=["abi", "bin"],
        import_remappings={"@openzeppelin/": "node_modules/@openzeppelin/"}
    )
    artifacts = {}
    for contract_identifier, data in compiled_sol.items():
        contract_name = contract_identifier.split(':')[-1]
        artifacts[contract_name] = {
            'abi': data['abi'],
            'bytecode': '0x' + data['bin']
        }
    with open('artifacts.json', 'w', encoding='utf-8') as f:
        json.dump(artifacts, f, indent=2)
    shutil.copy('artifacts.json', public_dir / 'artifacts.json')

if __name__ == "__main__":
    build()
