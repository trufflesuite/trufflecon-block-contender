const Main = artifacts.require("Main");
const OptimizedBlockContender = artifacts.require("optimized/OptimizedBlockContender");

module.exports = async function(deployer) {
  await deployer.deploy(Main);
  await deployer.deploy(OptimizedBlockContender);
};
