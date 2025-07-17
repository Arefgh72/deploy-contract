import os
import json
import subprocess
from pathlib import Path
from solcx import compile_files, install_solc, set_solc_version

def build():
    contract_folder = Path("contracts")
    main_contract_files = ["YazdParadiseNFT.sol", "ParsToken.sol", "MainContract.sol", "InteractFeeProxy.sol", "GenericNFT.sol", "GenericToken.sol", "SimpleContract.sol"]
    main_contract_paths = [contract_folder / f for f in main_contract_files]

    print("Setting up solc...")
    solc_version = "0.8.28"
    install_solc(solc_version)
    set_solc_version(solc_version)

    print("\nCompiling contracts for ABI and Bytecode...")
    compiled_sol = compile_files(
        main_contract_paths, output_values=["abi", "bin"],
        import_remappings={"@openzeppelin/": "node_modules/@openzeppelin/"}
    )
    artifacts = {}
    for contract_identifier, data in compiled_sol.items():
        contract_name = contract_identifier.split(':')[-1]
        artifacts[contract_name] = {'abi': data['abi'], 'bytecode': '0x' + data['bin']}
    with open('artifacts.json', 'w') as f:
        json.dump(artifacts, f, indent=2)
    print("✅ artifacts.json created successfully!")

    print("\nGenerating verification files...")
    os.makedirs("flattened", exist_ok=True)
    for contract_file_path in main_contract_paths:
        try:
            print(f"  -> Flattening {contract_file_path}...")
            flattened_output_path = f"flattened/{contract_file_path.name}"
            subprocess.run(
                f"npx sol-merger \"{contract_file_path}\" \"{flattened_output_path}\"",
                shell=True, check=True, capture_output=True, text=True
            )
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
            print(f"  -> Created {output_filename}")

        except Exception as e:
            print(f"  -> Error processing {contract_file_path}: {e}")

    print("\nBuild finished successfully!")

if __name__ == "__main__":
    print("-> Installing Node.js dependencies...")
    subprocess.run("npm install @openzeppelin/contracts sol-merger", shell=True, check=True)
    build()
