// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title RentSplitter — one rent payment in, automatic split out
/// @notice Tenants (or a property manager) send rent to this contract and it is
///         split immediately across the configured payees by basis-point shares:
///         e.g. lender 7000 bps (70%), property manager 1000 bps (10%),
///         owner 2000 bps (20%). Any dust remainder from integer division goes
///         to payees[0].
///
///         TRUST ASSUMPTION: the owner can change payees and shares at any time
///         via updatePayees. Only deploy with an owner you trust (or transfer
///         ownership to a multisig), and have tenants verify the payee set
///         before paying.
contract RentSplitter is Ownable {
    uint256 public constant BPS_DENOMINATOR = 10000;

    address[] public payees;
    uint256[] public sharesBps;

    event PayeesUpdated(address[] payees, uint256[] sharesBps);
    event RentDistributed(address indexed payer, uint256 amount);

    error ZeroValue();
    error NoPayees();
    error LengthMismatch();
    error ZeroAddress();
    error BadShares();

    constructor(address[] memory _payees, uint256[] memory _sharesBps) Ownable(msg.sender) {
        _setPayees(_payees, _sharesBps);
    }

    /// @notice Receive rent and split it immediately across payees.
    receive() external payable {
        if (msg.value == 0) revert ZeroValue();

        uint256 total = msg.value;
        uint256 distributed;
        uint256 n = payees.length;
        for (uint256 i = 0; i < n; i++) {
            uint256 share = (total * sharesBps[i]) / BPS_DENOMINATOR;
            distributed += share;
            (bool ok, ) = payees[i].call{value: share}("");
            require(ok, "RentSplitter: payee transfer failed");
        }
        // Dust remainder from integer division goes to payees[0].
        uint256 dust = total - distributed;
        if (dust > 0) {
            (bool ok, ) = payees[0].call{value: dust}("");
            require(ok, "RentSplitter: dust transfer failed");
        }

        emit RentDistributed(msg.sender, total);
    }

    /// @notice Replace the payee set and shares. Only the owner.
    function updatePayees(
        address[] calldata _payees,
        uint256[] calldata _sharesBps
    ) external onlyOwner {
        _setPayees(_payees, _sharesBps);
    }

    /// @notice Number of configured payees.
    function payeeCount() external view returns (uint256) {
        return payees.length;
    }

    function _setPayees(address[] memory _payees, uint256[] memory _sharesBps) internal {
        if (_payees.length == 0) revert NoPayees();
        if (_payees.length != _sharesBps.length) revert LengthMismatch();

        uint256 totalBps;
        for (uint256 i = 0; i < _payees.length; i++) {
            if (_payees[i] == address(0)) revert ZeroAddress();
            totalBps += _sharesBps[i];
        }
        if (totalBps != BPS_DENOMINATOR) revert BadShares();

        payees = _payees;
        sharesBps = _sharesBps;
        emit PayeesUpdated(_payees, _sharesBps);
    }
}
