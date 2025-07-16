// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GenericNFT
 * @dev یک قرارداد استاندارد ERC721 که نام و نماد را در زمان ساخت دریافت می‌کند.
 */
contract GenericNFT is ERC721, Ownable {
    uint256 private _nextTokenId;

    /**
     * @dev سازنده قرارداد که نام، نماد و مالک اولیه را تنظیم می‌کند.
     * @param name نام مجموعه NFT.
     * @param symbol نماد مجموعه NFT.
     * @param initialOwner آدرس مالک اولیه قرارداد.
     */
    constructor(string memory name, string memory symbol, address initialOwner)
        ERC721(name, symbol)
        Ownable(initialOwner)
    {}

    /**
     * @dev به مالک اجازه می‌دهد یک NFT جدید با آی‌دی دلخواه مینت کند.
     * @param to آدرسی که NFT جدید را دریافت می‌کند.
     * @param tokenId آی‌دی توکنی که باید مینت شود.
     */
    function safeMint(address to, uint256 tokenId) public onlyOwner {
        _safeMint(to, tokenId);
    }
    
    /**
     * @dev به مالک اجازه می‌دهد یک NFT جدید با آی‌دی خودکار مینت کند.
     * @param to آدرسی که NFT جدید را دریافت می‌کند.
     * @return آی‌دی توکن جدید ایجاد شده.
     */
    function mint(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }
}
