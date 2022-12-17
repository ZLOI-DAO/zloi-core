import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ZLOI, ZLOIDEX, ZLOIDEXStore } from '../typechain-types';
import { abi } from '../artifacts/contracts/ZLOIDEXStore.sol/ZLOIDEXStore.json';

const BigNumber = ethers.BigNumber;

const nameSymbolContract = 'ZLOI';
const dexSymbolContract = 'ZLOIDEX';
const supply = 1000000000;
const supplyString = String(supply);
const supplyStringTotal = ethers.utils.parseEther(supplyString).toString();
const currentChain = 137;
const emptyAddress = '0x0000000000000000000000000000000000000000';
const ethChain = 1;
const bnbChain = 56;
const avalancheChain = 43114;

describe('ZLOI DEX tests', () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let ethContract: SignerWithAddress;
  let newEthContract: SignerWithAddress;
  let bnbContract: SignerWithAddress;
  let token: ZLOI;
  let dex: ZLOIDEX;
  let dexStore: ZLOIDEXStore;
  const provider = ethers.provider;

  beforeEach(async () => {
    [owner, alice, bob, ethContract, newEthContract, bnbContract] = await ethers.getSigners();
    const ZLOIContract = await ethers.getContractFactory(nameSymbolContract, owner);
    token = (await ZLOIContract.deploy(
      nameSymbolContract,
      nameSymbolContract,
      supply,
      currentChain
    )) as ZLOI;
    await token.deployed();
    const ZLOIDEXContract = await ethers.getContractFactory(dexSymbolContract, owner);
    dex = (await ZLOIDEXContract.deploy(
      1,
      2,
      owner.address,
      token.address,
      currentChain,
      1
    )) as ZLOIDEX;
    await dex.deployed();
    dexStore = new ethers.Contract(await dex.storeAddress(), abi, provider) as ZLOIDEXStore;
  });

  it('Check view and pure functions', async () => {
    await expect(dex.connect(bob).liquidityBalance()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(dex.connect(bob).reservedOrderAmount(1)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(dex.connect(bob).activeOrderIds()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(dex.connect(bob).executor()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(dex.connect(bob).storeAddress()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(dex.connect(bob).chainsAddress()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    const dexChainAddress = await dex.chainsAddress();
    const executor = await dex.executor();
    const storeAddress = await dex.storeAddress();
    const liquidityBalance = await dex.liquidityBalance();
    const reservedBalance = await dex.reservedOrderAmount(1);
    const activeOrderIds = await dex.activeOrderIds();
    const dexOwner = await dex.owner();
    const usedChains = await dex.usedChains();
    const deprecatedChains = await dex.deprecatedChains();
    const availableTokens = await dex.availableTokens();
    const saleIsActive = await dex.saleIsActive();
    const tokenAddress = await dex.tokenAddress();
    const myOrders = await dex.myOrders();
    const orderBalance = await dex.orderBalance(1);
    const [orderInfoValue, orderInfoRatio, orderInfoBalance, orderInfoChainId, orderInfoRecipient] =
      await dex.orderInfo(1);
    const getSaleCourse = await dex.getSaleCourse(1);
    const [getRestrictionsPriceLockOff, getRestrictionsPriceUnban] =
      await dex.getRestrictionsPrice();
    const branchContract = await dex.branchContract(currentChain);
    const [getContractRestrictsPeriod, getContractRestrictsCount, getContractRestrictsBanned] =
      await dex.getSellerRestricts(owner.address);

    expect(dexChainAddress, 'dexChainAddress').to.be.properAddress;
    expect(executor, 'executor').to.eql(owner.address);
    expect(storeAddress, 'storeAddress').to.eql(dexStore.address);
    expect(liquidityBalance.toString(), 'liquidityBalance').to.eql('0');
    expect(reservedBalance.toString(), 'reservedBalance').to.eql('0');
    expect(activeOrderIds, 'activeOrderIds').to.eql([]);
    expect(dexOwner, 'dexOwner').to.eql(owner.address);
    expect(usedChains, 'usedChains').to.eql([currentChain]);
    expect(deprecatedChains, 'deprecatedChains').to.eql([]);
    expect(availableTokens.toString(), 'availableTokens').to.eql('0');
    expect(saleIsActive, 'saleIsActive').to.eql(false);
    expect(tokenAddress, 'tokenAddress').to.eql(token.address);
    expect(myOrders, 'myOrders').to.eql([]);
    expect(orderBalance.toString(), 'orderBalance').to.eql('0');
    expect(orderInfoValue.toString(), 'orderInfo').to.eql('0');
    expect(orderInfoRatio.toString(), 'orderInfo').to.eql('0');
    expect(orderInfoBalance.toString(), 'orderInfo').to.eql('0');
    expect(orderInfoChainId, 'orderInfo').to.eql(0);
    expect(orderInfoRecipient, 'orderInfo').to.eql(emptyAddress);
    expect(getSaleCourse.toString(), 'getSaleCourse').to.eql('1');
    expect(getRestrictionsPriceLockOff.toString(), 'getRestrictionsPrice').to.eql('1');
    expect(getRestrictionsPriceUnban.toString(), 'getRestrictionsPrice').to.eql('2');
    expect(branchContract, 'branchContract').to.eql(dex.address);
    expect(getContractRestrictsPeriod.toString(), 'getContractRestricts').to.eql('0');
    expect(getContractRestrictsCount, 'getContractRestricts').to.eql(0);
    expect(getContractRestrictsBanned, 'getContractRestricts').to.eql(false);
  });

  it('Check transfer ownership', async () => {
    await expect(dex.connect(bob).changeExecutor(alice.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await dex.changeExecutor(alice.address);
    const executor = await dex.executor();
    expect(executor, 'executor').to.eql(alice.address);

    await expect(dex.connect(bob).transferOwnership(alice.address, dex.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await expect(dex.transferOwnership(emptyAddress, emptyAddress)).to.be.revertedWith(
      'Ownable: new owner is the zero address'
    );

    const tx = await dex.transferOwnership(alice.address, alice.address);

    await expect(tx).to.emit(dex, 'OwnershipTransferred').withArgs(owner.address, alice.address);

    const dexOwner = await dex.owner();

    expect(dexOwner, 'dexOwner').to.eq(alice.address);
  });

  it('Check store', async () => {
    const ZLOIDEXStoreNew = await ethers.getContractFactory('ZLOIDEXStore', owner);
    const newDexStore = await ZLOIDEXStoreNew.deploy(1, 2);
    await newDexStore.deployed();

    await expect(newDexStore.connect(bob).activeOrderIds()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).reservedOrderAmount(1)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).myOrders(bob.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).orderBalance(1)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).orderInfo(1)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).getSellerRestricts(bob.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).setRestrictionsPrice(1, 2)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(
      newDexStore.connect(bob).placeExchangeOrder(1, 1, 1, bob.address, bob.address)
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(newDexStore.connect(bob).closeExchangeOrder(1, bob.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).batchReserveOrders(1, [], [])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).batchUnreserveOrders([], [])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).batchWriteOffBalance(1, [], [])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).setLockTime([])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).dropRefuseCounterOwned(bob.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).unbanContractOwned(bob.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexStore.connect(bob).transferOwnership(bob.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(dex.connect(bob).changeStore(newDexStore.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    const abi = ['function test() public view returns (bool)'];
    const dexStoreContract = new ethers.Contract(newDexStore.address, abi, owner);
    await expect(dexStoreContract.test()).to.be.revertedWith('DAO: wrong data');

    const txBody = {
      to: newDexStore.address,
      value: BigNumber.from('1'),
      gasLimit: 600000,
    };
    await expect(owner.sendTransaction(txBody)).to.be.revertedWith('DAO: wrong data');

    await expect(dex.changeStore(emptyAddress)).to.be.revertedWith('DAO: wrong address');
    await expect(dex.changeStore(newDexStore.address)).to.be.revertedWith('DAO: wrong store owner');

    await newDexStore.transferOwnership(dex.address);

    await dex.changeStore(newDexStore.address);

    const newStoreAddress = await dex.storeAddress();

    expect(newStoreAddress).to.eql(newDexStore.address);
  });

  it('Check set converters', async () => {
    await expect(dex.connect(bob).setConverters(4, 10)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await expect(dex.setConverters(4, 0)).to.be.revertedWith('DAO: cannot be divided by zero');

    await dex.changeExecutor(alice.address);
    await dex.connect(alice).setConverters(4, 10);

    const getSaleCourse = await dex.getSaleCourse(1);

    expect(getSaleCourse.toString(), 'getSaleCourse').to.eql('0');

    const getSaleCourse2 = await dex.getSaleCourse(10);

    expect(getSaleCourse2.toString(), 'getSaleCourse').to.eql('4');
  });

  it('Check set sale activity', async () => {
    await expect(dex.connect(bob).setSaleActivity(true)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await dex.setSaleActivity(true);

    const saleIsActive = await dex.saleIsActive();

    expect(saleIsActive, 'saleIsActive').to.eql(true);
  });

  it('Check fallback', async () => {
    const abi = ['function test() public view returns (bool)'];

    const dexContract = new ethers.Contract(dex.address, abi, owner);

    await expect(dexContract.test()).to.be.revertedWith('DAO: wrong data');
  });

  it('Check buy tokens', async () => {
    const txBody = {
      to: dex.address,
      value: BigNumber.from('1'),
      gasLimit: 600000,
    };
    await expect(owner.sendTransaction(txBody)).to.be.revertedWith('DAO: sales are not open');

    await dex.setSaleActivity(true);
    await dex.setConverters(4, 10);

    await expect(owner.sendTransaction(txBody)).to.be.revertedWith('DAO: not enough funds');

    txBody.value = BigNumber.from('10');
    await expect(owner.sendTransaction(txBody)).to.be.revertedWith('DAO: not enough tokens');

    await token.transfer(dex.address, BigNumber.from('4'));

    const tx = await owner.sendTransaction(txBody);

    await expect(tx).to.emit(dex, 'Purchase').withArgs(owner.address, BigNumber.from('4'));

    const liquidityBalance = await dex.liquidityBalance();
    expect(liquidityBalance.toString(), 'liquidityBalance').to.eql('10');
  });

  it('Check restrictions price', async () => {
    await expect(dex.connect(bob).setRestrictionsPrice(2, 3)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await dex.setRestrictionsPrice(2, 3);

    const [restrictionsPriceLockOff, restrictionsPriceUnban] = await dex.getRestrictionsPrice();

    expect(restrictionsPriceLockOff.toString(), 'restrictionsPriceLockOff').to.eql('2');
    expect(restrictionsPriceUnban.toString(), 'restrictionsPriceLockOff').to.eql('3');
  });

  it('Check change token', async () => {
    await expect(dex.connect(bob).changeToken(bnbContract.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await expect(dex.changeToken(emptyAddress)).to.be.revertedWith('DAO: wrong address');

    await dex.changeToken(bnbContract.address);

    const changeToken = await dex.tokenAddress();

    expect(changeToken).to.eql(bnbContract.address);
  });

  it('Check increase liquidity', async () => {
    const txBody = {
      value: ethers.utils.parseEther('1'),
      gasLimit: 600000,
    };
    const tx = await dex.increaseLiquidity(txBody);
    await expect(tx)
      .to.emit(dex, 'IncreaseLiquidity')
      .withArgs(owner.address, ethers.utils.parseEther('1'));

    const liquidityBalance = await dex.liquidityBalance();
    expect(liquidityBalance.toString(), 'liquidityBalance').to.eql(
      ethers.utils.parseEther('1').toString()
    );
  });

  it('Check place order from liquidity', async () => {
    await dex.addChain(ethChain, ethContract.address);
    await dex.addChain(bnbChain, bnbContract.address);
    await dex.deprecateChain(bnbChain);

    await dex.increaseLiquidity({
      value: ethers.utils.parseEther('1'),
      gasLimit: 600000,
    });

    await expect(
      dex.placeOrderFromLiquidity(ethers.utils.parseEther('1'), 1, bnbChain)
    ).to.be.revertedWith('DAO: branch is deprecated');
    await expect(
      dex.connect(bob).placeOrderFromLiquidity(ethers.utils.parseEther('1'), 1, ethChain)
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(
      dex.placeOrderFromLiquidity(ethers.utils.parseEther('1'), 1, avalancheChain)
    ).to.be.revertedWith('DAO: chain not created');
    await expect(
      dex.placeOrderFromLiquidity(ethers.utils.parseEther('2'), 1, ethChain)
    ).to.be.revertedWith('DAO: insufficient ballance');

    const tx = await dex.placeOrderFromLiquidity(ethers.utils.parseEther('1'), 1, ethChain);
    await expect(tx).to.emit(dexStore, 'PlaceOrder').withArgs(owner.address, BigNumber.from('1'));

    const liquidityBalance = await dex.liquidityBalance();
    expect(liquidityBalance.toString(), 'liquidityBalance').to.eql('0');
  });

  it('Check set lock time and unban contract', async () => {
    await expect(dex.connect(bob).setLockTime([bob.address])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await dex.setLockTime([bob.address]);

    const [getContractRestrictsPeriod, getContractRestrictsCount, getContractRestrictsBanned] =
      await dex.getSellerRestricts(bob.address);

    expect(getContractRestrictsPeriod.toString(), 'getContractRestricts').to.eql('0');
    expect(getContractRestrictsCount, 'getContractRestricts').to.eql(1);
    expect(getContractRestrictsBanned, 'getContractRestricts').to.eql(false);

    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    const tx = await dex.setLockTime([bob.address]);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const block = await provider.getBlock(tx.blockNumber!);
    const [rPeriod, rCount, rBanned] = await dex.getSellerRestricts(bob.address);

    expect(rPeriod.toString(), 'getContractRestricts').to.eql(
      BigNumber.from(String(block.timestamp))
        .add(BigNumber.from(String(60 * 60)))
        .toString()
    );
    expect(rCount, 'getContractRestricts').to.eql(4);
    expect(rBanned, 'getContractRestricts').to.eql(false);

    await dex.setLockTime([bob.address]);
    const tx5 = await dex.setLockTime([bob.address]);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const block5 = await provider.getBlock(tx5.blockNumber!);
    const [rPeriod5, rCount5, rBanned5] = await dex.getSellerRestricts(bob.address);

    expect(rPeriod5.toString(), 'getContractRestricts').to.eql(
      BigNumber.from(String(block5.timestamp))
        .add(BigNumber.from(String(60 * 60 * 24)))
        .toString()
    );
    expect(rCount5, 'getContractRestricts').to.eql(6);
    expect(rBanned5, 'getContractRestricts').to.eql(false);

    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, rCount10, rBanned10] = await dex.getSellerRestricts(bob.address);
    expect(rCount10, 'getContractRestricts').to.eql(10);
    expect(rBanned10, 'getContractRestricts').to.eql(true);

    await expect(
      dex.unbanContract(emptyAddress, {
        value: BigNumber.from('1'),
        gasLimit: 600000,
      })
    ).to.be.revertedWith('DAO: unban for zero address');

    await dex.unbanContract(alice.address, {
      value: BigNumber.from('1'),
      gasLimit: 600000,
    });

    await dex.setRestrictionsPrice(3, 4);

    await dex.unbanContract(bob.address, {
      value: BigNumber.from('2'),
      gasLimit: 600000,
    });

    await dex.setRestrictionsPrice(1, 2);

    const txUnban = await dex.unbanContract(bob.address, {
      value: BigNumber.from('2'),
      gasLimit: 600000,
    });
    await expect(txUnban).to.emit(dex, 'PurchaseUnban').withArgs(bob.address, BigNumber.from('2'));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_unban, rCountUnban, rBannedUnban] = await dex.getSellerRestricts(bob.address);
    expect(rCountUnban).to.eql(0);
    expect(rBannedUnban).to.eql(false);

    await expect(dex.connect(bob).unbanContractOwned(alice.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(dex.unbanContractOwned(emptyAddress)).to.be.revertedWith(
      'DAO: unban for zero address'
    );
    await dex.unbanContractOwned(alice.address);

    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);

    await dex.unbanContractOwned(bob.address);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_unban2, rCountUnban2, rBannedUnban2] = await dex.getSellerRestricts(bob.address);
    expect(rCountUnban2).to.eql(0);
    expect(rBannedUnban2).to.eql(false);
  });

  it('Check place order', async () => {
    await dex.addChain(ethChain, ethContract.address);
    await dex.addChain(bnbChain, bnbContract.address);
    await dex.deprecateChain(bnbChain);

    await expect(
      dex.placeExchangeOrder(ethers.utils.parseEther('1'), bnbChain, owner.address, {
        value: ethers.utils.parseEther('1'),
        gasLimit: 600000,
      })
    ).to.be.revertedWith('DAO: branch is deprecated');

    await expect(
      dex.placeExchangeOrder(ethers.utils.parseEther('1'), avalancheChain, owner.address, {
        value: ethers.utils.parseEther('1'),
        gasLimit: 600000,
      })
    ).to.be.revertedWith('DAO: chain not created');

    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);

    await expect(
      dex.connect(bob).placeExchangeOrder(ethers.utils.parseEther('1'), ethChain, owner.address, {
        value: ethers.utils.parseEther('1'),
        gasLimit: 600000,
      })
    ).to.be.revertedWith('DAO: operation is temporarily unavailable');

    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);
    await dex.setLockTime([bob.address]);

    await expect(
      dex.connect(bob).placeExchangeOrder(ethers.utils.parseEther('1'), ethChain, owner.address, {
        value: ethers.utils.parseEther('1'),
        gasLimit: 600000,
      })
    ).to.be.revertedWith('DAO: address is banned');

    const tx = await dex.placeExchangeOrder(ethers.utils.parseEther('1'), ethChain, owner.address, {
      value: ethers.utils.parseEther('1'),
      gasLimit: 600000,
    });
    await expect(tx).to.emit(dexStore, 'PlaceOrder').withArgs(owner.address, BigNumber.from('1'));
  });

  it('Check reserve/unreserve order', async () => {
    await expect(dex.connect(bob).batchReserveOrders(1, [], [])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(dex.batchReserveOrders(1, [1], [])).to.be.revertedWith('DAO: wrong data');

    await dex.addChain(ethChain, ethContract.address);
    const tx = await dex.placeExchangeOrder(ethers.utils.parseEther('1'), ethChain, owner.address, {
      value: ethers.utils.parseEther('1'),
      gasLimit: 600000,
    });
    await expect(tx).to.emit(dexStore, 'PlaceOrder').withArgs(owner.address, BigNumber.from('1'));
    const logs = await provider.getLogs({
      ...dexStore.filters.PlaceOrder(owner.address),
      blockHash: tx.blockHash,
    });
    const iface = new ethers.utils.Interface([
      'event PlaceOrder(address indexed seller, uint256 indexed orderId)',
    ]);
    const placeOrderLog = iface.parseLog(logs[0]).args;
    expect(placeOrderLog[0]).to.eql(owner.address);
    expect(placeOrderLog[1].toString()).to.eql(BigNumber.from('1').toString());

    const txBatch = await dex.batchReserveOrders(
      BigNumber.from('1'),
      [BigNumber.from('1')],
      [ethers.utils.parseEther('1')]
    );

    const logsBatch = await provider.getLogs({
      ...dexStore.filters.ReserveOrderException(BigNumber.from('1')),
      blockHash: txBatch.blockHash,
    });

    expect(logsBatch.length).to.eql(0);
    const reservedBalance = await dex.reservedOrderAmount(BigNumber.from('1'));
    expect(reservedBalance.toString()).to.eql(ethers.utils.parseEther('1').toString());

    const txBatch2 = await dex.batchReserveOrders(
      BigNumber.from('2'),
      [BigNumber.from('1')],
      [ethers.utils.parseEther('1')]
    );

    const logsBatch2 = await provider.getLogs({
      ...dexStore.filters.ReserveOrderException(BigNumber.from('2')),
      blockHash: txBatch2.blockHash,
    });
    expect(logsBatch2.length).to.eql(1);
    const ifaceBatch2 = new ethers.utils.Interface([
      'event ReserveOrderException(uint256 indexed operationId,uint256 indexed orderId,uint256 value)',
    ]);
    const logBatch2 = ifaceBatch2.parseLog(logsBatch2[0]).args;
    expect(logBatch2[0].toString()).to.eql(BigNumber.from('2').toString());
    expect(logBatch2[1].toString()).to.eql(BigNumber.from('1').toString());
    expect(logBatch2[2].toString()).to.eql(ethers.utils.parseEther('1').toString());

    await expect(dex.connect(bob).batchUnreserveOrders([], [])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(dex.batchUnreserveOrders([1], [])).to.be.revertedWith('DAO: wrong data');

    await dex.batchUnreserveOrders([BigNumber.from('1')], [ethers.utils.parseEther('1').div(2)]);

    const reservedBalance1 = await dex.reservedOrderAmount(BigNumber.from('1'));
    expect(reservedBalance1.toString()).to.eql(ethers.utils.parseEther('1').div(2).toString());

    await dex.batchUnreserveOrders([BigNumber.from('1')], [ethers.utils.parseEther('1').div(2)]);
    const reservedBalance2 = await dex.reservedOrderAmount(BigNumber.from('1'));
    expect(reservedBalance2.toString()).to.eql('0');
  });

  it('Check batch write off balance', async () => {
    await expect(dex.connect(bob).batchWriteOffBalance(1, [], [])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(dex.batchWriteOffBalance(1, [1], [])).to.be.revertedWith('DAO: wrong data');

    await dex.addChain(ethChain, ethContract.address);
    await dex.placeExchangeOrder(ethers.utils.parseEther('1'), ethChain, owner.address, {
      value: ethers.utils.parseEther('1'),
      gasLimit: 600000,
    });
    await dex.placeExchangeOrder(ethers.utils.parseEther('1'), ethChain, owner.address, {
      value: ethers.utils.parseEther('1'),
      gasLimit: 600000,
    });

    const tx = await dex.batchWriteOffBalance(
      BigNumber.from('1'),
      [BigNumber.from('1')],
      [ethers.utils.parseEther('1')]
    );

    const logsWriteOff = await provider.getLogs({
      ...dexStore.filters.WriteOffException(BigNumber.from('1')),
      blockHash: tx.blockHash,
    });
    expect(logsWriteOff.length).to.eql(1);
    const ifaceWriteOff = new ethers.utils.Interface([
      'event WriteOffException(uint256 indexed operationId,uint256 indexed orderId,uint256 value)',
    ]);
    const logWriteOff = ifaceWriteOff.parseLog(logsWriteOff[0]).args;
    expect(logWriteOff[0].toString()).to.eql(BigNumber.from('1').toString());
    expect(logWriteOff[1].toString()).to.eql(BigNumber.from('1').toString());
    expect(logWriteOff[2].toString()).to.eql(ethers.utils.parseEther('1').toString());

    await dex.batchReserveOrders(
      BigNumber.from('1'),
      [BigNumber.from('2')],
      [ethers.utils.parseEther('1')]
    );

    const tx2 = await dex.batchWriteOffBalance(
      BigNumber.from('2'),
      [BigNumber.from('2')],
      [ethers.utils.parseEther('1').div(2)]
    );
    const logsWriteOff2 = await provider.getLogs({
      ...dexStore.filters.WriteOffException(BigNumber.from('2')),
      blockHash: tx2.blockHash,
    });
    expect(logsWriteOff2.length).to.eql(0);
    const reservedBalance = await dex.reservedOrderAmount(2);
    expect(reservedBalance.toString()).to.eql(ethers.utils.parseEther('1').div(2).toString());
    const activeOrderIds2 = await dex.activeOrderIds();
    expect(activeOrderIds2.map((el) => el.toString())).to.eql([
      BigNumber.from('1').toString(),
      BigNumber.from('2').toString(),
    ]);

    const tx3 = await dex.batchWriteOffBalance(
      BigNumber.from('3'),
      [BigNumber.from('2')],
      [ethers.utils.parseEther('1').div(2)]
    );
    const logsWriteOff3 = await provider.getLogs({
      ...dexStore.filters.WriteOffException(BigNumber.from('3')),
      blockHash: tx3.blockHash,
    });
    expect(logsWriteOff3.length).to.eql(0);
    const reservedBalance3 = await dex.reservedOrderAmount(2);
    expect(reservedBalance3.toString()).to.eql('0');
    const activeOrderIds3 = await dex.activeOrderIds();
    expect(activeOrderIds3.map((el) => el.toString())).to.eql([BigNumber.from('1').toString()]);

    await expect(tx3)
      .to.emit(dexStore, 'FilledOrder')
      .withArgs(BigNumber.from('3'), BigNumber.from('2'), ethers.utils.parseEther('1').div(2));
  });

  it('Check batch send exchanged balance', async () => {
    await expect(dex.connect(bob).batchSendExchangedBalance(1, [], [])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(dex.batchSendExchangedBalance(1, [1], [])).to.be.revertedWith('DAO: wrong data');
    await expect(
      dex.batchSendExchangedBalance(1, [ethers.utils.parseEther('1')], [bob.address])
    ).to.be.revertedWith('DAO: not enough balance');

    const txBody = {
      value: ethers.utils.parseEther('1'),
      gasLimit: 600000,
    };
    await dex.increaseLiquidity(txBody);

    const tx = await dex.batchSendExchangedBalance(
      1,
      [ethers.utils.parseEther('1').div(2), ethers.utils.parseEther('1').div(2)],
      [bob.address, alice.address]
    );

    await expect(tx)
      .to.emit(dex, 'SendExchangedBalance')
      .withArgs(BigNumber.from('1'), bob.address, ethers.utils.parseEther('1').div(2));
    await expect(tx)
      .to.emit(dex, 'SendExchangedBalance')
      .withArgs(BigNumber.from('1'), alice.address, ethers.utils.parseEther('1').div(2));

    await expect(tx).to.changeEtherBalances(
      [alice.address, bob.address, dex.address],
      [
        ethers.utils.parseEther('1').div(2).toString(),
        ethers.utils.parseEther('1').div(2).toString(),
        `-${ethers.utils.parseEther('1').toString()}`,
      ]
    );
  });

  it('Check close order', async () => {
    await dex.addChain(ethChain, ethContract.address);

    await dex
      .connect(alice)
      .placeExchangeOrder(ethers.utils.parseEther('1'), ethChain, owner.address, {
        value: ethers.utils.parseEther('1'),
        gasLimit: 600000,
      });

    await dex.batchReserveOrders(
      BigNumber.from('1'),
      [BigNumber.from('1')],
      [ethers.utils.parseEther('1')]
    );

    await expect(dex.connect(bob).closeExchangeOrder(1)).to.be.revertedWith(
      'DAO: caller is not the seller'
    );

    await expect(dex.connect(alice).closeExchangeOrder(1)).to.be.revertedWith(
      'DAO: the order is selected for exchange'
    );

    await dex.batchUnreserveOrders([BigNumber.from('1')], [ethers.utils.parseEther('1')]);

    const tx = await dex.connect(alice).closeExchangeOrder(1);

    await expect(tx).to.emit(dexStore, 'CloseOrder').withArgs(alice.address, BigNumber.from('1'));

    await expect(tx).to.changeEtherBalances(
      [alice.address, dex.address],
      [ethers.utils.parseEther('1').toString(), `-${ethers.utils.parseEther('1').toString()}`]
    );

    await expect(dex.connect(alice).closeExchangeOrder(1)).to.be.revertedWith(
      'DAO: order already close'
    );
  });

  it('Check return tokens to owner', async () => {
    const ZLOIDEXChainsNew = await ethers.getContractFactory('ZLOIDEXChains', owner);
    const newDexChains = await ZLOIDEXChainsNew.deploy(ethChain, ethContract.address);
    await newDexChains.deployed();
    await expect(newDexChains.connect(bob).checkBranch(currentChain)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexChains.connect(bob).addChain(currentChain, dex.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(newDexChains.connect(bob).deprecateChain(currentChain)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(
      newDexChains.connect(bob).changeBranchContract(ethChain, dex.address)
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(newDexChains.changeBranchContract(ethChain, dex.address)).to.be.revertedWith(
      'DAO: operation allowed only for branch'
    );

    await expect(dex.connect(alice).returnTokensToOwner(token.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await dex.returnTokensToOwner(token.address);
    await token.transfer(dex.address, ethers.utils.parseEther('1'));
    const ownerTokenBalance = await token.balanceOf(owner.address);
    const dexTokenBalance = await token.balanceOf(dex.address);
    expect(ownerTokenBalance.toString()).to.eql(
      BigNumber.from(supplyStringTotal).sub(ethers.utils.parseEther('1')).toString()
    );
    expect(dexTokenBalance.toString()).to.eql(ethers.utils.parseEther('1').toString());
    await dex.returnTokensToOwner(token.address);
    const ownerTokenBalance2 = await token.balanceOf(owner.address);
    const dexTokenBalance2 = await token.balanceOf(dex.address);
    expect(ownerTokenBalance2.toString()).to.eql(BigNumber.from(supplyStringTotal).toString());
    expect(dexTokenBalance2.toString()).to.eql('0');
  });

  describe('Check cross chain functionality', () => {
    it('Add chain', async () => {
      await expect(dex.connect(alice).addChain(ethChain, ethContract.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(dex.addChain(currentChain, ethContract.address)).to.be.revertedWith(
        'DAO: operation allowed only for branch'
      );

      await dex.addChain(ethChain, ethContract.address);

      await expect(dex.addChain(ethChain, ethContract.address)).to.be.revertedWith(
        'DAO: branch already created'
      );

      const usedChains = await dex.usedChains();
      const branchContract = await dex.branchContract(ethChain);

      expect(usedChains, 'usedChains').to.eql([currentChain, ethChain]);
      expect(branchContract, 'branchContract').to.eql(ethContract.address);
    });

    it('Deprecate chain', async () => {
      await expect(dex.deprecateChain(ethChain)).to.be.revertedWith('DAO: chain not created');

      await dex.addChain(bnbChain, bnbContract.address);
      await dex.addChain(ethChain, ethContract.address);

      const usedChains = await dex.usedChains();
      expect(usedChains, 'usedChains').to.eql([currentChain, bnbChain, ethChain]);

      await expect(dex.connect(alice).deprecateChain(ethChain)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(dex.deprecateChain(currentChain)).to.be.revertedWith(
        'DAO: operation allowed only for branch'
      );

      await dex.deprecateChain(ethChain);
      await dex.deprecateChain(bnbChain);

      const usedChainsAfter = await dex.usedChains();
      const deprecatedChains = await dex.deprecatedChains();

      expect(usedChainsAfter, 'usedChains').to.eql([currentChain]);
      expect(deprecatedChains, 'deprecatedChains').to.eql([ethChain, bnbChain]);

      await expect(dex.addChain(ethChain, ethContract.address)).to.be.revertedWith(
        'DAO: branch is deprecated'
      );
    });

    it('Change branch contract', async () => {
      await expect(dex.changeBranchContract(ethChain, newEthContract.address)).to.be.revertedWith(
        'DAO: chain not created'
      );

      await dex.addChain(ethChain, ethContract.address);

      await expect(
        dex.connect(alice).changeBranchContract(ethChain, newEthContract.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        dex.changeBranchContract(currentChain, newEthContract.address)
      ).to.be.revertedWith('DAO: operation allowed only for branch');

      await expect(dex.changeBranchContract(ethChain, emptyAddress)).to.be.revertedWith(
        'DAO: wrong address'
      );

      await dex.changeBranchContract(ethChain, newEthContract.address);

      const branchContract = await dex.branchContract(ethChain);
      expect(branchContract).to.eq(newEthContract.address);
    });
  });
});
