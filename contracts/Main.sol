pragma solidity ^0.5.0;

import "./naive/BlockContender.sol";
import "./optimized/OptimizedBlockContender.sol";

contract Main {
    event NewGameEvent(address gameAddress);
    function NewGame(address[] memory list) public returns (bool) {
        // Triggers 1/64ths via CREATE
        BlockContender blockContender = new BlockContender();
        // Triggers 1/64ths via CALL
        blockContender.init(list);
        emit NewGameEvent(address(blockContender));
        return true;
    }
    function NewGameOptimizedGame(bytes32 merkleRoot, uint8 numOfPlayers) public returns (bool) {
        // Triggers 1/64ths via CREATE
        OptimizedBlockContender blockContender = new OptimizedBlockContender();
        // Triggers 1/64ths via CALL
        blockContender.init(merkleRoot, numOfPlayers);
        emit NewGameEvent(address(blockContender));
        return true;
    }
}
