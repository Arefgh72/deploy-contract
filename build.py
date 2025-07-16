import os
import json
import re
from pathlib import Path
from solcx import compile_files, install_solc, set_solc_version
import subprocess

def flatten_contract(main_file_path_str):
    print(f"  -> Flattening {main_file_path_str}...")
    processed_files = set()
    ordered_content = []
    base_dir = Path.cwd()

    # تابع بازگشتی برای پردازش فایل‌ها و وابستگی‌هایشان
    def process_file(file_path_obj):
        # جلوگیری از پردازش تکراری
        abs_path_str = str(file_path_obj.resolve())
        if abs_path_str in processed_files:
            return
        processed_files.add(abs_path_str)

        try:
            with open(file_path_obj, 'r', encoding='utf-8') as f:
                code = f.read()
        except FileNotFoundError:
            print(f"    - Warning: Could not find file {file_path_obj}. Skipping.")
            return

        # پیدا کردن تمام import ها در این فایل (عمق اول)
        import_regex = r'import\s+"([^"]+)";'
        imports = re.findall(import_regex, code)
        
        # ابتدا تمام وابستگی‌های این فایل را به صورت بازگشتی پردازش کن
        for import_path_str in imports:
            # ساخت مسیر درست برای فایل import شده
            resolved_path = (file_path_obj.parent / import_path_str).resolve()
            process_file(resolved_path)
        
        # حذف pragma, license و import ها و اضافه کردن به خروجی
        cleaned_lines = []
        for line in code.splitlines():
            if not (line.strip().startswith(('pragma solidity', '// SPDX-License-Identifier:', 'import ' ))):
                cleaned_lines.append(line)
        
        if cleaned_lines:
            # اضافه کردن کامنت برای مشخص شدن منبع کد
            relative_path_for_comment = file_path_obj.relative_to(base_dir) if file_path_obj.is_relative_to(base_dir) else file_path_obj
            ordered_content.append(f"// From: {str(relative_path_for_comment).replace(os.sep, '/')}\n" + "\n".join(cleaned_lines))

    # اجرای فرآیند فلت کردن
    process_file(Path(main_file_path_str))
    
    # اضافه کردن هدرهای لازم به ابتدای فایل نهایی
    header = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.28;\n\n"
    return header + "\n\n".join(ordered_content)


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

    # ۴. ساخت فایل‌های وریفای با فلت کردن
    print("\nGenerating verification files...")
    for contract_file_path in main_contract_paths:
        try:
            flattened_code = flatten_contract(contract_file_path)
            
            verification_input = {
                "language": "Solidity",
                "sources": { contract_file_path.name: { "content": flattened_code } },
                "settings": { "optimizer": { "enabled": False, "runs": 200 }, "outputSelection": { "*": { "*": ["*"] } } }
            }
            
            output_filename = f"verification_{contract_file_path.stem}.json"
            with open(output_filename, 'w') as f: json.dump(verification_input, f, indent=2)
            print(f"  -> Created {output_filename}")

        except Exception as e:
            print(f"  -> Error processing {contract_file_path}: {e}")

    print("\nBuild finished successfully!")

if __name__ == "__main__":
    build()
