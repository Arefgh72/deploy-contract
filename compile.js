const fs = require('fs');
const path = require('path');
const solc = require('solc');

// لیست قراردادهای اصلی شما
const mainContractFiles = [
    "YazdParadiseNFT.sol", "ParsToken.sol", "MainContract.sol", "InteractFeeProxy.sol",
    "GenericNFT.sol", "GenericToken.sol", "SimpleContract.sol"
];

function findImports(importPath) {
    // این تابع به کامپایلر کمک می‌کند تا فایل‌های import شده را پیدا کند
    try {
        // ابتدا تلاش برای پیدا کردن در node_modules
        const fullPath = require.resolve(importPath, { paths: [path.resolve(__dirname, 'node_modules')] });
        return { contents: fs.readFileSync(fullPath, 'utf8') };
    } catch (e) {
        try {
            // سپس تلاش برای پیدا کردن در پوشه contracts
            const fullPath = require.resolve(importPath, { paths: [path.resolve(__dirname, 'contracts')] });
            return { contents: fs.readFileSync(fullPath, 'utf8') };
        } catch (e2) {
            // و در نهایت مسیرهای نسبی
             try {
                const fullPath = path.resolve(__dirname, importPath);
                return { contents: fs.readFileSync(fullPath, 'utf8') };
            } catch (e3) {
                 return { error: `File not found: ${importPath}` };
            }
        }
    }
}

// 1. ساخت فایل artifacts.json برای رابط کاربری
function compileForArtifacts() {
    const input = {
        language: 'Solidity',
        sources: {},
        settings: {
            outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }
        }
    };
    mainContractFiles.forEach(fileName => {
        input.sources[fileName] = { content: fs.readFileSync(path.resolve(__dirname, 'contracts', fileName), 'utf8') };
    });

    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

    if (output.errors) {
        let hasError = false;
        output.errors.forEach(err => {
            if (err.severity === 'error') {
                console.error(err.formattedMessage); hasError = true;
            }
        });
        if (hasError) process.exit(1);
    }

    const artifacts = {};
    for (const fileName in output.contracts) {
        for (const contractName in output.contracts[fileName]) {
            artifacts[contractName] = {
                abi: output.contracts[fileName][contractName].abi,
                bytecode: '0x' + output.contracts[fileName][contractName].evm.bytecode.object
            };
        }
    }
    fs.writeFileSync('artifacts.json', JSON.stringify(artifacts, null, 2));
    console.log('✅ artifacts.json created successfully!');
}

// 2. ساخت فایل‌های JSON کامل برای وریفای کردن
function generateVerificationFiles() {
    console.log('\nGenerating verification files...');
    const remappings = [`@openzeppelin/=${path.resolve(__dirname, 'node_modules/@openzeppelin/')}`];
    
    mainContractFiles.forEach(mainFile => {
        const filePath = path.join('contracts', mainFile);
        // استفاده از sol-merger برای فلت کردن کد
        const flattenedCode = require('sol-merger').flatten(filePath, { remappings });
        
        const verificationInput = {
            language: 'Solidity',
            sources: {
                [mainFile]: {
                    content: flattenedCode
                }
            },
            settings: {
                optimizer: { enabled: false, runs: 200 },
                outputSelection: { "*": { "*": ["*"] } }
            }
        };
        
        const contractName = path.basename(mainFile, '.sol');
        const outputFilename = `verification_${contractName}.json`;
        fs.writeFileSync(outputFilename, JSON.stringify(verificationInput, null, 2));
        console.log(`  -> Created ${outputFilename}`);
    });
}


// قبل از اجرای توابع، پکیج sol-merger را به package.json اضافه می‌کنیم
function setup() {
    console.log('Adding sol-merger dependency...');
    const packageJsonPath = path.resolve(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (!packageJson.dependencies['sol-merger']) {
        packageJson.dependencies['sol-merger'] = '^4.1.0';
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log('-> sol-merger added. Please run "npm install" again.');
        // چون در محیط اکشن هستیم، مستقیم نصب می‌کنیم
        require('child_process').execSync('npm install sol-merger', { stdio: 'inherit' });
    }
}

setup();
compileForArtifacts();
generateVerificationFiles();
