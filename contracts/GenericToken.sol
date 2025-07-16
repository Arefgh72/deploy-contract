// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GenericToken
 * @dev یک قرارداد استاندارد ERC20 که نام و نماد را در زمان ساخت دریافت می‌کند.
 */
contract GenericToken is ERC20, Ownable {
    /**
     * @dev سازنده قرارداد که نام، نماد و مالک اولیه را تنظیم می‌کند.
     * @param name نام توکن.
     * @param symbol نماد توکن.
     * @param initialOwner آدرس مالک اولیه قرارداد.
     */
    constructor(string memory name, string memory symbol, address initialOwner)
        ERC20(name, symbol)
        Ownable(initialOwner)
    {}

    /**
     * @dev به مالک اجازه می‌دهد مقدار مشخصی توکن جدید برای یک آدرس ایجاد کند.
     * @param to آدرسی که توکن‌ها را دریافت می‌کند.
     * @param amount مقداری از توکن که باید مینت شود.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
