// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "./interfaces/IERC20.sol";
import "./ZLOIDEXStore.sol";
import "./ZLOIDEXChains.sol";

contract ZLOIDEX {
    uint256 private _liquidityBalance;
    uint32 private _multiplier;
    uint32 private _divider = 1;
    bool private _saleIsActive;
    address payable private _owner;
    address payable private _executor;
    IERC20 private _token;
    ZLOIDEXStore private _store;
    ZLOIDEXChains private _chains;

    event Purchase(address indexed buyer, uint256 value);
    event PurchaseUnban(address indexed buyer, uint256 value);
    event IncreaseLiquidity(address indexed sender, uint256 value);
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    event SendExchangedBalance(
        uint256 indexed operationId,
        address indexed buyer,
        uint256 value
    );

    modifier onlyOwner() {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    modifier ownerOrExecutor() {
        require(
            msg.sender == _owner || msg.sender == _executor,
            "Ownable: caller is not the owner"
        );
        _;
    }

    modifier onlyBranch(uint32 chainId) {
        _chains.checkBranch(chainId);
        _;
    }

    constructor(
        uint256 lockOffPrice_,
        uint256 unbanPrice_,
        address executor_,
        address tokenAddress_,
        uint32 currentChainId_,
        uint32 multiplier_
    ) {
        _owner = payable(msg.sender);
        _executor = payable(executor_);
        _multiplier = multiplier_;
        _token = IERC20(tokenAddress_);
        _chains = new ZLOIDEXChains(currentChainId_, address(this));
        _store = new ZLOIDEXStore(lockOffPrice_, unbanPrice_);
    }

    function transferOwnership(address newOwner, address newStoreOwner)
        public
        onlyOwner
        returns (bool)
    {
        require(
            (newOwner != address(0)) && (newStoreOwner != address(0)),
            "Ownable: new owner is the zero address"
        );
        address oldOwner = _owner;
        _owner = payable(newOwner);
        _store.transferOwnership(newStoreOwner);
        emit OwnershipTransferred(oldOwner, newOwner);
        return true;
    }

    function setConverters(uint32 multiplier_, uint32 divider_)
        public
        ownerOrExecutor
        returns (bool)
    {
        require(divider_ >= 1, "DAO: cannot be divided by zero");
        _multiplier = multiplier_;
        _divider = divider_;
        return true;
    }

    function setSaleActivity(bool saleIsActive_)
        public
        ownerOrExecutor
        returns (bool)
    {
        _saleIsActive = saleIsActive_;
        return true;
    }

    function addChain(uint32 chainId, address chainContract_)
        public
        ownerOrExecutor
        returns (bool)
    {
        _chains.addChain(chainId, chainContract_);
        return true;
    }

    function deprecateChain(uint32 chainId)
        public
        ownerOrExecutor
        returns (bool)
    {
        _chains.deprecateChain(chainId);
        return true;
    }

    function changeBranchContract(uint32 chainId, address contract_)
        public
        ownerOrExecutor
        onlyBranch(chainId)
        returns (bool)
    {
        require(contract_ != address(0), "DAO: wrong address");
        _chains.changeBranchContract(chainId, contract_);
        return true;
    }

    function liquidityBalance() public view ownerOrExecutor returns (uint256) {
        return _liquidityBalance;
    }

    function executor() public view ownerOrExecutor returns (address) {
        return _executor;
    }

    function reservedOrderAmount(uint256 orderId_)
        public
        view
        ownerOrExecutor
        returns (uint256)
    {
        return _store.reservedOrderAmount(orderId_);
    }

    function activeOrderIds()
        public
        view
        ownerOrExecutor
        returns (uint256[] memory)
    {
        return _store.activeOrderIds();
    }

    function usedChains() public view returns (uint32[] memory) {
        return _chains.usedChains();
    }

    function deprecatedChains() public view returns (uint32[] memory) {
        return _chains.deprecatedChains();
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function availableTokens() public view returns (uint256) {
        return _token.balanceOf(address(this));
    }

    function saleIsActive() public view returns (bool) {
        return _saleIsActive;
    }

    function tokenAddress() public view returns (address) {
        return address(_token);
    }

    function storeAddress() public view ownerOrExecutor returns (address) {
        return address(_store);
    }

    function chainsAddress() public view ownerOrExecutor returns (address) {
        return address(_chains);
    }

    function myOrders() public view returns (uint256[] memory) {
        return _store.myOrders(msg.sender);
    }

    function orderBalance(uint256 orderId_) public view returns (uint256) {
        return _store.orderBalance(orderId_);
    }

    function orderInfo(uint256 orderId_)
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint32,
            address
        )
    {
        return _store.orderInfo(orderId_);
    }

    function getSaleCourse(uint256 value) public view returns (uint256) {
        return (value * _multiplier) / _divider;
    }

    function getRestrictionsPrice() public view returns (uint256, uint256) {
        uint256 lockOffPrice_ = _store.getLockOffPrice();
        uint256 unbanPrice_ = _store.getUnbanPrice();
        return (lockOffPrice_, unbanPrice_);
    }

    function branchContract(uint32 chainId) public view returns (address) {
        return _chains.branchContract(chainId);
    }

    function getSellerRestricts(address seller_)
        public
        view
        returns (
            uint256,
            uint8,
            bool
        )
    {
        return _store.getSellerRestricts(seller_);
    }

    receive() external payable {
        require(_saleIsActive == true, "DAO: sales are not open");
        uint256 tokensToBuy = (msg.value * _multiplier) / _divider;
        require(tokensToBuy > 0, "DAO: not enough funds");

        uint256 currentBalance = _token.balanceOf(address(this));
        require(currentBalance >= tokensToBuy, "DAO: not enough tokens");

        _token.transfer(msg.sender, tokensToBuy);

        emit Purchase(msg.sender, tokensToBuy);

        _liquidityBalance += msg.value;
    }

    fallback() external payable {
        revert("DAO: wrong data");
    }

    function setRestrictionsPrice(uint256 lockOffPrice_, uint256 unbanPrice_)
        external
        ownerOrExecutor
    {
        _store.setRestrictionsPrice(lockOffPrice_, unbanPrice_);
    }

    function changeToken(address token_) external ownerOrExecutor {
        require(token_ != address(0), "DAO: wrong address");
        _token = IERC20(token_);
    }

    function changeStore(address store_) external ownerOrExecutor {
        require(store_ != address(0), "DAO: wrong address");
        require(
            ZLOIDEXStore(payable(store_)).owner() == address(this),
            "DAO: wrong store owner"
        );
        _store = ZLOIDEXStore(payable(store_));
    }

    function changeExecutor(address executor_) external onlyOwner {
        _executor = payable(executor_);
    }

    function placeOrderFromLiquidity(
        uint256 amount_,
        uint256 minimumRatio_,
        uint32 chainId_
    ) external ownerOrExecutor onlyBranch(chainId_) returns (bool) {
        address contract_ = _chains.branchContract(chainId_);
        require(contract_ != address(0), "DAO: chain not created");
        require(_liquidityBalance >= amount_, "DAO: insufficient ballance");
        _liquidityBalance -= amount_;

        _store.placeExchangeOrder(
            amount_,
            minimumRatio_,
            chainId_,
            _owner,
            contract_
        );

        return true;
    }

    function placeExchangeOrder(
        uint256 minimumRatio_,
        uint32 chainId_,
        address recipient_
    ) external payable onlyBranch(chainId_) returns (bool) {
        address contract_ = _chains.branchContract(chainId_);
        require(contract_ != address(0), "DAO: chain not created");

        _store.placeExchangeOrder(
            msg.value,
            minimumRatio_,
            chainId_,
            msg.sender,
            recipient_
        );

        return true;
    }

    function closeExchangeOrder(uint256 orderId_) external returns (bool) {
        uint256 refund = _store.orderBalance(orderId_);
        _store.closeExchangeOrder(orderId_, msg.sender);
        payable(msg.sender).transfer(refund);
        return true;
    }

    function batchReserveOrders(
        uint256 operationId,
        uint256[] calldata orderIds,
        uint256[] calldata orderAmounts
    ) external ownerOrExecutor returns (bool) {
        require(orderIds.length == orderAmounts.length, "DAO: wrong data");
        _store.batchReserveOrders(operationId, orderIds, orderAmounts);
        return true;
    }

    // Helper for unforeseen situations
    function batchUnreserveOrders(
        uint256[] calldata orderIds,
        uint256[] calldata orderAmounts
    ) external ownerOrExecutor returns (bool) {
        require(orderIds.length == orderAmounts.length, "DAO: wrong data");
        _store.batchUnreserveOrders(orderIds, orderAmounts);
        return true;
    }

    function batchWriteOffBalance(
        uint256 operationId,
        uint256[] calldata orderIds,
        uint256[] calldata orderAmounts
    ) external ownerOrExecutor returns (bool) {
        require(orderIds.length == orderAmounts.length, "DAO: wrong data");
        _store.batchWriteOffBalance(operationId, orderIds, orderAmounts);
        return true;
    }

    function batchSendExchangedBalance(
        uint256 operationId,
        uint256[] calldata orderAmounts,
        address[] calldata buyers
    ) external ownerOrExecutor returns (bool) {
        require(buyers.length == orderAmounts.length, "DAO: wrong data");
        uint256 totalAmount;
        for (uint256 i = 0; i < orderAmounts.length; i++) {
            totalAmount += orderAmounts[i];
        }
        require(
            address(this).balance >= totalAmount,
            "DAO: not enough balance"
        );
        uint256 currentAmount;
        address currentBuyer;
        for (uint256 i = 0; i < orderAmounts.length; i++) {
            currentBuyer = buyers[i];
            currentAmount = orderAmounts[i];
            payable(currentBuyer).transfer(currentAmount);
            emit SendExchangedBalance(operationId, currentBuyer, currentAmount);
        }
        return true;
    }

    function setLockTime(address[] calldata refusedContracts_)
        external
        ownerOrExecutor
        returns (bool)
    {
        _store.setLockTime(refusedContracts_);
        return true;
    }

    function unbanContract(address refusedContract_) external payable {
        require(refusedContract_ != address(0), "DAO: unban for zero address");
        uint256 lockOffPrice_ = _store.getLockOffPrice();
        uint256 unbanPrice_ = _store.getUnbanPrice();
        _liquidityBalance += msg.value;
        if (msg.value >= lockOffPrice_) {
            _store.dropRefuseCounterOwned(refusedContract_);
        }
        if (msg.value >= unbanPrice_) {
            _store.unbanContractOwned(refusedContract_);
        }
        emit PurchaseUnban(refusedContract_, msg.value);
    }

    function unbanContractOwned(address refusedContract_)
        external
        ownerOrExecutor
    {
        require(refusedContract_ != address(0), "DAO: unban for zero address");
        _store.dropRefuseCounterOwned(refusedContract_);
        _store.unbanContractOwned(refusedContract_);
    }

    function increaseLiquidity() external payable {
        _liquidityBalance += msg.value;
        emit IncreaseLiquidity(msg.sender, msg.value);
    }

    function returnTokensToOwner(address tokenAddress_)
        external
        ownerOrExecutor
    {
        IERC20 token_ = IERC20(tokenAddress_);
        try token_.balanceOf(address(this)) returns (uint256 balance_) {
            if (balance_ > 0) {
                try token_.transfer(_owner, balance_) {} catch {}
            }
        } catch {}
    }
}
