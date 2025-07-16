document.addEventListener('DOMContentLoaded', () => {
    // تعریف متغیرهای UI
    const views = {
        menu: document.getElementById('main-menu'),
        yazd: document.getElementById('view-yazd'),
        nft: document.getElementById('view-nft'),
        token: document.getElementById('view-token'),
        simple: document.getElementById('view-simple'),
    };
    const controls = document.getElementById('controls');
    const logsDiv = document.getElementById('logs');
    const walletInfoDiv = document.getElementById('wallet-info');
    const verificationSection = document.getElementById('verification-section');
    const downloadLinksDiv = document.getElementById('download-links');
    
    let artifacts = {};
    let signer = null;
    let listenersAttached = false;

    // توابع کمکی برای path (چون در مرورگر path نداریم)
    const path = {
        dirname: (p) => p.substring(0, p.lastIndexOf('/')),
        join: (...args) => args.join('/').replace(/\/+/g, '/'),
        basename: (p) => p.substring(p.lastIndexOf('/') + 1)
    };

    // --- توابع برای مدیریت حافظه موقت مرورگر ---
    function getStoredDeployments() {
        const stored = sessionStorage.getItem('deployedContracts');
        return stored ? JSON.parse(stored) : [];
    }

    function saveDeployments(deployments) {
        sessionStorage.setItem('deployedContracts', JSON.stringify(deployments));
    }

    function log(message) {
        logsDiv.innerHTML += message + '\n';
        logsDiv.scrollTop = logsDiv.scrollHeight;
    }

    function clearLogs() { logsDiv.innerHTML = ''; }

    function showView(viewName) {
        Object.values(views).forEach(v => v.classList.add('hidden'));
        if (views[viewName]) {
            views[viewName].classList.remove('hidden');
            controls.classList.remove('hidden');
        } else {
            controls.classList.add('hidden');
            views.menu.classList.remove('hidden');
        }
    }

    async function loadArtifacts() {
        try {
            const response = await fetch('./artifacts.json');
            if (!response.ok) throw new Error("فایل artifacts.json یافت نشد.");
            artifacts = await response.json();
            log("فایل‌های ABI و Bytecode با موفقیت بارگذاری شدند. سیستم آماده است.");
            document.getElementById('deploy-yazd').innerText = 'شروع استقرار';
            document.getElementById('deploy-nft').innerText = 'استقرار NFT';
            document.getElementById('deploy-token').innerText = 'استقرار توکن';
            document.getElementById('deploy-simple').innerText = 'استقرار قرارداد ساده';
            document.querySelectorAll('.deploy-button').forEach(btn => btn.disabled = false);
        } catch (error) {
            log(`❌ خطا در بارگذاری فایل‌های اولیه: ${error.message}. لطفاً صفحه را رفرش کنید.`);
        }
    }

    async function connectWallet() {
        if (signer) return true;
        try {
            if (typeof window.ethereum === 'undefined') throw new Error("کیف پول MetaMask یافت نشد.");
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer = provider.getSigner();
            const address = await signer.getAddress();
            const network = await provider.getNetwork();
            let networkName = network.name;
            if (networkName === "unknown") networkName = "شبکه ناشناس";
            else if (networkName === "homestead") networkName = "Ethereum Mainnet";
            document.getElementById('wallet-address').innerText = `آدرس: ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
            document.getElementById('wallet-network').innerText = `شبکه: ${networkName} (ID: ${network.chainId})`;
            walletInfoDiv.classList.remove('hidden');
            if (!listenersAttached && window.ethereum) {
                window.ethereum.on('chainChanged', () => window.location.reload());
                window.ethereum.on('accountsChanged', () => window.location.reload());
                listenersAttached = true;
            }
            return true;
        } catch (error) {
            log(`❌ خطا در اتصال به کیف پول: ${error.message}`);
            return false;
        }
    }

    async function fetchSourceWithImports(initialPath) {
        const sources = {};
        const filesToProcess = [initialPath];
        const processedFiles = new Set();

        while (filesToProcess.length > 0) {
            const currentPath = filesToProcess.pop();
            if (processedFiles.has(currentPath)) continue;
            processedFiles.add(currentPath);

            log(`   -> در حال واکشی ${currentPath}`);
            const response = await fetch(`./${currentPath}`);
            if (!response.ok) throw new Error(`فایل سورس ${currentPath} یافت نشد.`);
            const sourceCode = await response.text();
            
            const sourceKey = currentPath;
            sources[sourceKey] = { content: sourceCode };

            const importRegex = /import\s+"([^"]+)";/g;
            let match;
            while ((match = importRegex.exec(sourceCode)) !== null) {
                let importPath = match[1];
                if (importPath.startsWith('@openzeppelin/')) {
                    importPath = 'node_modules/' + importPath;
                } else if (importPath.startsWith('./')) {
                    const dir = path.dirname(currentPath);
                    importPath = path.join(dir, importPath);
                }
                if (!processedFiles.has(importPath)) {
                    filesToProcess.push(importPath);
                }
            }
        }
        log('   -> تمام فایل‌های وابسته با موفقیت واکشی شدند.');
        return sources;
    }

    function generateStandardJsonInput(sources) {
        return {
            language: "Solidity",
            sources: sources,
            settings: {
                optimizer: { enabled: false, runs: 200 },
                outputSelection: { "*": { "*": [ "abi", "evm.bytecode" ] } },
                metadata: { useLiteralContent: true },
            }
        };
    }

    function downloadJson(data, filename) {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function displayVerificationLinks(deployedContracts) {
        const downloadLinksDiv = document.getElementById('download-links');
        const verificationSection = document.getElementById('verification-section');
        downloadLinksDiv.innerHTML = '';
        if (deployedContracts.length === 0) {
            verificationSection.classList.add('hidden');
            return;
        }

        deployedContracts.forEach(({ contractClass, contractAddress, displayName, type, path: contractPath }, index) => {
            const itemContainer = document.createElement('div');
            itemContainer.classList.add('verification-item');
            const button = document.createElement('button');
            const filename = `${displayName.replace(/\s+/g, '-')}_${type}_${index + 1}_(${contractAddress}).json`;
            button.innerText = `دانلود فایل وریفای برای: ${displayName} (${type})`;
            
            button.onclick = async () => {
                try {
                    log(`\nدر حال آماده‌سازی فایل جامع برای ${displayName}...`);
                    const allSources = await fetchSourceWithImports(contractPath);
                    const standardJson = generateStandardJsonInput(allSources);
                    downloadJson(standardJson, filename);
                    log(`-> فایل ${filename} آماده دانلود است.`);
                } catch (error) {
                    log(`❌ خطا در ساخت فایل: ${error.message}`);
                }
            };

            const infoParagraph = document.createElement('p');
            infoParagraph.classList.add('verification-item-info');
            infoParagraph.innerHTML = `آدرس: ${contractAddress}<br>نام قرارداد (برای وریفای): <strong>${contractClass}</strong>`;
            
            itemContainer.appendChild(button);
            itemContainer.appendChild(infoParagraph);
            downloadLinksDiv.appendChild(itemContainer);
        });
        verificationSection.classList.remove('hidden');
    }

    async function executeDeploy(contractName, args, button) {
        button.disabled = true;
        button.innerText = 'در حال انجام...';
        try {
            if (!await connectWallet()) throw new Error("اتصال به کیف پول لغو شد.");
            log(`\nدر حال استقرار ${contractName}...`);
            const factory = new ethers.ContractFactory(artifacts[contractName].abi, artifacts[contractName].bytecode, signer);
            const contract = await factory.deploy(...args);
            await contract.deployed();
            log(`✅ قرارداد ${contractName} در آدرس ${contract.address} دیپلوی شد.`);
            return contract;
        } catch (error) {
            log(`\n❌ عملیات با خطا مواجه شد: ${error.message}`);
            return null;
        } finally {
            button.disabled = false;
        }
    }

    document.getElementById('deploy-nft').addEventListener('click', async (e) => {
        clearLogs();
        if (!await connectWallet()) return;
        const name = document.getElementById('nft-name').value;
        const symbol = document.getElementById('nft-symbol').value;
        if (!name || !symbol) { alert('نام و نماد الزامی است.'); return; }
        const deployerAddress = await signer.getAddress();
        const contract = await executeDeploy('GenericNFT', [name, symbol, deployerAddress], e.target);
        if (contract) {
            const newDeployment = { contractClass: 'GenericNFT', contractAddress: contract.address, displayName: name, type: 'NFT', path: 'contracts/GenericNFT.sol' };
            const allDeployments = getStoredDeployments();
            allDeployments.push(newDeployment);
            saveDeployments(allDeployments);
            displayVerificationLinks(allDeployments);
        }
    });

    document.getElementById('deploy-token').addEventListener('click', async (e) => {
        clearLogs();
        if (!await connectWallet()) return;
        const name = document.getElementById('token-name').value;
        const symbol = document.getElementById('token-symbol').value;
        if (!name || !symbol) { alert('نام و نماد الزامی است.'); return; }
        const deployerAddress = await signer.getAddress();
        const contract = await executeDeploy('GenericToken', [name, symbol, deployerAddress], e.target);
        if (contract) {
            const newDeployment = { contractClass: 'GenericToken', contractAddress: contract.address, displayName: name, type: 'Token', path: 'contracts/GenericToken.sol' };
            const allDeployments = getStoredDeployments();
            allDeployments.push(newDeployment);
            saveDeployments(allDeployments);
            displayVerificationLinks(allDeployments);
        }
    });

    document.getElementById('deploy-simple').addEventListener('click', async (e) => {
        clearLogs();
        if (!await connectWallet()) return;
        const deployerAddress = await signer.getAddress();
        const contract = await executeDeploy('SimpleContract', [deployerAddress], e.target);
        if (contract) {
            const newDeployment = { contractClass: 'SimpleContract', contractAddress: contract.address, displayName: 'Simple-Contract', type: 'Contract', path: 'contracts/SimpleContract.sol' };
            const allDeployments = getStoredDeployments();
            allDeployments.push(newDeployment);
            saveDeployments(allDeployments);
            displayVerificationLinks(allDeployments);
        }
    });

    document.getElementById('deploy-yazd').addEventListener('click', async (e) => {
        clearLogs();
        log('شروع فرآیند استقرار کامل پروتکل یزد...');
        const button = e.target;
        button.disabled = true;
        button.innerText = 'در حال انجام...';
        try {
            if (!await connectWallet()) throw new Error("اتصال به کیف پول لغو شد.");
            const deployerAddress = await signer.getAddress();
            const deployedContracts = {};
            
            const factoryNFT = new ethers.ContractFactory(artifacts['YazdParadiseNFT'].abi, artifacts['YazdParadiseNFT'].bytecode, signer);
            const yazdParadiseNFT = await factoryNFT.deploy(deployerAddress);
            await yazdParadiseNFT.deployed();
            log(`-> YazdParadiseNFT در آدرس ${yazdParadiseNFT.address} دیپلوی شد.`);
            deployedContracts['YazdParadiseNFT'] = { address: yazdParadiseNFT.address };

            const factoryToken = new ethers.ContractFactory(artifacts['ParsToken'].abi, artifacts['ParsToken'].bytecode, signer);
            const parsToken = await factoryToken.deploy(deployerAddress);
            await parsToken.deployed();
            log(`-> ParsToken در آدرس ${parsToken.address} دیپلوی شد.`);
            deployedContracts['ParsToken'] = { address: parsToken.address };
            
            const factoryMain = new ethers.ContractFactory(artifacts['MainContract'].abi, artifacts['MainContract'].bytecode, signer);
            const mainContract = await factoryMain.deploy(deployedContracts['YazdParadiseNFT'].address, deployedContracts['ParsToken'].address, deployerAddress);
            await mainContract.deployed();
            log(`-> MainContract در آدرس ${mainContract.address} دیپلوی شد.`);
            
            const factoryProxy = new ethers.ContractFactory(artifacts['InteractFeeProxy'].abi, artifacts['InteractFeeProxy'].bytecode, signer);
            const proxyContract = await factoryProxy.deploy(mainContract.address);
            await proxyContract.deployed();
            log(`-> InteractFeeProxy در آدرس ${proxyContract.address} دیپلوی شد.`);

            log('\n✅ مجموعه با موفقیت دیپلوی شد.');

            const newDeployments = [
                { contractClass: 'YazdParadiseNFT', contractAddress: deployedContracts['YazdParadiseNFT'].address, displayName: 'YazdParadiseNFT', type: 'Protocol-NFT', path: 'contracts/YazdParadiseNFT.sol' },
                { contractClass: 'ParsToken', contractAddress: deployedContracts['ParsToken'].address, displayName: 'ParsToken', type: 'Protocol-Token', path: 'contracts/ParsToken.sol' },
                { contractClass: 'MainContract', contractAddress: mainContract.address, displayName: 'MainContract', type: 'Protocol-Main', path: 'contracts/MainContract.sol' },
                { contractClass: 'InteractFeeProxy', contractAddress: proxyContract.address, displayName: 'InteractFeeProxy', type: 'Protocol-Proxy', path: 'contracts/InteractFeeProxy.sol' }
            ];
            const allDeployments = getStoredDeployments();
            saveDeployments(allDeployments.concat(newDeployments));
            displayVerificationLinks(getStoredDeployments());

        } catch (error) {
            log(`\n❌ عملیات با خطا مواجه شد: ${error.message}`);
        } finally {
            button.disabled = false;
            button.innerText = 'شروع استقرار';
        }
    });
    
    document.getElementById('btn-show-yazd').addEventListener('click', () => showView('yazd'));
    document.getElementById('btn-show-nft').addEventListener('click', () => showView('nft'));
    document.getElementById('btn-show-token').addEventListener('click', () => showView('token'));
    document.getElementById('btn-show-simple').addEventListener('click', () => showView('simple'));
    document.getElementById('back-to-menu').addEventListener('click', () => showView(null));
    
    async function initialize() {
        await loadArtifacts();
        const storedDeployments = getStoredDeployments();
        displayVerificationLinks(storedDeployments);
    }
    
    initialize();
});
