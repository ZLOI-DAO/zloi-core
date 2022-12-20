import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ZLOIDAO, ZLOI, ZLOIDEX } from '../typechain-types';
import ZLOIJson from '../artifacts/contracts/ZLOI.sol/ZLOI.json';
import ZLOIDEXJson from '../artifacts/contracts/ZLOIDEX.sol/ZLOIDEX.json';

const utils = ethers.utils;

const currentChain = 137;
const ethChain = 1;
const bnbChain = 56;
const emptyAddress = '0x0000000000000000000000000000000000000000';
const transferFromBranchHash = '0x018429fe307666f293c857e18cea670b52cebc191553f99a664503018f46b50e';

describe('ZLOI DAO tests', () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let ethBranchContract: SignerWithAddress;
  let bnbBranchContract: SignerWithAddress;
  let dao: ZLOIDAO;
  let token: ZLOI;
  let dex: ZLOIDEX;

  beforeEach(async () => {
    [owner, alice, bob, ethBranchContract, bnbBranchContract] = await ethers.getSigners();
    const ZLOIDAO = await ethers.getContractFactory('ZLOIDAO', owner);
    dao = (await ZLOIDAO.deploy(1000000000, 100000000, 50000000, 137, owner.address)) as ZLOIDAO;
    await dao.deployed();
    const tokenAddress = await dao.token();
    token = new ethers.Contract(tokenAddress, ZLOIJson.abi, owner) as ZLOI;
    const dexAddress = await dao.dex();
    dex = new ethers.Contract(dexAddress, ZLOIDEXJson.abi, owner) as ZLOIDEX;
  });

  it('Check view functions', async () => {
    await expect(dao.connect(bob).moveToBranchOrders(ethChain)).to.be.revertedWith(
      'Ownable: forbidden'
    );
    const ceo = await dao.ceo();
    const executor = await dao.executor();
    const tokenAddress = await dao.token();
    const daoBalance = await dao.balance();
    const dexAddress = await dao.dex();
    const daoUsedChains = await dao.usedChains();
    const moveOrder = await dao.moveToBranchOrder(ethChain);
    const chainFee = await dao.crossChainTransferFee(ethChain);
    const orders = await dao.moveToBranchOrders(ethChain);

    expect(ceo).to.eq(owner.address);
    expect(executor).to.eq(owner.address);
    expect(tokenAddress).to.be.properAddress;
    expect(daoBalance).to.eq(utils.parseEther('850000000'));
    expect(dexAddress).to.be.properAddress;
    expect(daoUsedChains).to.eql([currentChain]);
    expect(moveOrder.toString()).to.eq('0');
    expect(chainFee.toString()).to.eq('0');
    expect(orders).to.eql([]);
  });

  it('Check common functions', async () => {
    await expect(dao.connect(bob).changeExecutor(alice.address)).to.be.revertedWith(
      'Ownable: forbidden'
    );
    await dao.changeExecutor(alice.address);
    await expect(dao.connect(bob).executor()).to.be.revertedWith('Ownable: forbidden');
    const executor = await dao.connect(alice).executor();
    expect(executor).to.eq(alice.address);

    await expect(
      dao.connect(bob).setCrossChainTransferFee(utils.parseEther('0.001'), ethChain)
    ).to.be.revertedWith('Ownable: forbidden');
    await dao.setCrossChainTransferFee(utils.parseEther('0.001'), ethChain);
    const fee = await dao.crossChainTransferFee(ethChain);
    expect(fee.toString()).to.eql(utils.parseEther('0.001').toString());

    await expect(
      dao.connect(bob).createBranch(ethChain, ethBranchContract.address, 0, 0)
    ).to.be.revertedWith('Ownable: forbidden');
    await dao.createBranch(ethChain, ethBranchContract.address, 0, 0);
    const daoUsedChains = await dao.usedChains();
    expect(daoUsedChains).to.eql([currentChain, ethChain]);
    const chainBalance = await token.branchSupply(ethChain);
    expect(chainBalance.toString()).to.eql('0');

    await expect(dao.connect(bob).deprecateBranch(ethChain)).to.be.revertedWith(
      'Ownable: forbidden'
    );
    await dao.deprecateBranch(ethChain);
    const daoUsedChainsAfterDeprecate = await dao.usedChains();
    expect(daoUsedChainsAfterDeprecate).to.eql([currentChain]);
    const daoDeprecatedBranches = await token.deprecatedChains();
    expect(daoDeprecatedBranches).to.eql([ethChain]);

    await expect(dao.connect(bob).addDexLiquidity(100)).to.be.revertedWith('Ownable: forbidden');
    await dao.addDexLiquidity(100);
    const dexBalance = await token.balanceOf(dex.address);
    expect(dexBalance.toString()).to.eql(
      utils.parseEther('100').add(utils.parseEther('100000000')).toString()
    );

    const txBody = {
      to: dao.address,
      value: ethers.utils.parseEther('2'),
    };
    await expect(owner.sendTransaction(txBody)).to.be.revertedWith('DAO: wrong data');
    const abi = ['function test() public view returns (bool)'];
    const daoContract = new ethers.Contract(dao.address, abi, owner);
    await expect(daoContract.test()).to.be.revertedWith('DAO: wrong data');

    await expect(dao.connect(bob).changeToken(ethBranchContract.address)).to.be.revertedWith(
      'Ownable: forbidden'
    );
    await expect(dao.changeToken(emptyAddress)).to.be.revertedWith('DAO: wrong address');
    await dao.changeToken(ethBranchContract.address);
    const newDaoToken = await dao.token();
    expect(newDaoToken).to.eql(ethBranchContract.address);

    const ZLOIDEXNew = await ethers.getContractFactory('ZLOIDEX', owner);
    const newDex = await ZLOIDEXNew.deploy(1, 2, owner.address, token.address, currentChain, 1);
    await newDex.deployed();

    await expect(dao.connect(bob).changeDex(newDex.address)).to.be.revertedWith(
      'Ownable: forbidden'
    );
    await expect(dao.changeDex(emptyAddress)).to.be.revertedWith('DAO: wrong address');
    await expect(dao.changeDex(newDex.address)).to.be.revertedWith('DAO: wrong dex owner');
    await newDex.transferOwnership(dao.address, owner.address);
    await dao.changeDex(newDex.address);
    const newDexAddress = await dao.dex();
    expect(newDexAddress).to.eql(newDex.address);
  });

  it('Just run other contracts functions', async () => {
    await expect(dao.connect(bob).mint(1)).to.be.revertedWith('Ownable: forbidden');
    await expect(dao.connect(bob).burn(1)).to.be.revertedWith('Ownable: forbidden');
    await expect(dao.connect(bob).increaseAllowance(alice.address, 1)).to.be.revertedWith(
      'Ownable: forbidden'
    );
    await expect(dao.connect(bob).decreaseAllowance(alice.address, 1)).to.be.revertedWith(
      'Ownable: forbidden'
    );
    await expect(
      dao
        .connect(bob)
        .transferFromBranch(bnbChain, 100, transferFromBranchHash, [owner.address], [100])
    ).to.be.revertedWith('Ownable: forbidden');
    await expect(
      dao.connect(bob).changeBranchContract(bnbChain, ethBranchContract.address)
    ).to.be.revertedWith('Ownable: forbidden');
    await expect(dao.connect(bob).transferTokenOwnership(alice.address)).to.be.revertedWith(
      'Ownable: forbidden'
    );
    await expect(dao.connect(bob).changeDexExecutor(alice.address)).to.be.revertedWith(
      'Ownable: forbidden'
    );
    await expect(dao.connect(bob).transferDexOwnership(alice.address)).to.be.revertedWith(
      'Ownable: forbidden'
    );
    await expect(dao.connect(bob).transferDexStoreOwnership(alice.address)).to.be.revertedWith(
      'Ownable: forbidden'
    );

    await dao.mint(1);
    await dao.burn(1);
    await dao.increaseAllowance(alice.address, 1);
    await dao.decreaseAllowance(alice.address, 1);
    await dao.createBranch(bnbChain, bnbBranchContract.address, 100, 0);
    await dao.transferFromBranch(bnbChain, 100, transferFromBranchHash, [owner.address], [100]);
    await dao.changeBranchContract(bnbChain, ethBranchContract.address);
    await dao.transferTokenOwnership(alice.address);
    await dao.changeDexExecutor(alice.address);

    await dao.transferDexOwnership(alice.address);
    const ZLOIDEXNew = await ethers.getContractFactory('ZLOIDEX', owner);
    const newDex = await ZLOIDEXNew.deploy(1, 2, owner.address, token.address, currentChain, 1);
    await newDex.deployed();
    await newDex.transferOwnership(dao.address, newDex.address);
    await dao.changeDex(newDex.address);
    await dao.transferDexStoreOwnership(alice.address);
  });

  it('Check increase and close order for transfer between branches', async () => {
    const transferAmount = utils.parseEther('10');
    const transferFee1 = utils.parseEther('0.001');
    const transferFee2 = utils.parseEther('0.0005');
    const transferFee3 = utils.parseEther('0.0015');
    await expect(dao.increaseMoveToBranchOrder(transferAmount, ethChain)).to.be.revertedWith(
      'DAO: insufficient allowance'
    );
    await token.approve(dao.address, transferAmount);
    await expect(dao.increaseMoveToBranchOrder(transferAmount, ethChain)).to.be.revertedWith(
      'DAO: unused chain'
    );
    await dao.createBranch(ethChain, ethBranchContract.address, 0, transferFee1);
    const tx = await dao.increaseMoveToBranchOrder(transferAmount, ethChain, {
      value: transferFee1,
    });

    await expect(tx).to.changeEtherBalances(
      [dao.address, owner.address],
      [transferFee1.toString(), `-${transferFee1.toString()}`]
    );

    const orders = await dao.moveToBranchOrders(ethChain);
    expect(orders).to.eql([owner.address]);

    await dao.setCrossChainTransferFee(transferFee2, ethChain);

    await token.approve(dao.address, transferAmount.mul(2));
    const tx2 = await dao.increaseMoveToBranchOrder(transferAmount, ethChain);

    await expect(tx2).to.changeEtherBalances(
      [owner.address, dao.address],
      [transferFee2.toString(), `-${transferFee2.toString()}`]
    );

    await dao.setCrossChainTransferFee(transferFee3, ethChain);

    await token.approve(dao.address, transferAmount.mul(3));
    await expect(dao.increaseMoveToBranchOrder(transferAmount, ethChain)).to.be.revertedWith(
      'DAO: not enough fees'
    );
    const tx3 = await dao.increaseMoveToBranchOrder(transferAmount, ethChain, {
      value: transferFee3,
    });
    await expect(tx3).to.changeEtherBalances(
      [dao.address, owner.address],
      [transferFee1.toString(), `-${transferFee1.toString()}`]
    );

    await token.approve(dao.address, transferAmount.mul(4));
    await dao.increaseMoveToBranchOrder(transferAmount, ethChain);

    await token.connect(alice).approve(dao.address, transferAmount);
    await dao
      .connect(alice)
      .increaseMoveToBranchOrder(transferAmount, ethChain, { value: transferFee3 });

    await expect(dao.connect(bob).closeMoveToBranchOrder(ethChain)).to.be.revertedWith(
      'DAO: order not init'
    );

    const tx4 = await dao.closeMoveToBranchOrder(ethChain);
    await expect(tx4).to.changeEtherBalances(
      [owner.address, dao.address],
      [transferFee3.toString(), `-${transferFee3.toString()}`]
    );

    await dao.connect(alice).closeMoveToBranchOrder(ethChain);
  });

  it('Check transfer between branches', async () => {
    const balance = utils.parseEther('100');
    await expect(
      dao.connect(bob).transferBetweenBranches(ethChain, bnbChain, balance)
    ).to.be.revertedWith('Ownable: forbidden');
    await dao.createBranch(ethChain, ethBranchContract.address, 100, 0);
    await dao.createBranch(bnbChain, bnbBranchContract.address, 0, 0);
    await dao.transferBetweenBranches(ethChain, bnbChain, balance);
    const chainBalance1 = await token.branchSupply(ethChain);
    const chainBalance2 = await token.branchSupply(bnbChain);
    expect(chainBalance1.toString(), 'Eth chain balance').to.eq('0');
    expect(chainBalance2.toString(), 'Bnb chain balance').to.eq(balance.toString());
  });

  it('Check send to branch', async () => {
    await expect(dao.connect(bob).transferToBranch(1, 1, ethChain, [], [])).to.be.revertedWith(
      'Ownable: forbidden'
    );
    await expect(dao.transferToBranch(1, 1, ethChain, [owner.address], [])).to.be.revertedWith(
      'DAO: wrong data'
    );
    await expect(
      dao.transferToBranch(
        1,
        utils.parseEther('1'),
        ethChain,
        [owner.address],
        [utils.parseEther('10')]
      )
    ).to.be.revertedWith('DAO: wrong amount');
    await dao.transferToBranch(
      1,
      utils.parseEther('10'),
      ethChain,
      [owner.address],
      [utils.parseEther('10')]
    );

    await token.approve(dao.address, utils.parseEther('10'));
    await dao.createBranch(ethChain, ethBranchContract.address, 0, utils.parseEther('0.001'));
    await dao.increaseMoveToBranchOrder(utils.parseEther('10'), ethChain, {
      value: utils.parseEther('0.001'),
    });
    await token.approve(dao.address, utils.parseEther('5'));
    await dao.transferToBranch(
      2,
      utils.parseEther('10'),
      ethChain,
      [owner.address],
      [utils.parseEther('10')]
    );
    await token.approve(dao.address, utils.parseEther('10'));
    const tx = await dao.transferToBranch(
      3,
      utils.parseEther('10'),
      ethChain,
      [owner.address],
      [utils.parseEther('10')]
    );
    const orders = await dao.moveToBranchOrders(ethChain);
    expect(orders).to.eql([]);
    await expect(tx)
      .to.emit(dao, 'TransferOrderToBranchSucceed')
      .withArgs(3, owner.address, utils.parseEther('10'));
    await expect(tx)
      .to.emit(token, 'Transfer')
      .withArgs(owner.address, dao.address, utils.parseEther('10'));
    await expect(tx)
      .to.emit(token, 'Transfer')
      .withArgs(dao.address, emptyAddress, utils.parseEther('10'));
  });

  it('Check get fees fro executor', async () => {
    await expect(dao.connect(bob).getFeesForExecutor()).to.be.revertedWith('Ownable: forbidden');

    await token.approve(dao.address, utils.parseEther('10'));
    await dao.createBranch(ethChain, ethBranchContract.address, 0, utils.parseEther('0.001'));
    await dao.increaseMoveToBranchOrder(utils.parseEther('10'), ethChain, {
      value: utils.parseEther('0.001'),
    });
    await dao.transferToBranch(
      1,
      utils.parseEther('10'),
      ethChain,
      [owner.address],
      [utils.parseEther('10')]
    );
    const tx = await dao.getFeesForExecutor();
    await expect(tx).to.changeEtherBalances(
      [owner.address, dao.address],
      [utils.parseEther('0.001').toString(), `-${utils.parseEther('0.001').toString()}`]
    );
  });
});
