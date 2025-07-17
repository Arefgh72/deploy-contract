import requests
import zipfile
import io
import os
from pathlib import Path

OZ_VERSION = "5.0.2"  # نسخه مورد نظر OpenZeppelin
ZIP_URL = f"https://github.com/OpenZeppelin/openzeppelin-contracts/archive/refs/tags/v{OZ_VERSION}.zip"
EXTRACT_FOLDER = Path("oz_src")

def download_and_extract():
    print(f"دانلود OpenZeppelin v{OZ_VERSION} ...")
    response = requests.get(ZIP_URL)
    if response.status_code != 200:
        print("خطا در دانلود فایل zip!")
        return
    zip_file = zipfile.ZipFile(io.BytesIO(response.content))
    # مسیر پوشه اصلی داخل zip
    oz_main_folder = f"openzeppelin-contracts-{OZ_VERSION}/contracts/"
    file_list = [f for f in zip_file.namelist() if f.startswith(oz_main_folder) and f.endswith('.sol')]
    EXTRACT_FOLDER.mkdir(exist_ok=True)
    for file in file_list:
        rel_path = Path(file[len(oz_main_folder):])
        target_path = EXTRACT_FOLDER / rel_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with zip_file.open(file) as src, open(target_path, "wb") as dst:
            dst.write(src.read())
    print(f"همه فایل‌های OpenZeppelin در پوشه '{EXTRACT_FOLDER}' قرار گرفت.")

if __name__ == "__main__":
    download_and_extract()
