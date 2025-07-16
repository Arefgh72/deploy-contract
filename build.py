import os
import json
import re
from pathlib import Path
from solcx import compile_files, install_solc, set_solc_version
import subprocess

# --- تابع جدید و قدرتمند برای فلت کردن کد با رعایت ترتیب وابستگی‌ها ---
def flatten_contract(main_file_path_str):
    print(f"  -> Flattening {main_file_path_str}...")
    processed_files = set()
    
    def _process_file(file_path_str):
        # جلوگیری از پردازش تکراری و حلقه‌های بی‌نهایت
        if file_path_str in processed_files:
            return ""
        
        # پیدا کردن مسیر مطلق فایل
        try:
            absolute_path = Path(require_resolve_py(file_path_str)).resolve()
        except Exception:
            print(f"    - Warning: Could not find import '{file_path_str}'. Skipping.")
            return ""

        processed_files.add(str(absolute_path))

        with open(absolute_path, 'r', encoding='utf-8') as f:
            code = f.read()

        # پیدا کردن تمام import ها در این فایل
        import_regex = r'import\s+"([^"]+)";'
        imports = re.findall(import_regex, code)
        
        # ابتدا تمام وابستگی‌های این فایل را به صورت بازگشتی پردازش کن
        dependency_code = ""
        for import_path in imports:
            resolved_import_path = str(Path(absolute_path).parent / import_path)
            dependency_code += _process_file(resolved_import_path)
        
        # حذف pragma, license و import ها
        cleaned_code = ""
        for line in code.splitlines():
            if not (line.strip().startswith(('pragma solidity', '// SPDX-License-Identifier:', 'import ' ))):
                cleaned_code += line + "\n"

        # اول کد وابستگی‌ها، بعد کد فایل فعلی
        return dependency_code + "\n" + cleaned_code

    # تابع کمکی برای پیدا کردن مسیر فایل‌ها
    def require_resolve_py(p_str):
        # این یک شبیه‌سازی ساده از require.resolve در node.js است
        if p_str.startswith('@openzeppelin'):
            return str(Path('node_modules') / p_str)
        return p_str

    # اجرای فرآیند فلت کردن
    flattened_content = _process_file(main_file_path_str)
    
    # اضافه کردن هدرهای لازم به ابتدای فایل نهایی
    header = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.28;\n\n"
    return header + flattened_content


def build():
    # ۱. لیست قراردادها (بدون تغییر)
    contract_folder = Path("contracts")
    main_contract_files = [ "YazdParadiseNFT.sol", "ParsToken.sol", "MainContract.sol", "InteractFeeProxy.sol", "GenericNFT.sol", "GenericToken.sol", "SimpleContract.sol" ]
    main_contract_paths = [contract_folder / f for f in main_contract_files]

    # ۲. نصب و تنظیم کامپایلر (بدون تغییر)
    print("Setting up solc...")
    solc_version = "0.8.28"
    install_solc(solc_version)
    set_solc_version(solc_version)

    # ۳. کامپایل برای artifacts.json (بدون تغییر)
    print("\nCompiling contracts for ABI and Bytecode...")
    if not os.path.exists("node_modules/@openzeppelin"):
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

    # ۴. ساخت فایل‌های وریفای با منطق جدید و صحیح
    print("\nGenerating verification files...")
    for contract_file_path in main_contract_paths:
        try:
            flattened_code = flatten_contract(str(contract_file_path))
            
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
    build()
