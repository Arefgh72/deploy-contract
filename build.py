import os
import json
import subprocess
from pathlib import Path
import shutil
from solcx import compile_files, install_solc, set_solc_version

def build():
    contract_folder = Path("contracts")
    main_contract_files = [
        "YazdParadiseNFT.sol",
        "ParsToken.sol",
        "MainContract.sol",
        "InteractFeeProxy.sol",
        "GenericNFT.sol",
        "GenericToken.sol",
        "SimpleContract.sol"
    ]
    main_contract_paths = [contract_folder / f for f in main_contract_files]

    solc_version = "0.8.28"
    install_solc(solc_version)
    set_solc_version(solc_version)

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
    with open('artifacts.json', 'w') as f:
        json.dump(artifacts, f, indent=2)

    os.makedirs("flattened", exist_ok=True)

    for contract_file_path in main_contract_paths:
        flattened_output_path = f"flattened/{contract_file_path.name}"

        # اگر قبلاً دایرکتوری با این اسم وجود دارد، حذف کن
        if os.path.isdir(flattened_output_path):
            shutil.rmtree(flattened_output_path)

        # اگر قبلاً فایل خالی هست، حذف کن
        if os.path.isfile(flattened_output_path):
            os.remove(flattened_output_path)

        try:
            # با redirect خروجی به فایل
            result = subprocess.run(
                f"npx sol-merger \"{contract_file_path}\" > \"{flattened_output_path}\"",
                shell=True, capture_output=True, text=True
            )
            print(f"\nFlattening {contract_file_path.name} ...")
            print("stdout:", result.stdout)
            print("stderr:", result.stderr)

            # بررسی کن که فایل ساخته شده باشد و دایرکتوری نباشد
            if not os.path.isfile(flattened_output_path):
                print(f"Flattened file WAS NOT created for {contract_file_path.name}")
                continue

            with open(flattened_output_path, 'r') as f:
                flattened_code = f.read()

            verification_input = {
                "language": "Solidity",
                "sources": {contract_file_path.name: {"content": flattened_code}},
                "settings": {
                    "optimizer": {"enabled": False, "runs": 200},
                    "outputSelection": {"*": {"*": ["*"]}}
                }
            }
            output_filename = f"verification_{contract_file_path.stem}.json"
            with open(output_filename, 'w') as f:
                json.dump(verification_input, f, indent=2)

        except Exception as e:
            print(f"Error processing {contract_file_path}: {e}")

if __name__ == "__main__":
    subprocess.run("npm install @openzeppelin/contracts sol-merger", shell=True, check=True)
    build()
