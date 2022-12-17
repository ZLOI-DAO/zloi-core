// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "./interfaces/IERC20.sol";
import "./interfaces/IERC165.sol";

// ZLOI implementation
contract ERC20 is IERC165, IERC20 {
    uint256 private _totalSupply;
    uint256 private constant _decimalsMultiplier = 1000000000000000000;
    bytes4 private constant _INTERFACE_ID_INVALID = 0xffffffff;
    address private _owner;
    string private _name;
    string private _symbol;
    bytes4 private constant ERC20ID = 0x36372b07;
    bytes4 private constant ERC165ID = 0x01ffc9a7;
    uint32 private _currentChainId;
    uint32[] private _usedChains;
    uint32[] private _deprecatedChains;
    mapping(uint32 => uint256) private _distributedSupply;
    mapping(uint32 => address) private _distributedContracts;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event CrossChainTransfer(bytes32 indexed hash, uint256 value);
    event Approval(
        address indexed owner_,
        address indexed spender,
        uint256 value
    );
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    modifier onlyOwner() {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    // Cross chain operations check
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

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint32 currentChainId_
    ) {
        _owner = msg.sender;
        _name = name_;
        _symbol = symbol_;
        _currentChainId = currentChainId_;
        _distributedContracts[currentChainId_] = address(this);
        _mint(_owner, totalSupply_ * _decimalsMultiplier);
        _usedChains.push(currentChainId_);
    }

    function transferOwnership(address newOwner)
        public
        onlyOwner
        returns (bool)
    {
        require(
            newOwner != address(0),
            "Ownable: new owner is the zero address"
        );
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
        return true;
    }

    // Mint amount in tokens without decimals
    function mint(uint256 amount) public onlyOwner returns (bool) {
        _mint(_owner, amount * _decimalsMultiplier);
        return true;
    }

    // Burn amount in tokens without decimals
    function burn(uint256 amount) public returns (bool) {
        _burn(msg.sender, amount * _decimalsMultiplier);
        return true;
    }

    function createBranch(
        uint32 chainId,
        address branchContract_,
        uint256 amount
    ) public onlyOwner onlyBranch(chainId) returns (bool) {
        require(
            branchContract_ != address(0),
            "ERC20: mint to the zero address"
        );
        require(
            _distributedContracts[chainId] == address(0),
            "DAO: chain id already minted"
        );

        uint256 decimalsAmount = amount * _decimalsMultiplier;
        _distributedContracts[chainId] = branchContract_;
        _usedChains.push(chainId);
        _totalSupply += decimalsAmount;
        unchecked {
            _distributedSupply[chainId] += decimalsAmount;
        }
        return true;
    }

    function deprecateBranch(uint32 chainId)
        public
        onlyOwner
        onlyBranch(chainId)
        returns (bool)
    {
        require(
            _distributedContracts[chainId] != address(0),
            "DAO: branch not minted"
        );
        uint256 branchBalance = _distributedSupply[chainId];
        require(branchBalance == 0, "DAO: branch has balance");
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

    function transferToBranch(uint32 chainId, uint256 amount)
        public
        onlyOwner
        onlyBranch(chainId)
        returns (bool)
    {
        require(
            _distributedContracts[chainId] != address(0),
            "DAO: branch not minted"
        );

        uint256 fromBalance = _balances[_owner];
        require(
            fromBalance >= amount,
            "ERC20: transfer amount exceeds balance"
        );
        unchecked {
            _balances[_owner] -= amount;
            _distributedSupply[_currentChainId] -= amount;
            _distributedSupply[chainId] += amount;
        }

        emit Transfer(_owner, address(0), amount);
        return true;
    }

    function transferFromBranch(
        uint32 chainId,
        uint256 amount,
        bytes32 hash_,
        address[] calldata accounts_,
        uint256[] calldata amounts_
    ) public onlyOwner onlyBranch(chainId) returns (bool) {
        require(
            _distributedContracts[chainId] != address(0),
            "DAO: branch not minted"
        );

        uint256 fromBalance = _distributedSupply[chainId];
        require(
            fromBalance >= amount,
            "ERC20: transfer amount exceeds balance"
        );

        require(accounts_.length == amounts_.length, "DAO: wrong data");

        uint256 checkAmount;
        for (uint256 i = 0; i < accounts_.length; i++) {
            checkAmount += amounts_[i];
        }

        require(checkAmount == amount, "DAO: wrong amount");

        unchecked {
            _distributedSupply[chainId] -= amount;
            _distributedSupply[_currentChainId] += amount;
        }

        for (uint256 i = 0; i < accounts_.length; i++) {
            address accountCurrent_ = accounts_[i];
            uint256 amountCurrent_ = amounts_[i];
            unchecked {
                _balances[accountCurrent_] += amountCurrent_;
            }
            emit Transfer(address(0), accountCurrent_, amountCurrent_);
        }

        emit CrossChainTransfer(hash_, amount);
        return true;
    }

    function changeBranchContract(uint32 chainId, address contract_)
        public
        onlyOwner
        onlyBranch(chainId)
        returns (bool)
    {
        require(contract_ != address(0), "DAO: wrong address");
        require(
            _distributedContracts[chainId] != address(0),
            "DAO: branch not minted"
        );
        _distributedContracts[chainId] = contract_;
        return true;
    }

    function usedChains() public view returns (uint32[] memory) {
        return _usedChains;
    }

    function deprecatedChains() public view returns (uint32[] memory) {
        return _deprecatedChains;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function currentChainId() public view returns (uint32) {
        return _currentChainId;
    }

    function currentChainSupply() public view returns (uint256) {
        return _distributedSupply[_currentChainId];
    }

    function branchSupply(uint32 chainId) public view returns (uint256) {
        return _distributedSupply[chainId];
    }

    function branchContract(uint32 chainId) public view returns (address) {
        return _distributedContracts[chainId];
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner_, address spender)
        public
        view
        returns (uint256)
    {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        public
        returns (bool)
    {
        address owner_ = msg.sender;
        _approve(owner_, spender, allowance(owner_, spender) + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        returns (bool)
    {
        address owner_ = msg.sender;
        uint256 currentAllowance = allowance(owner_, spender);
        require(
            currentAllowance >= subtractedValue,
            "ERC20: decreased allowance below zero"
        );
        unchecked {
            _approve(owner_, spender, currentAllowance - subtractedValue);
        }

        return true;
    }

    receive() external payable {
        revert("DAO: the contract does not accept payments");
    }

    fallback() external payable {
        revert("DAO: wrong data");
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        uint256 fromBalance = _balances[from];
        require(
            fromBalance >= amount,
            "ERC20: transfer amount exceeds balance"
        );
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        _totalSupply += amount;
        unchecked {
            _balances[account] += amount;
            _distributedSupply[_currentChainId] += amount;
        }
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from the zero address");

        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - amount;
            _totalSupply -= amount;
            _distributedSupply[_currentChainId] -= amount;
        }

        emit Transfer(account, address(0), amount);
    }

    function _approve(
        address owner_,
        address spender,
        uint256 amount
    ) internal {
        require(owner_ != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner_][spender] = amount;
        emit Approval(owner_, spender, amount);
    }

    function _spendAllowance(
        address owner_,
        address spender,
        uint256 amount
    ) internal {
        uint256 currentAllowance = allowance(owner_, spender);
        if (currentAllowance != type(uint256).max) {
            require(
                currentAllowance >= amount,
                "ERC20: insufficient allowance"
            );
            unchecked {
                _approve(owner_, spender, currentAllowance - amount);
            }
        }
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        require(
            interfaceId != _INTERFACE_ID_INVALID,
            "ERC165: invalid interface id"
        );
        return
            interfaceId == type(IERC20).interfaceId ||
            interfaceId == ERC20ID ||
            interfaceId == ERC165ID;
    }
}
