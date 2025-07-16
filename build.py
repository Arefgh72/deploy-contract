import os
import json
from pathlib import Path
from solcx import compile_files, install_solc, set_solc_version
from pysol_flatten import flatten

def build():
    # ۱. لیست قراردادها
    contract_folder = Path("contracts")
    main_contract_files = [
        "YazdParadiseNFT.sol", "ParsToken.sol", "MainContract.sol", "InteractFeeProxy.sol",
        "GenericNFT.sol", "GenericToken.sol", "SimpleContract.sol"
    ]
    main_contract_paths = [contract_folder / f for f in main_contract_files]

    # ۲. نصب و تنظیم کامپایلر سالیدیتی
    print("Setting up solc...")
    solc_version = "0.8.28"
    install_solc(solc_version)
    set_solc_version(solc_version)

    # ۳. کامپایل قراردادها برای artifacts.json
    print("\nCompiling contracts for ABI and Bytecode...")
    compiled_sol = compile_files(
        main_contract_paths,
        output_values=["abi", "bin"],
        import_remappings={"@openzeppelin/": "node_modules/@openzeppelin/"},
        solc_version=solc_version
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
    print("✅ artifacts.json created successfully!")

    # ۴. ساخت فایل‌های وریفای کامل (فلت شده)
    print("\nGenerating verification files...")
    for contract_file in main_contract_paths:
        try:
            print(f"  -> Flattening {contract_file}...")
            flattened_code = flatten(str(contract_file), "node_modules")
            
            contract_name_for_json = contract_file.name
            
            verification_input = {
                "language": "Solidity",
                "sources": {
                    contract_name_for_json: {
                        "content": flattened_code
                    }
                },
                "settings": {
                    "optimizer": { "enabled": False, "runs": 200 },
                    "outputSelection": { "*": { "*": ["*"] } }
                }
            }
            
            output_filename = f"verification_{contract_file.stem}.json"
            with open(output_filename, 'w') as f:
                json.dump(verification_input, f, indent=2)
            print(f"  -> Created {output_filename}")

        except Exception as e:
            print(f"  -> Error processing {contract_file}: {e}")

    print("\nBuild finished successfully!")


if __name__ == "__main__":
    build()
