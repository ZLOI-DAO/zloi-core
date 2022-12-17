import { ethers } from 'hardhat';

async function main() {
  const [owner] = await ethers.getSigners();
  const ZLOIDAO = await ethers.getContractFactory('ZLOIDAO', owner);
  const zloiDao = await ZLOIDAO.deploy();

  await zloiDao.deployed();

  console.log(`DAO deployed to ${zloiDao.address}`);

  const token = await zloiDao.token();

  console.log(`Token deployed to ${token}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
