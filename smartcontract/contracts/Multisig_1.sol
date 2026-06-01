// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Multisig_1 {
    uint256 public constant THRESHOLD = 2;
    uint256 public constant OWNER_COUNT = 3;

    struct Transaction {
        address target;
        bytes data;
        bool executed;
        uint256 confirmations;
    }

    address[3] private _owners;
    Transaction[] private _transactions;

    mapping(address owner => bool active) public isOwner;
    mapping(uint256 txId => mapping(address owner => bool confirmed))
        public confirmedBy;

    event TransactionSubmitted(
        uint256 indexed txId,
        address indexed owner,
        address indexed target,
        bytes data
    );
    event TransactionConfirmed(
        uint256 indexed txId,
        address indexed owner,
        uint256 confirmations
    );
    event TransactionExecuted(uint256 indexed txId);

    error InvalidOwnerSet();
    error NotOwner(address account);
    error InvalidTarget();
    error TransactionNotFound(uint256 txId);
    error TransactionAlreadyExecuted(uint256 txId);
    error TransactionAlreadyConfirmed(uint256 txId, address owner);
    error NotEnoughConfirmations(uint256 txId);
    error TransactionCallFailed(uint256 txId);

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) {
            revert NotOwner(msg.sender);
        }
        _;
    }

    modifier txExists(uint256 txId) {
        if (txId >= _transactions.length) {
            revert TransactionNotFound(txId);
        }
        _;
    }

    constructor(address[] memory owners_) {
        if (owners_.length != OWNER_COUNT) {
            revert InvalidOwnerSet();
        }

        for (uint256 i = 0; i < OWNER_COUNT; i++) {
            address owner = owners_[i];
            if (owner == address(0) || isOwner[owner]) {
                revert InvalidOwnerSet();
            }

            _owners[i] = owner;
            isOwner[owner] = true;
        }
    }

    receive() external payable {}

    function owners() external view returns (address[3] memory) {
        return _owners;
    }

    function transactionCount() external view returns (uint256) {
        return _transactions.length;
    }

    function submitTransaction(
        address target,
        bytes calldata data
    ) external onlyOwner returns (uint256 txId) {
        if (target == address(0)) {
            revert InvalidTarget();
        }

        txId = _transactions.length;
        _transactions.push(
            Transaction({
                target: target,
                data: data,
                executed: false,
                confirmations: 0
            })
        );

        emit TransactionSubmitted(txId, msg.sender, target, data);
        _confirmTransaction(txId, msg.sender);
    }

    function confirmTransaction(
        uint256 txId
    ) external onlyOwner txExists(txId) {
        _confirmTransaction(txId, msg.sender);
    }

    function executeTransaction(uint256 txId) public onlyOwner txExists(txId) {
        Transaction storage transaction_ = _transactions[txId];

        if (transaction_.executed) {
            revert TransactionAlreadyExecuted(txId);
        }
        if (transaction_.confirmations < THRESHOLD) {
            revert NotEnoughConfirmations(txId);
        }

        transaction_.executed = true;
        (bool success, ) = transaction_.target.call(transaction_.data);
        if (!success) {
            revert TransactionCallFailed(txId);
        }

        emit TransactionExecuted(txId);
    }

    function getTransaction(
        uint256 txId
    )
        external
        view
        txExists(txId)
        returns (
            address target,
            bytes memory data,
            bool executed,
            uint256 confirmations
        )
    {
        Transaction storage transaction_ = _transactions[txId];
        return (
            transaction_.target,
            transaction_.data,
            transaction_.executed,
            transaction_.confirmations
        );
    }

    function _confirmTransaction(uint256 txId, address owner) private {
        Transaction storage transaction_ = _transactions[txId];

        if (transaction_.executed) {
            revert TransactionAlreadyExecuted(txId);
        }
        if (confirmedBy[txId][owner]) {
            revert TransactionAlreadyConfirmed(txId, owner);
        }

        confirmedBy[txId][owner] = true;
        transaction_.confirmations += 1;

        emit TransactionConfirmed(txId, owner, transaction_.confirmations);

        if (transaction_.confirmations >= THRESHOLD) {
            executeTransaction(txId);
        }
    }
}
