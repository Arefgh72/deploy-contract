import os
import json
import subprocess
from pathlib import Path
from solcx import compile_files, install_solc, set_solc_version

# این دقیقاً تابع شماست، بدون هیچ تغییری
def generate_standard_json_input(contract_path, source_code):
    """
    یک فایل با فرمت Standard-JSON-Input برای وریفای کردن قرارداد در اکسپلوررها تولید می‌کند.
    """
    return {
        "language": "Solidity",
        "sources": {
            contract_path: {
                "content": source_code
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
                        "abi",
                        "evm.bytecode",
                        "evm.deployedBytecode",
                        "evm.methodIdentifiers",
                        "metadata"
                    ]
                }
            },
            "metadata": {
                "useLiteralContent": True
            },
            "libraries": {}
        }
    }


def build():
    # ۱. لیست قراردادها
    contract_folder = Path("contracts")
    main_contract_files = [ "YazdParadiseNFT.sol", "ParsToken.sol", "MainContract.sol", "InteractFeeProxy.sol", "GenericNFT.sol", "GenericToken.sol", "SimpleContract.sol" ]
    main_contract_paths = [contract_folder / f for f in main_contract_files]

    # ۲. نصب و تنظیم کامپایلر
    print("Setting up solc...")
    solc_version = "0.8.28"
    install_solc(solc_version)
    set_solc_version(solc_version)

    # ۳. کامپایل برای artifacts.json
    print("\nCompiling contracts for ABI and Bytecode...")
    if not os.path.exists("node_modules/@openzeppelin"):
        print("-> OpenZeppelin not found, running 'npm install'...")
        subprocess.run("npm install @openzeppelin/contracts", shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    compiled_sol = compile_files(
        main_contract_paths, output_values=["abi", "bin"], 
        import_remappings={"@openzeppelin/": "node_modules/@openzeppelin/"}
    )
    artifacts = {}
    for contract_identifier, data in compiled_sol.items():
        contract_name = contract_identifier.split(':')[-1]
        artifacts[contract_name] = { 'abi': data['abi'], 'bytecode': '0x' + data['bin'] }
    with open('artifacts.json', 'w') as f: json.dump(artifacts, f, indent=2)
    print("✅ artifacts.json created successfully!")

    # ۴. ساخت فایل‌های وریفای با استفاده از تابع شما
    print("\nGenerating verification files...")
    print("-> Installing sol-merger to flatten contracts...")
    subprocess.run("npm install sol-merger", shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    for contract_file_path in main_contract_paths:
        try:
            print(f"  -> Flattening {contract_file_path} to feed your function...")
            # اجرای sol-merger برای به دست آوردن کد کامل
            result = subprocess.run(
                f"npx sol-merger \"{contract_file_path}\"",
                shell=True, check=True, capture_output=True, text=True
            )
            flattened_code = result.stdout
            
            # فراخوانی تابع شما با کد کامل
            std_json = generate_standard_json_input(contract_file_path.name, flattened_code)
            
            output_filename = f"verification_{contract_file_path.stem}.json"
            with open(output_filename, 'w') as f: json.dump(std_json, f, indent=2)
            print(f"  -> Created {output_filename} using your function.")

        except Exception as e:
            print(f"  -> Error processing {contract_file_path}: {e}")

    print("\nBuild finished successfully!")

if __name__ == "__main__":
    build()
