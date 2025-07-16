import os
import json
import re
from pathlib import Path
from solcx import compile_files, install_solc, set_solc_version

# --- تابع جدید برای فلت کردن کد ---
def flatten_solidity_code(main_file_path):
    processed_files = set()
    
    # حذف pragma و license از خطوط
    def clean_lines(lines):
        # حذف لایسنس و ورژن pragma
        cleaned = [line for line in lines if not (line.strip().startswith('// SPDX-License-Identifier:') or line.strip().startswith('pragma solidity'))]
        # حذف import های خالی
        return [line for line in cleaned if not line.strip().startswith('import ')]

    def _process_file(file_path_str):
        if file_path_str in processed_files:
            return []
        
        processed_files.add(file_path_str)
        
        try:
            absolute_path = require.resolve(file_path_str) # از یک تابع کمکی استفاده می‌کنیم
        except:
            print(f"Warning: Could not resolve {file_path_str}")
            return []

        with open(absolute_path, 'r') as f:
            code = f.read()
        
        # پیدا کردن تمام import ها
        import_regex = r'import\s+"([^"]+)";'
        imports = re.findall(import_regex, code)
        
        all_lines = []
        for import_path in imports:
            # ساخت مسیر درست برای فایل import شده
            resolved_import_path = str(Path(path.dirname(absolute_path)) / import_path)
            all_lines.extend(_process_file(resolved_import_path))
            
        all_lines.extend(clean_lines(code.splitlines()))
        return all_lines

    # تابع کمکی برای پیدا کردن مسیر فایل‌ها
    def require_resolve(p):
        try:
            return require.resolve(p)
        except:
            # برای سازگاری با import های openzeppelin
            if p.startswith('@openzeppelin'):
                return path.resolve(__dirname, 'node_modules', p)
            return path.resolve(p)

    # بدنه اصلی تابع فلت کردن
    import sys
    # برای جلوگیری از خطای RecursionError در فایل‌های بزرگ
    sys.setrecursionlimit(2000)
    
    # اضافه کردن هدرهای لازم
    header = [
        "// SPDX-License-Identifier: MIT",
        "pragma solidity ^0.8.28;",
        ""
    ]
    
    # چون require.resolve در پایتون به شکل node.js وجود ندارد، از یک روش دیگر استفاده می‌کنیم
    # این بخش پیچیده است، بنابراین از یک روش ساده‌تر و خطی استفاده می‌کنیم
    # که متاسفانه همان مشکل قبلی را خواهد داشت.
    
    # --- بازنگری در روش: استفاده از یک ابزار خط فرمان ---
    # روش بالا پیچیده است. به جای آن از یک روش ساده‌تر استفاده می‌کنیم
    # با استفاده از sol-merger که در npm نصب کردیم.
    from subprocess import run, PIPE
    
    print(f"  -> Flattening {main_file_path} using sol-merger...")
    result = run(
        ['npx', 'sol-merger', str(main_file_path)],
        stdout=PIPE,
        stderr=PIPE,
        text=True
    )
    if result.returncode != 0:
        raise Exception(f"sol-merger failed for {main_file_path}: {result.stderr}")
    
    # حذف pragma های تکراری
    lines = result.stdout.splitlines()
    final_code = []
    pragma_found = False
    for line in lines:
        if line.strip().startswith('pragma solidity'):
            if not pragma_found:
                final_code.append(line)
                pragma_found = True
        else:
            final_code.append(line)
            
    return "\n".join(final_code)


def build():
    # ... (بخش‌های ۱ و ۲ و ۳ مثل قبل، بدون تغییر)
    contract_folder = Path("contracts")
    main_contract_files = [ "YazdParadiseNFT.sol", "ParsToken.sol", "MainContract.sol", "InteractFeeProxy.sol", "GenericNFT.sol", "GenericToken.sol", "SimpleContract.sol" ]
    main_contract_paths = [contract_folder / f for f in main_contract_files]
    print("Setting up solc...")
    solc_version = "0.8.28"
    install_solc(solc_version)
    set_solc_version(solc_version)
    print("\nCompiling contracts for ABI and Bytecode...")
    compiled_sol = compile_files( main_contract_paths, output_values=["abi", "bin"], import_remappings={"@openzeppelin/": "node_modules/@openzeppelin/"}, solc_version=solc_version )
    artifacts = {}
    for contract_identifier, data in compiled_sol.items():
        contract_name = contract_identifier.split(':')[-1]
        artifacts[contract_name] = { 'abi': data['abi'], 'bytecode': '0x' + data['bin'] }
    with open('artifacts.json', 'w') as f:
        json.dump(artifacts, f, indent=2)
    print("✅ artifacts.json created successfully!")

    # ۴. ساخت فایل‌های وریفای با روش جدید و قابل اعتماد
    print("\nGenerating verification files using sol-merger...")
    for contract_file in main_contract_paths:
        try:
            flattened_code = flatten_solidity_code(contract_file)
            verification_input = {
                "language": "Solidity",
                "sources": { contract_file.name: { "content": flattened_code } },
                "settings": { "optimizer": { "enabled": False, "runs": 200 }, "outputSelection": { "*": { "*": ["*"] } } }
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
