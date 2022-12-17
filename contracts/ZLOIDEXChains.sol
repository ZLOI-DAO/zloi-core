// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

contract ZLOIDEXChains {
    uint32 private _currentChainId;
    address private _owner;
    uint32[] private _usedChains;
    uint32[] private _deprecatedChains;
    mapping(uint32 => address) private _usedChainsContracts;

    modifier onlyOwner() {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    modifier onlyBranch(uint32 chainId) {
        require(
            chainId != _currentChainId,
            "DAO: operation allowed only for branch"
        );
        bool deprecated = false;
        if (_deprecatedChains.length > 0) {
            for (
                uint256 i = 0;
                i < _deprecatedChains.length && deprecated != true;
                i++
            ) {
                if (_deprecatedChains[i] == chainId) {
                    deprecated = true;
                }
            }
        }
        require(deprecated == false, "DAO: branch is deprecated");
        _;
    }

    constructor(uint32 currentChainId_, address currentChainContract_) {
        _owner = msg.sender;
        _currentChainId = currentChainId_;
        _usedChains.push(currentChainId_);
        _usedChainsContracts[_currentChainId] = currentChainContract_;
    }

    function checkBranch(uint32 chainId) public view onlyOwner returns (bool) {
        require(
            chainId != _currentChainId,
            "DAO: operation allowed only for branch"
        );
        bool deprecated = false;
        if (_deprecatedChains.length > 0) {
            for (
                uint256 i = 0;
                i < _deprecatedChains.length && deprecated != true;
                i++
            ) {
                if (_deprecatedChains[i] == chainId) {
                    deprecated = true;
                }
            }
        }
        require(deprecated == false, "DAO: branch is deprecated");
        return true;
    }

    function addChain(uint32 chainId, address chainContract_)
        public
        onlyOwner
        onlyBranch(chainId)
        returns (bool)
    {
        require(
            _usedChainsContracts[chainId] == address(0),
            "DAO: branch already created"
        );
        _usedChains.push(chainId);
        _usedChainsContracts[chainId] = chainContract_;
        return true;
    }

    function deprecateChain(uint32 chainId)
        public
        onlyOwner
        onlyBranch(chainId)
        returns (bool)
    {
        require(
            _usedChainsContracts[chainId] != address(0),
            "DAO: chain not created"
        );
        _deprecatedChains.push(chainId);
        uint256 chainIndex;
        for (uint256 i = 0; i < _usedChains.length; i++) {
            if (_usedChains[i] == chainId) {
                chainIndex = i;
                i = _usedChains.length;
            }
        }
        _usedChains[chainIndex] = _usedChains[_usedChains.length - 1];
        _usedChains.pop();
        return true;
    }

    function changeBranchContract(uint32 chainId, address contract_)
        public
        onlyOwner
        onlyBranch(chainId)
        returns (bool)
    {
        require(
            _usedChainsContracts[chainId] != address(0),
            "DAO: chain not created"
        );
        _usedChainsContracts[chainId] = contract_;
        return true;
    }

    function usedChains() public view returns (uint32[] memory) {
        return _usedChains;
    }

    function deprecatedChains() public view returns (uint32[] memory) {
        return _deprecatedChains;
    }

    function branchContract(uint32 chainId) public view returns (address) {
        return _usedChainsContracts[chainId];
    }
}
