const fs = require('fs');
const path = require('path');
const solc = require('solc');

// لیست قراردادهای اصلی شما
const mainContractPaths = [
    "contracts/YazdParadiseNFT.sol",
    "contracts/ParsToken.sol",
    "contracts/MainContract.sol",
    "contracts/InteractFeeProxy.sol",
    "contracts/GenericNFT.sol",
    "contracts/GenericToken.sol",
    "contracts/SimpleContract.sol"
];

// تابع برای پیدا کردن و خواندن فایل‌های import شده
function findImports(relativePath) {
    const ozPath = path.resolve(__dirname, 'node_modules', relativePath);
    if (fs.existsSync(ozPath)) {
        return { contents: fs.readFileSync(ozPath, 'utf8') };
    }
    // برای import های نسبی مانند ./Contract.sol
    const localPath = path.resolve(__dirname, relativePath);
     if (fs.existsSync(localPath)) {
        return { contents: fs.readFileSync(localPath, 'utf8') };
    }
    return { error: 'File not found' };
}

// --- بخش اصلی کامپایل برای artifacts.json ---
function compileForArtifacts() {
    const input = {
        language: 'Solidity',
        sources: {},
        settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
    };
    mainContractPaths.forEach(filePath => {
        input.sources[path.basename(filePath)] = { content: fs.readFileSync(filePath, 'utf8') };
    });

    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

    if (output.errors) {
        let hasError = false;
        output.errors.forEach(err => {
            if (err.severity === 'error') {
                console.error(err.formattedMessage);
                hasError = true;
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


// --- بخش جدید برای ساخت فایل‌های وریفای ---
function generateVerificationFiles() {
    console.log('\nGenerating verification files...');
    mainContractPaths.forEach(mainPath => {
        const sources = {};
        const filesToProcess = [mainPath];
        const processedFiles = new Set();

        while (filesToProcess.length > 0) {
            const currentPath = filesToProcess.pop();
            if (processedFiles.has(currentPath)) continue;
            
            const absolutePath = path.resolve(__dirname, currentPath);
            if (!fs.existsSync(absolutePath)) {
                console.warn(`Warning: could not find file ${currentPath}`);
                continue;
            }

            processedFiles.add(currentPath);
            const sourceCode = fs.readFileSync(absolutePath, 'utf8');
            // کلید باید مسیر نسبی باشد که کامپایلر انتظار دارد
            sources[currentPath] = { content: sourceCode };

            const importRegex = /import\s+"([^"]+)";/g;
            let match;
            while ((match = importRegex.exec(sourceCode)) !== null) {
                let importPath = match[1];
                let resolvedPath;
                if (importPath.startsWith('@openzeppelin/')) {
                    resolvedPath = 'node_modules/' + importPath;
                } else {
                    resolvedPath = path.join(path.dirname(currentPath), importPath);
                }
                filesToProcess.push(resolvedPath);
            }
        }

        const verificationInput = {
            language: 'Solidity',
            sources: sources,
            settings: {
                optimizer: { enabled: false, runs: 200 },
                outputSelection: { "*": { "*": [ "abi", "evm.bytecode" ] } }
            }
        };
        
        const contractName = path.basename(mainPath, '.sol');
        const outputFilename = `verification_${contractName}.json`;
        fs.writeFileSync(outputFilename, JSON.stringify(verificationInput, null, 2));
        console.log(`  -> Created ${outputFilename}`);
    });
}

// اجرای هر دو تابع
compileForArtifacts();
generateVerificationFiles();
