import os
import json
import re
from pathlib import Path
from solcx import compile_files, install_solc, set_solc_version

# --- تابع جدید و قدرتمند برای فلت کردن کد ---
def flatten_code(main_file_path):
    print(f"  -> Flattening {main_file_path}...")
    processed_files = set()
    output_code = []

    def find_and_process(file_path_str):
        # جلوگیری از پردازش تکراری و حلقه‌های بی‌نهایت
        if file_path_str in processed_files:
            return
        processed_files.add(file_path_str)

        # پیدا کردن مسیر مطلق فایل
        try:
            # ابتدا در پوشه فعلی یا node_modules جستجو کن
            absolute_path = require_resolve_py(file_path_str)
        except Exception:
            print(f"    - Warning: Could not find import '{file_path_str}'. Skipping.")
            return

        with open(absolute_path, 'r', encoding='utf-8') as f:
            code = f.read()

        # پیدا کردن تمام import ها در این فایل
        import_regex = r'import\s+"([^"]+)";'
        imports = re.findall(import_regex, code)

        # ابتدا تمام وابستگی‌های این فایل را پردازش کن (عمق اول)
        for import_path in imports:
            # ساخت مسیر درست برای فایل import شده
            resolved_import_path = str(Path(path.dirname(absolute_path)) / import_path)
            find_and_process(resolved_import_path)
        
        # حذف pragma و license از خطوط
        for line in code.splitlines():
            if not (line.strip().startswith('pragma solidity') or line.strip().startswith('// SPDX-License-Identifier:') or line.strip().startswith('import ')):
                output_code.append(line)

    # تابع کمکی برای پیدا کردن مسیر فایل‌ها در پایتون
    def require_resolve_py(p):
        p = Path(p)
        if p.is_absolute():
            return str(p)
        # برای @openzeppelin
        if str(p).startswith('@openzeppelin'):
            return str(Path('node_modules') / p)
        # برای مسیرهای نسبی
        return str(p)
    
    # اجرای فرآیند فلت کردن
    find_and_process(str(main_file_path))

    # اضافه کردن هدرهای لازم به ابتدای فایل نهایی
    final_code = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.28;\n\n" + "\n".join(output_code)
    return final_code

# --- بدنه اصلی اسکریپت ---
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
    # اطمینان از وجود node_modules برای py-solc-x
    if not os.path.exists("node_modules"):
        print("-> OpenZeppelin not found, running 'npm install'...")
        subprocess.run("npm install @openzeppelin/contracts", shell=True, check=True)

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

    # ۴. ساخت فایل‌های وریفای با منطق داخلی
    print("\nGenerating verification files...")
    for contract_file_path in main_contract_paths:
        try:
            flattened_code = flatten_code(contract_file_path)
            
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
            import traceback
            traceback.print_exc()

    print("\nBuild finished successfully!")

if __name__ == "__main__":
    import subprocess
    from os import path
    build()
