import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ZLOI } from '../typechain-types';

const nameSymbolContract = 'ZLOI';
const supply = 1000000000;
const supplyString = String(supply);
const supplyStringTotal = ethers.utils.parseEther(supplyString).toString();
const currentChain = 137;
const emptyAddress = '0x0000000000000000000000000000000000000000';
const invalidInterfaceId = '0xffffffff';
const erc20InterfaceId = '0x36372b07';
const ethChain = 1;
const bnbChain = 56;
const transferFromBranchHash = '0x018429fe307666f293c857e18cea670b52cebc191553f99a664503018f46b50e';

describe('ZLOI token tests', () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let ethContract: SignerWithAddress;
  let newEthContract: SignerWithAddress;
  let bnbContract: SignerWithAddress;
  let token: ZLOI;
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
  });

  it('Check view and pure functions', async () => {
    const logs = await provider.getLogs(token.filters.Transfer(null, owner.address));
    const usedChains = await token.usedChains();
    const deprecatedChains = await token.deprecatedChains();
    const tokenOwner = await token.owner();
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();
    const currentChainId = await token.currentChainId();
    const currentChainSupply = await token.currentChainSupply();
    const branchSupply = await token.branchSupply(ethChain);
    const branchContract = await token.branchContract(ethChain);
    const balanceOfEmpty = await token.balanceOf(alice.address);
    const balanceOfOwner = await token.balanceOf(owner.address);
    const allowance = await token.allowance(alice.address, bob.address);
    const supportsInterface = await token.supportsInterface(erc20InterfaceId);

    expect(logs.length, 'logs length').to.eql(1);
    const iface = new ethers.utils.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);
    const constructorMintLog = iface.parseLog(logs[0]).args;
    expect(constructorMintLog[0], 'mint log from address').to.eql(emptyAddress);
    expect(constructorMintLog[1], 'mint log to address').to.eql(owner.address);
    expect(constructorMintLog[2].toString(), 'mint log amount').to.eql(supplyStringTotal);
    expect(usedChains, 'usedChains').to.eql([currentChain]);
    expect(deprecatedChains, 'deprecatedChains').to.eql([]);
    expect(tokenOwner, 'tokenOwner').to.eq(owner.address);
    expect(name, 'name').to.eq(nameSymbolContract);
    expect(symbol, 'symbol').to.eq(nameSymbolContract);
    expect(decimals, 'decimals').to.eq(18);
    expect(totalSupply.toString(), 'totalSupply').to.eq(supplyStringTotal);
    expect(currentChainId, 'currentChainId').to.eq(currentChain);
    expect(currentChainSupply.toString(), 'currentChainSupply').to.eq(supplyStringTotal);
    expect(branchSupply.toString(), 'branchSupply').to.eq('0');
    expect(branchContract, 'branchContract').to.eq(emptyAddress);
    expect(balanceOfEmpty.toString(), 'balanceOfEmpty').to.eq('0');
    expect(balanceOfOwner.toString(), 'balanceOfOwner').to.eq(supplyStringTotal);
    expect(allowance.toString(), 'allowance').to.eq('0');
    expect(supportsInterface, 'supportsInterface').to.eq(true);

    await expect(
      token.supportsInterface(invalidInterfaceId),
      'supportsInterface error'
    ).to.be.revertedWith('ERC165: invalid interface id');
  });

  it('Check transfer ownership', async () => {
    await expect(token.connect(bob).transferOwnership(alice.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await expect(token.transferOwnership(emptyAddress)).to.be.revertedWith(
      'Ownable: new owner is the zero address'
    );

    const tx = await token.transferOwnership(alice.address);

    await expect(tx).to.emit(token, 'OwnershipTransferred').withArgs(owner.address, alice.address);

    const tokenOwner = await token.owner();

    expect(tokenOwner, 'tokenOwner').to.eq(alice.address);
  });

  it('Check mint', async () => {
    await expect(token.connect(bob).mint(supply)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    const tx = await token.mint(supply);

    await expect(tx)
      .to.emit(token, 'Transfer')
      .withArgs(emptyAddress, owner.address, supplyStringTotal);

    const totalSupply = await token.totalSupply();

    expect(totalSupply.toString(), 'totalSupply').to.eq(
      ethers.BigNumber.from(supplyStringTotal).mul(2).toString()
    );
  });

  it('Check burn', async () => {
    await expect(token.connect(bob).burn(supply)).to.be.revertedWith(
      'ERC20: burn amount exceeds balance'
    );

    const tx = await token.burn(supply);

    await expect(tx)
      .to.emit(token, 'Transfer')
      .withArgs(owner.address, emptyAddress, supplyStringTotal);

    const totalSupply = await token.totalSupply();

    expect(totalSupply.toString(), 'totalSupply').to.eq('0');
  });

  it('Check transfer', async () => {
    const transferAmount = ethers.utils.parseEther(supplyString);

    await expect(token.connect(bob).transfer(alice.address, transferAmount)).to.be.revertedWith(
      'ERC20: transfer amount exceeds balance'
    );

    const tx = await token.transfer(alice.address, transferAmount);

    await expect(tx)
      .to.emit(token, 'Transfer')
      .withArgs(owner.address, alice.address, transferAmount);

    await expect(tx).to.changeTokenBalances(
      token,
      [alice.address, owner.address],
      [transferAmount.toString(), `-${transferAmount.toString()}`]
    );
  });

  it('Check allowance', async () => {
    const transferAmount = ethers.utils.parseEther('10');

    const txApprove = await token.approve(alice.address, transferAmount);

    await expect(txApprove)
      .to.emit(token, 'Approval')
      .withArgs(owner.address, alice.address, transferAmount);

    await expect(token.approve(emptyAddress, transferAmount)).to.be.revertedWith(
      'ERC20: approve to the zero address'
    );

    await expect(
      token.connect(alice).transferFrom(owner.address, emptyAddress, transferAmount)
    ).to.be.revertedWith('ERC20: transfer to the zero address');

    await expect(
      token.connect(alice).transferFrom(owner.address, bob.address, transferAmount.add(1))
    ).to.be.revertedWith('ERC20: insufficient allowance');

    const transferFromTx = await token
      .connect(alice)
      .transferFrom(owner.address, bob.address, transferAmount);

    await expect(transferFromTx)
      .to.emit(token, 'Transfer')
      .withArgs(owner.address, bob.address, transferAmount);

    const afterTxAllowance = await token.allowance(owner.address, alice.address);
    await expect(afterTxAllowance).to.eq('0');

    await expect(transferFromTx).to.changeTokenBalances(
      token,
      [bob.address, owner.address],
      [transferAmount.toString(), `-${transferAmount.toString()}`]
    );

    await token.increaseAllowance(alice.address, transferAmount);

    const afterTxIncreaseAllowance = await token.allowance(owner.address, alice.address);
    await expect(afterTxIncreaseAllowance).to.eq(transferAmount);

    await expect(token.decreaseAllowance(alice.address, transferAmount.add(1))).to.be.revertedWith(
      'ERC20: decreased allowance below zero'
    );

    await token.decreaseAllowance(alice.address, transferAmount);

    const afterTxDecreaseAllowance = await token.allowance(owner.address, alice.address);
    await expect(afterTxDecreaseAllowance).to.eq('0');
  });

  it('Check receive and fallback', async () => {
    const txBody = {
      to: token.address,
      value: ethers.utils.parseEther('2'),
    };
    await expect(owner.sendTransaction(txBody)).to.be.revertedWith(
      'DAO: the contract does not accept payments'
    );

    const abi = ['function test() public view returns (bool)'];

    const tokenContract = new ethers.Contract(token.address, abi, owner);

    await expect(tokenContract.test()).to.be.revertedWith('DAO: wrong data');
  });

  describe('Check cross chain functionality', () => {
    it('Create branch', async () => {
      await expect(
        token.connect(alice).createBranch(ethChain, ethContract.address, supply)
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        token.createBranch(currentChain, ethContract.address, supply)
      ).to.be.revertedWith('DAO: operation allowed only for branch');

      await expect(token.createBranch(ethChain, emptyAddress, supply)).to.be.revertedWith(
        'ERC20: mint to the zero address'
      );

      await token.createBranch(ethChain, ethContract.address, supply);

      await expect(token.createBranch(ethChain, ethContract.address, supply)).to.be.revertedWith(
        'DAO: chain id already minted'
      );

      const totalSupply = await token.totalSupply();
      const branchSupply = await token.branchSupply(ethChain);
      const branchContract = await token.branchContract(ethChain);

      expect(totalSupply.toString(), 'totalSupply').to.eq(
        ethers.BigNumber.from(supplyStringTotal).mul(2).toString()
      );
      expect(branchSupply.toString(), 'branchSupply').to.eq(supplyStringTotal);
      expect(branchContract, 'branchContract').to.eq(ethContract.address);
    });

    it('Transfer to/from branch', async () => {
      await token.createBranch(ethChain, ethContract.address, supply);

      const amountTransferTokens = ethers.BigNumber.from(supplyStringTotal).div(2).toString();

      await expect(
        token.connect(alice).transferToBranch(ethChain, amountTransferTokens)
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(token.transferToBranch(currentChain, amountTransferTokens)).to.be.revertedWith(
        'DAO: operation allowed only for branch'
      );

      await expect(token.transferToBranch(bnbChain, amountTransferTokens)).to.be.revertedWith(
        'DAO: branch not minted'
      );
      await expect(
        token.transferToBranch(ethChain, ethers.BigNumber.from(supplyStringTotal).mul(2).toString())
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');

      const tx = await token.transferToBranch(ethChain, amountTransferTokens);

      await expect(tx)
        .to.emit(token, 'Transfer')
        .withArgs(owner.address, emptyAddress, amountTransferTokens);

      const totalSupply = await token.totalSupply();
      const currentChainSupply = await token.currentChainSupply();
      const branchSupply = await token.branchSupply(ethChain);

      expect(totalSupply.toString(), 'totalSupply').to.eq(
        ethers.BigNumber.from(supplyStringTotal).mul(2).toString()
      );
      expect(currentChainSupply.toString(), 'currentChainSupply').to.eq(amountTransferTokens);
      expect(branchSupply.toString(), 'branchSupply').to.eq(
        ethers.BigNumber.from(supplyStringTotal).add(amountTransferTokens).toString()
      );

      await expect(
        token
          .connect(alice)
          .transferFromBranch(ethChain, supplyStringTotal, transferFromBranchHash, [], [])
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        token.transferFromBranch(currentChain, supplyStringTotal, transferFromBranchHash, [], [])
      ).to.be.revertedWith('DAO: operation allowed only for branch');

      await expect(
        token.transferFromBranch(bnbChain, supplyStringTotal, transferFromBranchHash, [], [])
      ).to.be.revertedWith('DAO: branch not minted');

      await expect(
        token.transferFromBranch(ethChain, `${supplyStringTotal}0`, transferFromBranchHash, [], [])
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');

      await expect(
        token.transferFromBranch(
          ethChain,
          supplyStringTotal,
          transferFromBranchHash,
          [owner.address],
          []
        )
      ).to.be.revertedWith('DAO: wrong data');

      await expect(
        token.transferFromBranch(ethChain, supplyStringTotal, transferFromBranchHash, [], [])
      ).to.be.revertedWith('DAO: wrong amount');

      const txReverse = await token.transferFromBranch(
        ethChain,
        supplyStringTotal,
        transferFromBranchHash,
        [owner.address],
        [supplyStringTotal]
      );

      await expect(txReverse)
        .to.emit(token, 'Transfer')
        .withArgs(emptyAddress, owner.address, supplyStringTotal);

      await expect(txReverse)
        .to.emit(token, 'CrossChainTransfer')
        .withArgs(transferFromBranchHash, supplyStringTotal);

      const reverseTotalSupply = await token.totalSupply();
      const reverseCurrentChainSupply = await token.currentChainSupply();
      const reverseBranchSupply = await token.branchSupply(ethChain);

      expect(reverseTotalSupply.toString(), 'totalSupply').to.eq(
        ethers.BigNumber.from(supplyStringTotal).mul(2).toString()
      );
      expect(reverseCurrentChainSupply.toString(), 'currentChainSupply').to.eq(
        ethers.BigNumber.from(supplyStringTotal).add(amountTransferTokens).toString()
      );
      expect(reverseBranchSupply.toString(), 'branchSupply').to.eq(amountTransferTokens);
    });

    it('Deprecate branch', async () => {
      await expect(token.deprecateBranch(ethChain)).to.be.revertedWith('DAO: branch not minted');

      await token.createBranch(bnbChain, bnbContract.address, supply);
      await token.createBranch(ethChain, ethContract.address, supply);

      const usedChains = await token.usedChains();
      expect(usedChains, 'usedChains').to.eql([currentChain, bnbChain, ethChain]);

      await expect(token.deprecateBranch(ethChain)).to.be.revertedWith('DAO: branch has balance');

      await token.transferFromBranch(
        ethChain,
        supplyStringTotal,
        transferFromBranchHash,
        [owner.address],
        [supplyStringTotal]
      );

      await expect(token.connect(alice).deprecateBranch(ethChain)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(token.deprecateBranch(currentChain)).to.be.revertedWith(
        'DAO: operation allowed only for branch'
      );

      await token.deprecateBranch(ethChain);

      const usedChainsAfter = await token.usedChains();
      const deprecatedChains = await token.deprecatedChains();

      expect(usedChainsAfter, 'usedChains').to.eql([currentChain, bnbChain]);
      expect(deprecatedChains, 'deprecatedChains').to.eql([ethChain]);

      await expect(token.transferToBranch(ethChain, supplyStringTotal)).to.be.revertedWith(
        'DAO: branch is deprecated'
      );

      await token.transferFromBranch(
        bnbChain,
        supplyStringTotal,
        transferFromBranchHash,
        [owner.address],
        [supplyStringTotal]
      );

      await token.deprecateBranch(bnbChain);

      await expect(token.transferToBranch(ethChain, supplyStringTotal)).to.be.revertedWith(
        'DAO: branch is deprecated'
      );
    });

    it('Change branch contract', async () => {
      await expect(token.changeBranchContract(ethChain, newEthContract.address)).to.be.revertedWith(
        'DAO: branch not minted'
      );

      await token.createBranch(ethChain, ethContract.address, supply);

      await expect(
        token.connect(alice).changeBranchContract(ethChain, newEthContract.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        token.changeBranchContract(currentChain, newEthContract.address)
      ).to.be.revertedWith('DAO: operation allowed only for branch');

      await expect(token.changeBranchContract(ethChain, emptyAddress)).to.be.revertedWith(
        'DAO: wrong address'
      );

      await token.changeBranchContract(ethChain, newEthContract.address);

      const branchContract = await token.branchContract(ethChain);
      expect(branchContract).to.eq(newEthContract.address);
    });
  });
});
