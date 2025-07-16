const fs = require('fs');
const path = require('path');
const solc = require('solc');

// لیست قراردادهای اصلی شما
const mainContractFiles = [
    "YazdParadiseNFT.sol",
    "ParsToken.sol",
    "MainContract.sol",
    "InteractFeeProxy.sol",
    "GenericNFT.sol",
    "GenericToken.sol",
    "SimpleContract.sol"
];

function findImports(importPath) {
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
            return { error: `File not found: ${importPath}` };
        }
    }
}

function compileForArtifacts() {
    const input = {
        language: 'Solidity',
        sources: {},
        settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
    };
    mainContractFiles.forEach(fileName => {
        input.sources[fileName] = { content: fs.readFileSync(path.resolve(__dirname, 'contracts', fileName), 'utf8') };
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
            try {
                if (currentPath.startsWith('.')) {
                    absolutePath = path.resolve(currentPath);
                } else {
                    absolutePath = require.resolve(currentPath, {
                        paths: [path.resolve(__dirname, 'contracts'), path.resolve(__dirname, 'node_modules')]
                    });
                }
            } catch (e) {
                console.warn(`Warning: Could not resolve ${currentPath}`);
                continue;
            }
            
            processedFiles.add(currentPath);
            const sourceCode = fs.readFileSync(absolutePath, 'utf8');
            sources[currentPath] = { content: sourceCode };

            const importRegex = /import\s+"([^"]+)";/g;
            let match;
            while ((match = importRegex.exec(sourceCode)) !== null) {
                let importPath = match[1];
                let resolvedPath = importPath;
                if (importPath.startsWith('./') || importPath.startsWith('../')) {
                    resolvedPath = path.join(path.dirname(currentPath), importPath);
                    // نرمال‌سازی مسیر برای حذف '..' و '.'
                    resolvedPath = path.normalize(resolvedPath);
                }
                if (!processedFiles.has(resolvedPath)) {
                    filesToProcess.push(resolvedPath);
                }
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

compileForArtifacts();
generateVerificationFiles();
