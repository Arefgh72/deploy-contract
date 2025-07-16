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
    
    // متغیرهای سراسری
    let artifacts = {};
    let signer = null;

    // --- توابع برای مدیریت حافظه موقت مرورگر ---
    function getStoredDeployments() {
        const stored = sessionStorage.getItem('deployedContracts');
        return stored ? JSON.parse(stored) : [];
    }

    function saveDeployments(deployments) {
        sessionStorage.setItem('deployedContracts', JSON.stringify(deployments));
    }

    // --- توابع کمکی ---
    function log(message) {
        logsDiv.innerHTML += message + '\n';
        logsDiv.scrollTop = logsDiv.scrollHeight; // اسکرول به پایین
    }
    function clearLogs() { logsDiv.innerHTML = ''; }

    function showView(viewName) {
        Object.values(views).forEach(v => v.classList.add('hidden'));
        if (views[viewName]) {
            views[viewName].classList.remove('hidden');
            controls.classList.remove('hidden');
        } else { // اگر به منوی اصلی برگردیم
            controls.classList.add('hidden');
            views.menu.classList.remove('hidden');
        }
    }

    // --- توابع اصلی ---
    async function connectWallet() {
        if (signer) return true;
        try {
            if (typeof window.ethereum === 'undefined') throw new Error("کیف پول MetaMask یافت نشد.");
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer = provider.getSigner();
            
            const address = await signer.getAddress();
            const network = await provider.getNetwork();
            document.getElementById('wallet-address').innerText = `آدرس: ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
            document.getElementById('wallet-network').innerText = `شبکه: ${network.name} (ID: ${network.chainId})`;
            walletInfoDiv.classList.remove('hidden');
            
            return true;
        } catch (error) {
            log(`❌ خطا در اتصال به کیف پول: ${error.message}`);
            return false;
        }
    }

    function generateStandardJsonInput(contractPath, sourceCode) {
        return {
            language: "Solidity",
            sources: { [contractPath]: { content: sourceCode } },
            settings: {
                optimizer: { enabled: false, runs: 200 },
                outputSelection: { "*": { "*": [ "abi", "evm.bytecode", "evm.deployedBytecode", "evm.methodIdentifiers", "metadata" ] } },
                metadata: { useLiteralContent: true },
                libraries: {}
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
        downloadLinksDiv.innerHTML = ''; 
        if (deployedContracts.length === 0) {
            verificationSection.classList.add('hidden');
            return;
        }

        deployedContracts.forEach(({ contractClass, contractAddress, displayName, type, path }, index) => {
            const itemContainer = document.createElement('div');
            itemContainer.classList.add('verification-item');
            
            const button = document.createElement('button');
            const cleanDisplayName = displayName.replace(/\s+/g, '-');
            const filename = `${cleanDisplayName}_${type}_${index + 1}_(${contractAddress}).json`;

            button.innerText = `دانلود فایل وریفای برای: ${displayName} (${type})`;
            
            button.onclick = async () => {
                try {
                    log(`\nدر حال آماده‌سازی فایل برای ${displayName}...`);
                    const response = await fetch(`./${path}`);
                    if (!response.ok) throw new Error(`فایل سورس ${path} یافت نشد.`);
                    const sourceCode = await response.text();
                    const standardJson = generateStandardJsonInput(path, sourceCode);
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
            log(`\nدر حال استقرار ${contractName}... لطفاً تراکنش را تایید کنید.`);
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
            button.innerText = 'استقرار';
        }
    }

    // --- Event Listeners ---

    document.getElementById('deploy-nft').addEventListener('click', async (e) => {
        clearLogs();
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
            
            const factoryNFT = new ethers.ContractFactory(artifacts['YazdParadiseNFT'].abi, artifacts['YazdParadiseNFT'].bytecode, signer);
            const yazdParadiseNFT = await factoryNFT.deploy(deployerAddress);
            await yazdParadiseNFT.deployed();
            log(`-> YazdParadiseNFT در آدرس ${yazdParadiseNFT.address} دیپلوی شد.`);

            const factoryToken = new ethers.ContractFactory(artifacts['ParsToken'].abi, artifacts['ParsToken'].bytecode, signer);
            const parsToken = await factoryToken.deploy(deployerAddress);
            await parsToken.deployed();
            log(`-> ParsToken در آدرس ${parsToken.address} دیپلوی شد.`);

            const factoryMain = new ethers.ContractFactory(artifacts['MainContract'].abi, artifacts['MainContract'].bytecode, signer);
            const mainContract = await factoryMain.deploy(yazdParadiseNFT.address, parsToken.address, deployerAddress);
            await mainContract.deployed();
            log(`-> MainContract در آدرس ${mainContract.address} دیپلوی شد.`);
            
            const factoryProxy = new ethers.ContractFactory(artifacts['InteractFeeProxy'].abi, artifacts['InteractFeeProxy'].bytecode, signer);
            const proxyContract = await factoryProxy.deploy(mainContract.address);
            await proxyContract.deployed();
            log(`-> InteractFeeProxy در آدرس ${proxyContract.address} دیپلوی شد.`);

            log('\n✅ مجموعه با موفقیت دیپلوی شد.');

            const newDeployments = [
                { contractClass: 'YazdParadiseNFT', contractAddress: yazdParadiseNFT.address, displayName: 'YazdParadiseNFT', type: 'Protocol-NFT', path: 'contracts/YazdParadiseNFT.sol' },
                { contractClass: 'ParsToken', contractAddress: parsToken.address, displayName: 'ParsToken', type: 'Protocol-Token', path: 'contracts/ParsToken.sol' },
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

    if (window.ethereum) {
        window.ethereum.on('chainChanged', (_chainId) => {
            window.location.reload();
        });
    }

    async function initialize() {
        await loadArtifacts();
        const storedDeployments = getStoredDeployments();
        displayVerificationLinks(storedDeployments);
    }
    
    initialize();
});
