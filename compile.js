const fs = require('fs');
const path = require('path');
const solc = require('solc');

// لیست قراردادهای اصلی شما که برای هر کدام یک فایل وریفای ساخته می‌شود
const mainContractFiles = [
    "YazdParadiseNFT.sol",
    "ParsToken.sol",
    "MainContract.sol",
    "InteractFeeProxy.sol",
    "GenericNFT.sol",
    "GenericToken.sol",
    "SimpleContract.sol"
];

// --- بخش ۱: کامپایل برای artifacts.json (برای استفاده در UI) ---
function compileForArtifacts() {
    const input = {
        language: 'Solidity',
        sources: {},
        settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
    };

    mainContractFiles.forEach(fileName => {
        input.sources[fileName] = { content: fs.readFileSync(path.resolve(__dirname, 'contracts', fileName), 'utf8') };
    });

    // تابع callback برای پیدا کردن import ها
    const findImports = (importPath) => {
        try {
            const fullPath = require.resolve(importPath, { paths: [__dirname, path.resolve(__dirname, 'contracts')] });
            return { contents: fs.readFileSync(fullPath, 'utf8') };
        } catch (e) {
            try {
                 const fullPath = require.resolve(path.join('./node_modules/', importPath));
                 return { contents: fs.readFileSync(fullPath, 'utf8') };
            } catch (e2) {
                 return { error: 'File not found' };
            }
        }
    };

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

// --- بخش ۲: ساخت فایل‌های وریفای کامل و جامع ---
function generateVerificationFiles() {
    console.log('\nGenerating verification files...');
    mainContractFiles.forEach(mainFile => {
        const mainFilePath = `contracts/${mainFile}`;
        const sources = {};
        const filesToProcess = [mainFilePath];
        const processedFiles = new Set();

        while (filesToProcess.length > 0) {
            let currentPath = filesToProcess.pop();
            if (processedFiles.has(currentPath)) continue;

            let absolutePath;
            // تلاش برای پیدا کردن فایل در مسیرهای مختلف
            if (currentPath.startsWith('@openzeppelin/')) {
                 absolutePath = require.resolve(currentPath, { paths: [path.resolve(__dirname, 'node_modules')] });
            } else {
                 absolutePath = path.resolve(__dirname, currentPath);
            }

            if (!fs.existsSync(absolutePath)) {
                console.warn(`Warning: Could not find file ${currentPath}`);
                continue;
            }
            
            processedFiles.add(currentPath);
            const sourceCode = fs.readFileSync(absolutePath, 'utf8');
            sources[currentPath] = { content: sourceCode };

            const importRegex = /import\s+"([^"]+)";/g;
            let match;
            while ((match = importRegex.exec(sourceCode)) !== null) {
                let importPath = match[1];
                // نرمال‌سازی مسیر برای import های نسبی
                 if (importPath.startsWith('./') || importPath.startsWith('../')) {
                    importPath = path.normalize(path.join(path.dirname(currentPath), importPath));
                }
                filesToProcess.push(importPath);
            }
        }

        const verificationInput = {
            language: 'Solidity',
            sources: sources,
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

// اجرای هر دو تابع
compileForArtifacts();
generateVerificationFiles();
