// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimpleContract
 * @dev یک قرارداد بسیار ساده که فقط قابلیت مالکیت دارد.
 */
contract SimpleContract is Ownable {
    /**
     * @dev سازنده قرارداد که مالک اولیه را تنظیم می‌کند.
     * @param initialOwner آدرس مالک اولیه قرارداد.
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    // این قرارداد هیچ تابع دیگری ندارد و فقط برای نمایش استقرار استفاده می‌شود.
}
