import os
import json
from pathlib import Path
from solcx import compile_files, install_solc, set_solc_version

def build():
    # ۱. لیست قراردادها
    contract_folder = Path("contracts")
    main_contract_files = [
        contract_folder / "YazdParadiseNFT.sol",
        contract_folder / "ParsToken.sol",
        contract_folder / "MainContract.sol",
        contract_folder / "InteractFeeProxy.sol",
        contract_folder / "GenericNFT.sol",
        contract_folder / "GenericToken.sol",
        contract_folder / "SimpleContract.sol",
    ]

    # ۲. نصب و تنظیم کامپایلر سالیدیتی
    print("Setting up solc...")
    solc_version = "0.8.28"
    install_solc(solc_version)
    set_solc_version(solc_version)

    # ۳. کامپایل قراردادها برای artifacts.json
    print("\nCompiling contracts for ABI and Bytecode...")
    compiled_sol = compile_files(
        main_contract_files,
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
    # متاسفانه، کتابخانه پایتون مستقیمی برای فلت کردن وجود ندارد.
    # ساده‌ترین راه حل این است که از همان روش قبلی (ساخت JSON جامع در جاوا اسکریپت) استفاده کنیم
    # یا اینکه در ورک‌فلو از ابزار خط فرمان استفاده کنیم.
    # برای سادگی، فعلا این بخش را غیرفعال نگه می‌داریم تا پروژه دوباره کار کند.
    # بعدا می‌توانیم این قابلیت را با یک روش مطمئن اضافه کنیم.
    print("-> Verification file generation is skipped in this Python version for simplicity.")
    print("\nBuild finished successfully!")

if __name__ == "__main__":
    build()
