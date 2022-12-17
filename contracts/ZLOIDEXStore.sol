// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

contract ZLOIDEXStore {
    uint256 private _orderCounter;
    uint256 private _lockOffPrice;
    uint256 private _unbanPrice;
    address private _owner;
    uint256[] private _activeOrderIds;
    mapping(uint256 => ExchangeOrder) private _activeOrders;
    mapping(uint256 => uint256) private _activeOrdersBalances;
    mapping(address => uint256[]) private _usersActiveOrders;
    mapping(address => uint8) private _unreliableContracts;
    mapping(address => uint256) private _unreliableContractsLock;
    mapping(address => bool) private _bannedContracts;
    mapping(uint256 => uint256) private _reservedOrders;

    struct ExchangeOrder {
        uint256 id;
        uint256 minimumRatio;
        uint256 value;
        uint32 chainId;
        address seller;
        address recipient;
    }

    event PlaceOrder(address indexed seller, uint256 indexed orderId);
    event CloseOrder(address indexed seller, uint256 indexed orderId);
    event ReserveOrderException(
        uint256 indexed operationId,
        uint256 indexed orderId,
        uint256 value
    );
    event WriteOffException(
        uint256 indexed operationId,
        uint256 indexed orderId,
        uint256 value
    );
    event FilledOrder(
        uint256 indexed operationId,
        uint256 indexed orderId,
        uint256 value
    );

    modifier onlyOwner() {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    constructor(uint256 lockOffPrice_, uint256 unbanPrice_) {
        _owner = msg.sender;
        _lockOffPrice = lockOffPrice_;
        _unbanPrice = unbanPrice_;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function activeOrderIds() public view onlyOwner returns (uint256[] memory) {
        return _activeOrderIds;
    }

    function reservedOrderAmount(uint256 orderId_)
        public
        view
        onlyOwner
        returns (uint256)
    {
        return _reservedOrders[orderId_];
    }

    function myOrders(address seller_)
        public
        view
        onlyOwner
        returns (uint256[] memory)
    {
        return _usersActiveOrders[seller_];
    }

    function orderBalance(uint256 orderId_)
        public
        view
        onlyOwner
        returns (uint256)
    {
        return _activeOrdersBalances[orderId_];
    }

    function orderInfo(uint256 orderId_)
        public
        view
        onlyOwner
        returns (
            uint256,
            uint256,
            uint256,
            uint32,
            address
        )
    {
        ExchangeOrder memory orderInfo_ = _activeOrders[orderId_];

        return (
            orderInfo_.value,
            orderInfo_.minimumRatio,
            _activeOrdersBalances[orderId_],
            orderInfo_.chainId,
            orderInfo_.recipient
        );
    }

    function getLockOffPrice() public view returns (uint256) {
        return _lockOffPrice;
    }

    function getUnbanPrice() public view returns (uint256) {
        return _unbanPrice;
    }

    function getSellerRestricts(address seller_)
        public
        view
        onlyOwner
        returns (
            uint256,
            uint8,
            bool
        )
    {
        return (
            _unreliableContractsLock[seller_],
            _unreliableContracts[seller_],
            _bannedContracts[seller_]
        );
    }

    receive() external payable {
        revert("DAO: wrong data");
    }

    fallback() external payable {
        revert("DAO: wrong data");
    }

    function setRestrictionsPrice(uint256 lockOffPrice_, uint256 unbanPrice_)
        external
        onlyOwner
    {
        _lockOffPrice = lockOffPrice_;
        _unbanPrice = unbanPrice_;
    }

    /**
     * minimumRatio_ - this is the price of 1 coin of the current chain (with decimals) in coins of another chain (with decimals).
     * For example, we want to get 0.0031 BNB for our 1 MATIC - we send 1 000 000 000 000 000 000 to the contract and specify minimum ratio = 3 100 000 000 000 000
     */
    function placeExchangeOrder(
        uint256 value_,
        uint256 minimumRatio_,
        uint32 chainId_,
        address seller_,
        address recipient_
    ) external payable onlyOwner returns (bool) {
        require(_bannedContracts[seller_] == false, "DAO: address is banned");
        require(
            _unreliableContractsLock[seller_] < block.timestamp,
            "DAO: operation is temporarily unavailable"
        );

        _placeOrder(minimumRatio_, value_, chainId_, seller_, recipient_);

        return true;
    }

    function closeExchangeOrder(uint256 orderId_, address seller_)
        external
        onlyOwner
        returns (bool)
    {
        require(
            _activeOrdersBalances[orderId_] > 0,
            "DAO: order already close"
        );
        require(
            _activeOrders[orderId_].seller == seller_,
            "DAO: caller is not the seller"
        );
        require(
            _reservedOrders[orderId_] == 0,
            "DAO: the order is selected for exchange"
        );
        _closeOrder(orderId_);
        emit CloseOrder(seller_, orderId_);
        return true;
    }

    function batchReserveOrders(
        uint256 operationId,
        uint256[] calldata orderIds,
        uint256[] calldata orderAmounts
    ) external onlyOwner returns (bool) {
        for (uint256 i = 0; i < orderIds.length; i++) {
            uint256 currenOrder_ = orderIds[i];
            uint256 currentAmount_ = orderAmounts[i];
            if (
                _activeOrdersBalances[currenOrder_] >=
                (currentAmount_ + _reservedOrders[orderIds[i]])
            ) {
                _reservedOrders[orderIds[i]] += orderAmounts[i];
            } else {
                emit ReserveOrderException(
                    operationId,
                    currenOrder_,
                    currentAmount_
                );
            }
        }
        return true;
    }

    // Helper for unforeseen situations
    function batchUnreserveOrders(
        uint256[] calldata orderIds,
        uint256[] calldata orderAmounts
    ) external onlyOwner returns (bool) {
        for (uint256 i = 0; i < orderIds.length; i++) {
            if (_reservedOrders[orderIds[i]] == orderAmounts[i]) {
                delete _reservedOrders[orderIds[i]];
            } else {
                _reservedOrders[orderIds[i]] -= orderAmounts[i];
            }
        }
        return true;
    }

    function batchWriteOffBalance(
        uint256 operationId,
        uint256[] calldata orderIds,
        uint256[] calldata orderAmounts
    ) external onlyOwner returns (bool) {
        uint256 orderIdCurrent_;
        uint256 amountCurrent_;
        uint256 reserveBalance_;
        uint256 orderBalance_;
        for (uint256 i = 0; i < orderIds.length; i++) {
            orderIdCurrent_ = orderIds[i];
            amountCurrent_ = orderAmounts[i];
            reserveBalance_ = _reservedOrders[orderIdCurrent_];
            orderBalance_ = _activeOrdersBalances[orderIdCurrent_];
            if (
                (reserveBalance_ <= orderBalance_) &&
                (reserveBalance_ >= amountCurrent_)
            ) {
                if (orderBalance_ > amountCurrent_) {
                    _activeOrdersBalances[orderIdCurrent_] -= amountCurrent_;
                    _reservedOrders[orderIdCurrent_] -= amountCurrent_;
                } else if (orderBalance_ == amountCurrent_) {
                    delete _reservedOrders[orderIds[i]];
                    _closeOrder(orderIdCurrent_);
                    emit FilledOrder(
                        operationId,
                        orderIdCurrent_,
                        amountCurrent_
                    );
                } else {
                    // It can't be, but just in case
                    revert("DAO: unexpected error");
                }
            } else {
                emit WriteOffException(
                    operationId,
                    orderIdCurrent_,
                    amountCurrent_
                );
            }
        }
        return true;
    }

    function setLockTime(address[] calldata refusedContracts_)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < refusedContracts_.length; i++) {
            address refusedContract = refusedContracts_[i];
            uint8 refusedCount = _unreliableContracts[refusedContract] + 1;
            if (refusedCount > 10) {
                _bannedContracts[refusedContract] = true;
            } else {
                if (refusedCount > 5) {
                    _unreliableContractsLock[refusedContract] =
                        block.timestamp +
                        1 days;
                } else if (refusedCount > 3) {
                    _unreliableContractsLock[refusedContract] =
                        block.timestamp +
                        1 hours;
                }
                _unreliableContracts[refusedContract] = refusedCount;
            }
        }
    }

    function dropRefuseCounterOwned(address refusedContract_)
        external
        onlyOwner
    {
        if (_unreliableContracts[refusedContract_] > 0) {
            delete _unreliableContracts[refusedContract_];
        }
    }

    function unbanContractOwned(address refusedContract_) external onlyOwner {
        if (_bannedContracts[refusedContract_] == true) {
            delete _bannedContracts[refusedContract_];
        }
    }

    function _placeOrder(
        uint256 minimumRatio_,
        uint256 value_,
        uint32 chainId_,
        address seller_,
        address recipient_
    ) private returns (uint256) {
        uint256 counter = _orderCounter + 1;
        ExchangeOrder memory newOrder = ExchangeOrder(
            counter,
            minimumRatio_,
            value_,
            chainId_,
            seller_,
            recipient_
        );
        _activeOrderIds.push(counter);
        _activeOrders[counter] = newOrder;
        _activeOrdersBalances[counter] = value_;
        _usersActiveOrders[seller_].push(counter);
        _orderCounter = counter;

        emit PlaceOrder(seller_, counter);
        return counter;
    }

    function _closeOrder(uint256 orderId_) private {
        address seller = _activeOrders[orderId_].seller;
        delete _activeOrders[orderId_];
        delete _activeOrdersBalances[orderId_];
        uint256 activeOrdersLength = _usersActiveOrders[seller].length;
        uint256 orderIndex;
        for (uint256 i = 0; i < activeOrdersLength; i++) {
            if (_usersActiveOrders[seller][i] == orderId_) {
                orderIndex = i;
                i = activeOrdersLength;
            }
        }
        _usersActiveOrders[seller][orderIndex] = _usersActiveOrders[seller][
            activeOrdersLength - 1
        ];
        _usersActiveOrders[seller].pop();

        uint256 activeOrderIdsLength = _activeOrderIds.length;
        uint256 orderIdIndex;
        for (uint256 i = 0; i < activeOrderIdsLength; i++) {
            if (_activeOrderIds[i] == orderId_) {
                orderIdIndex = i;
                i = activeOrderIdsLength;
            }
        }
        _activeOrderIds[orderIdIndex] = _activeOrderIds[
            activeOrderIdsLength - 1
        ];
        _activeOrderIds.pop();
    }

    function transferOwnership(address newOwner)
        public
        onlyOwner
        returns (bool)
    {
        _owner = newOwner;
        return true;
    }
}
