pragma solidity ^0.5.10;

contract Game {
  bool public inProgress = false;
  bool public isCommit = false;

  modifier ifInProgress() {
    require(inProgress, "Game is not in progress.");
    _;
  }

  modifier notInProgress() {
    require(!inProgress, "Game is in progress.");
    _;
  }

  modifier isCommitPhase() {
    require(isCommit, "Game is in reveal phase.");
    _;
  }

  modifier notCommitPhase() {
    require(!isCommit, "Game is in commit phase.");
    _;
  }
}
