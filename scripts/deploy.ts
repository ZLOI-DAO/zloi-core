import { ethers } from 'hardhat';

async function main() {
  const [owner] = await ethers.getSigners();
  const ZLOIDAO = await ethers.getContractFactory('ZLOIDAO', owner);
  const zloiDao = await ZLOIDAO.deploy(1000000000, 100000000, 50000000, 137, owner.address);

  await zloiDao.deployed();

  console.log(`DAO deployed to ${zloiDao.address}`);

  const dex = await zloiDao.dex();

  console.log(`DEX deployed to ${dex}`);

  const token = await zloiDao.token();

  console.log(`Token deployed to ${token}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
