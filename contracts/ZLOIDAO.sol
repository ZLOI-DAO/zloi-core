// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "./ZLOI.sol";
import "./ZLOIDEX.sol";

/**
 * Steps for transfer between chains:
 * Allowance to DAO for burn on current chain
 * -> pay fee for resolve transfer for other chain on current chain + fee for mint and transfer on selected chain
 * -> get balance on selected chain
 */

contract ZLOIDAO {
    uint256 private constant _decimalsMultiplier = 1000000000000000000;
    ZLOI private _token;
    ZLOIDEX private _dex;
    address payable private _ceo;
    address payable private _executor;
    mapping(uint32 => address[]) private _moveToBranchOrders;
    mapping(address => mapping(uint32 => uint256)) _moveToBranchFees;
    mapping(uint32 => mapping(address => uint256)) private _moveToBranchAmounts;
    mapping(uint32 => uint256) private _moveToBranchTotals;
    mapping(uint32 => uint256) private _feeForCrossChainTransfer;

    event TransferOrderToBranchSucceed(
        uint256 indexed operationId,
        address indexed account,
        uint256 value
    );

    modifier onlyOwner() {
        require(_ceo == msg.sender, "Ownable: forbidden");
        _;
    }

    modifier ownerOrExecutor() {
        require(
            msg.sender == _ceo || msg.sender == _executor,
            "Ownable: forbidden"
        );
        _;
    }

    constructor(
        uint256 tokensAmount_,
        uint256 liquidityAmount_,
        uint256 equipmentAmount_,
        uint32 chainId,
        address executor_
    ) {
        _ceo = payable(msg.sender);
        _executor = payable(executor_);
        _token = new ZLOI("ZLOI", "ZLOI", tokensAmount_, chainId);
        _dex = new ZLOIDEX(
            100 * _decimalsMultiplier,
            200 * _decimalsMultiplier,
            payable(executor_),
            address(_token),
            chainId,
            1
        );
        // To increase liquidity
        _token.transfer(address(_dex), liquidityAmount_ * _decimalsMultiplier);
        // To pay for equipment and marketing
        _token.transfer(msg.sender, equipmentAmount_ * _decimalsMultiplier);
    }

    function balance() public view returns (uint256) {
        return _token.balanceOf(address(this));
    }

    function ceo() public view returns (address) {
        return _ceo;
    }

    function executor() public view ownerOrExecutor returns (address) {
        return _executor;
    }

    function token() public view returns (address) {
        return address(_token);
    }

    function dex() public view returns (address) {
        return address(_dex);
    }

    function usedChains() public view returns (uint32[] memory) {
        return _token.usedChains();
    }

    function moveToBranchOrders(uint32 chainId)
        public
        view
        ownerOrExecutor
        returns (address[] memory)
    {
        return _moveToBranchOrders[chainId];
    }

    function moveToBranchOrder(uint32 chainId) public view returns (uint256) {
        return _moveToBranchAmounts[chainId][msg.sender];
    }

    function crossChainTransferFee(uint32 chainId)
        public
        view
        returns (uint256)
    {
        return _feeForCrossChainTransfer[chainId];
    }

    function increaseMoveToBranchOrder(uint256 amount_, uint32 chainId)
        external
        payable
    {
        require(
            _token.allowance(msg.sender, address(this)) >=
                (amount_ + _moveToBranchAmounts[chainId][msg.sender]),
            "DAO: insufficient allowance"
        );

        uint256 fee = _feeForCrossChainTransfer[chainId];
        uint256 currentFee = _moveToBranchFees[msg.sender][chainId];
        uint32[] memory usedChains_ = _token.usedChains();
        bool hasChain;
        for (
            uint256 i = 0;
            (i < usedChains_.length) && (hasChain == false);
            i++
        ) {
            if (usedChains_[i] == chainId) {
                hasChain = true;
            }
        }
        require(hasChain == true, "DAO: unused chain");

        if (currentFee > fee) {
            payable(msg.sender).transfer(currentFee - fee);
        } else if (currentFee < fee) {
            if (msg.value + currentFee > fee) {
                payable(msg.sender).transfer(currentFee + msg.value - fee);
            } else if (msg.value + currentFee < fee) {
                revert("DAO: not enough fees");
            }
        }

        _moveToBranchFees[msg.sender][chainId] = fee;
        _moveToBranchAmounts[chainId][msg.sender] += amount_;
        _moveToBranchOrders[chainId].push(msg.sender);
        _moveToBranchTotals[chainId] += amount_;
    }

    function closeMoveToBranchOrder(uint32 chainId) external payable {
        require(
            _moveToBranchAmounts[chainId][msg.sender] > 0,
            "DAO: order not init"
        );
        uint256 refundFee = _moveToBranchFees[msg.sender][chainId];
        _closeMoveToBranchOrder(msg.sender, chainId);
        payable(msg.sender).transfer(refundFee);
    }

    function changeExecutor(address executor_) external onlyOwner {
        _executor = payable(executor_);
    }

    function setCrossChainTransferFee(
        uint256 feeForCrossChainTransfer_,
        uint32 chainId
    ) public onlyOwner returns (bool) {
        _feeForCrossChainTransfer[chainId] = feeForCrossChainTransfer_;
        return true;
    }

    function mint(uint256 amount) public onlyOwner returns (bool) {
        _token.mint(amount);
        return true;
    }

    function burn(uint256 amount) public onlyOwner returns (bool) {
        _token.burn(amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        public
        onlyOwner
        returns (bool)
    {
        _token.increaseAllowance(spender, addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        onlyOwner
        returns (bool)
    {
        _token.decreaseAllowance(spender, subtractedValue);
        return true;
    }

    function createBranch(
        uint32 chainId,
        address branchContract,
        uint256 amount,
        uint256 feeForTransfer
    ) public onlyOwner returns (bool) {
        _token.createBranch(chainId, branchContract, amount);
        _feeForCrossChainTransfer[chainId] = feeForTransfer;
        return true;
    }

    function deprecateBranch(uint32 chainId) public onlyOwner returns (bool) {
        _token.deprecateBranch(chainId);
        return true;
    }

    function transferToBranch(
        uint256 operationId,
        uint256 amount,
        uint32 chainId,
        address[] calldata accounts_,
        uint256[] calldata amounts_
    ) public ownerOrExecutor returns (bool) {
        require(accounts_.length == amounts_.length, "DAO: wrong data");
        uint256 totalAmount;
        for (uint256 i = 0; i < accounts_.length; i++) {
            totalAmount += amounts_[i];
        }
        require(amount == totalAmount, "DAO: wrong amount");
        uint256 amountToTransfer;
        uint256 currentAmount;
        address currentAccount;
        for (uint256 i = 0; i < accounts_.length; i++) {
            currentAccount = accounts_[i];
            currentAmount = amounts_[i];
            if (
                _moveToBranchAmounts[chainId][currentAccount] == currentAmount
            ) {
                try _token.allowance(currentAccount, address(this)) returns (
                    uint256 balance_
                ) {
                    if (balance_ >= currentAmount) {
                        try
                            _token.transferFrom(
                                currentAccount,
                                address(this),
                                currentAmount
                            )
                        {
                            amountToTransfer += currentAmount;
                            emit TransferOrderToBranchSucceed(
                                operationId,
                                currentAccount,
                                currentAmount
                            );
                            _closeMoveToBranchOrder(currentAccount, chainId);
                        } catch {}
                    }
                } catch {}
            }
        }
        if (amountToTransfer > 0) {
            _token.transferToBranch(chainId, amountToTransfer);
        }
        return true;
    }

    function transferFromBranch(
        uint32 chainId,
        uint256 amount,
        bytes32 hash_,
        address[] calldata accounts_,
        uint256[] calldata amounts_
    ) public ownerOrExecutor returns (bool) {
        _token.transferFromBranch(chainId, amount, hash_, accounts_, amounts_);
        return true;
    }

    function changeBranchContract(uint32 chainId, address contract_)
        public
        onlyOwner
        returns (bool)
    {
        _token.changeBranchContract(chainId, contract_);
        return true;
    }

    // Amount in tokens without decimals
    function addDexLiquidity(uint256 amount) public onlyOwner returns (bool) {
        _token.transfer(address(_dex), amount * _decimalsMultiplier);
        return true;
    }

    function transferTokenOwnership(address newOwner)
        public
        onlyOwner
        returns (bool)
    {
        _token.transferOwnership(newOwner);
        return true;
    }

    function transferDexOwnership(address newOwner)
        public
        onlyOwner
        returns (bool)
    {
        _dex.transferOwnership(newOwner, address(_dex));
        return true;
    }

    function transferDexStoreOwnership(address newOwner)
        public
        onlyOwner
        returns (bool)
    {
        _dex.transferOwnership(address(this), newOwner);
        return true;
    }

    function changeDexExecutor(address newOwner)
        public
        onlyOwner
        returns (bool)
    {
        _dex.changeExecutor(newOwner);
        return true;
    }

    function changeToken(address token_) external onlyOwner {
        require(token_ != address(0), "DAO: wrong address");
        _token = ZLOI(payable(token_));
    }

    function changeDex(address dex_) external onlyOwner {
        require(dex_ != address(0), "DAO: wrong address");
        require(
            ZLOIDEX(payable(dex_)).owner() == address(this),
            "DAO: wrong dex owner"
        );
        _dex = ZLOIDEX(payable(dex_));
    }

    receive() external payable {
        revert("DAO: wrong data");
    }

    fallback() external payable {
        revert("DAO: wrong data");
    }

    function getFeesForExecutor() external ownerOrExecutor {
        uint256 totalOrdersFee_;
        uint32[] memory usedChains_ = _token.usedChains();
        for (uint256 c = 0; c < usedChains_.length; c++) {
            for (
                uint256 i = 0;
                i < _moveToBranchOrders[usedChains_[c]].length;
                i++
            ) {
                totalOrdersFee_ += _moveToBranchFees[
                    _moveToBranchOrders[usedChains_[c]][i]
                ][usedChains_[c]];
            }
        }
        require(
            address(this).balance > totalOrdersFee_,
            "DAO: not enough balance"
        );
        _executor.transfer(address(this).balance - totalOrdersFee_);
    }

    function _closeMoveToBranchOrder(address account_, uint32 chainId)
        private
        returns (bool)
    {
        _moveToBranchTotals[chainId] -= _moveToBranchAmounts[chainId][account_];
        delete _moveToBranchAmounts[chainId][account_];
        delete _moveToBranchFees[account_][chainId];
        uint256 orderIndex;
        for (uint256 i = 0; i < _moveToBranchOrders[chainId].length; i++) {
            if (_moveToBranchOrders[chainId][i] == account_) {
                orderIndex = i;
                i = _moveToBranchOrders[chainId].length;
            }
        }
        _moveToBranchOrders[chainId][orderIndex] = _moveToBranchOrders[chainId][
            _moveToBranchOrders[chainId].length - 1
        ];
        _moveToBranchOrders[chainId].pop();
        return true;
    }
}
