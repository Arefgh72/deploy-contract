document.addEventListener('DOMContentLoaded', () => {
    // ... (متغیرهای UI مثل قبل) ...
    
    // متغیرهای سراسری
    let artifacts = {};
    let signer = null;
    let listenersAttached = false; // <-- جدید: یک پرچم برای اینکه بدانیم شنونده‌ها فعال شده‌اند یا نه

    // ... (تمام توابع کمکی دیگر مثل قبل) ...
    // getStoredDeployments, saveDeployments, log, clearLogs, showView, 
    // generateStandardJsonInput, downloadJson, displayVerificationLinks, executeDeploy

    // --- تابع connectWallet ویرایش شده ---
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
            if (networkName === "unknown") {
                networkName = "شبکه ناشناس";
            } else if (networkName === "homestead") {
                networkName = "Ethereum Mainnet";
            }

            document.getElementById('wallet-address').innerText = `آدرس: ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
            document.getElementById('wallet-network').innerText = `شبکه: ${networkName} (ID: ${network.chainId})`;
            
            walletInfoDiv.classList.remove('hidden');

            // --- بخش جدید: فقط یک بار و پس از اتصال موفق، شنونده‌ها را فعال کن ---
            if (!listenersAttached && window.ethereum) {
                window.ethereum.on('chainChanged', (_chainId) => {
                    console.log('Network changed. Reloading the page...');
                    window.location.reload();
                });
        
                window.ethereum.on('accountsChanged', (accounts) => {
                    console.log('Account changed or disconnected. Reloading the page...');
                    window.location.reload();
                });
                listenersAttached = true; // پرچم را تنظیم کن تا دوباره فعال نشوند
            }
            // -------------------------------------------------------------
            
            return true;
        } catch (error) {
            log(`❌ خطا در اتصال به کیف پول: ${error.message}`);
            return false;
        }
    }

    // --- تمام Event Listener های دکمه‌ها بدون تغییر باقی می‌مانند ---
    // document.getElementById('deploy-nft').addEventListener(...)
    // ...

    // --- تابع اصلی برای شروع کار ---
    async function initialize() {
        await loadArtifacts();
        const storedDeployments = getStoredDeployments();
        displayVerificationLinks(storedDeployments);
    }
    
    initialize();
});
