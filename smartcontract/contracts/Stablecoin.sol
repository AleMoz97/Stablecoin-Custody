// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {
    ERC20Pausable
} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

contract Stablecoin is ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant FREEZER_ROLE = keccak256("FREEZER_ROLE");

    mapping(address account => bool frozen) private _frozenAccounts;

    event AccountFrozen(address indexed account, address indexed operator);
    event AccountUnfrozen(address indexed account, address indexed operator);

    error ZeroAddress();
    error AccountIsFrozen(address account);

    constructor(
        address mintBurnMultisig,
        address adminMultisig
    ) ERC20("Stablecoin", "STBC") {
        if (mintBurnMultisig == address(0) || adminMultisig == address(0)) {
            revert ZeroAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, adminMultisig);
        _grantRole(MINTER_ROLE, mintBurnMultisig);
        _grantRole(BURNER_ROLE, mintBurnMultisig);
        _grantRole(PAUSER_ROLE, adminMultisig);
        _grantRole(FREEZER_ROLE, adminMultisig);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) {
            revert ZeroAddress();
        }
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        if (from == address(0)) {
            revert ZeroAddress();
        }
        _burn(from, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function freeze(address account) external onlyRole(FREEZER_ROLE) {
        if (account == address(0)) {
            revert ZeroAddress();
        }
        if (!_frozenAccounts[account]) {
            _frozenAccounts[account] = true;
            emit AccountFrozen(account, msg.sender);
        }
    }

    function unfreeze(address account) external onlyRole(FREEZER_ROLE) {
        if (account == address(0)) {
            revert ZeroAddress();
        }
        if (_frozenAccounts[account]) {
            _frozenAccounts[account] = false;
            emit AccountUnfrozen(account, msg.sender);
        }
    }

    function isFrozen(address account) external view returns (bool) {
        return _frozenAccounts[account];
    }
    //Questa funzione intercetta ogni movimento del token prima che OpenZeppelin aggiorni i saldi.
    //In OpenZeppelin ERC-20 v5, _update(from, to, value) è il punto centrale usato per:
    //transfer: from e to sono entrambi indirizzi reali
    //mint: from == address(0)
    //burn: to == address(0)
    // evita lo scambio token nel caso in cui uno dei due indirizzi sia frozen
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Pausable) {
        if (from != address(0) && _frozenAccounts[from]) {
            revert AccountIsFrozen(from);
        }
        if (to != address(0) && _frozenAccounts[to]) {
            revert AccountIsFrozen(to);
        }
        super._update(from, to, value);
    }
}
