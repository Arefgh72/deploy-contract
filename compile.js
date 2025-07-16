const fs = require('fs');
const path = require('path');
const solc = require('solc');

// لیست تمام قراردادهایی که باید کامپایل شوند
const contractPaths = [
    "contracts/YazdParadiseNFT.sol",
    "contracts/ParsToken.sol",
    "contracts/MainContract.sol",
    "contracts/InteractFeeProxy.sol",
    "contracts/GenericNFT.sol",
    "contracts/GenericToken.sol",
    "contracts/SimpleContract.sol"
];

// ساختار ورودی استاندارد برای کامپایلر سالیدیتی
const input = {
    language: 'Solidity',
    sources: {},
    settings: {
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode']
            }
        }
    }
};

// خواندن محتوای هر فایل قرارداد و افزودن به آبجکت ورودی
contractPaths.forEach(filePath => {
    const source = fs.readFileSync(filePath, 'utf8');
    const contractFileName = path.basename(filePath);
    input.sources[contractFileName] = { content: source };
});

// تابعی برای پیدا کردن و خواندن فایل‌های import شده (مخصوص OpenZeppelin)
function findImports(relativePath) {
    // مسیر کامل فایل‌های OpenZeppelin در پوشه node_modules را پیدا می‌کند
    const ozPath = path.resolve(__dirname, 'node_modules', relativePath);
    if (fs.existsSync(ozPath)) {
        return { contents: fs.readFileSync(ozPath, 'utf8') };
    }
    return { error: 'File not found' };
}

// کامپایل کردن قراردادها
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

// بررسی خطاها در حین کامپایل
if (output.errors) {
    let hasError = false;
    output.errors.forEach(err => {
        // فقط خطاهای جدی (error) را نمایش بده، نه هشدارها (warning)
        if (err.severity === 'error') {
            console.error(err.formattedMessage);
            hasError = true;
        }
    });
    // اگر خطایی وجود داشت، فرآیند را متوقف کن
    if(hasError) process.exit(1);
}

// استخراج ABI و بایت‌کد از خروجی کامپایلر
const artifacts = {};
for (const fileName in output.contracts) {
    for (const contractName in output.contracts[fileName]) {
        artifacts[contractName] = {
            abi: output.contracts[fileName][contractName].abi,
            bytecode: '0x' + output.contracts[fileName][contractName].evm.bytecode.object
        };
    }
}

// نوشتن خروجی نهایی در فایل artifacts.json
fs.writeFileSync('artifacts.json', JSON.stringify(artifacts, null, 2));

console.log('✅ Contracts compiled successfully! ABI and Bytecode saved to artifacts.json');
