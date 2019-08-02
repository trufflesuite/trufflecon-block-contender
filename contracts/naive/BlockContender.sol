pragma solidity ^0.5.10;

import "../Game.sol";

contract BlockContender is Game {

  uint WIDTH = 5;
  uint MOVE_COST = 2;
  uint MIN_WAGER = 10;
  uint ROUND_REWARD = 10;
  uint16 STARTING_MONEY = 1000;
  uint NUMBER_PLAYERS = 0;

  struct Move {
    address id;
    uint wager;
    uint round;
    bool exists;
  }

  mapping (address => bool) registered;
  mapping(address => bool) hasRevealed;
  mapping (address => bool) addresses;
  mapping (address => uint) balances;
  mapping (address => uint) positions;

  mapping (address => bytes32) hashes;

  Move[25] locations;


  mapping (address => uint) idLookup;

  uint round = 1;
  uint registerCount = 0;
  uint commitCount = 0;
  uint revealCount = 0;

  event CommitEvent(address sender);
  event RevealEvent(uint x, uint y, uint wager, address sender);
  event RegisterEvent(address sender);

  modifier isRegistered() {
    require(registered[msg.sender], "You must be registered to play!");
    _;
  }

  function init(address[] memory players) public {
    NUMBER_PLAYERS = players.length;
    for (uint i = 0; i < NUMBER_PLAYERS; i++) {
      addresses[players[i]] = true;
    }
  }

  function me() public isRegistered view returns(uint256, uint256, uint256) {
    uint balance = balances[msg.sender];
    uint position = positions[msg.sender];
    return (balance, position / WIDTH, position % WIDTH);
  }

  function register() public notInProgress returns (bool) {
    require(addresses[msg.sender], "Invalid sender");
    require(!registered[msg.sender], "You have already registered!");
    registerCount++;

    registered[msg.sender] = true;
    balances[msg.sender] = STARTING_MONEY;
    uint startingPosition = (registerCount * (WIDTH * WIDTH)/NUMBER_PLAYERS) - 1;
    positions[msg.sender] = startingPosition;
    


















    Move storage move = locations[startingPosition];
    move.exists = true;
    move.round = 1;
    move.id = msg.sender;


    // if we have completed all registrations set the state to inProgress
    if (registerCount == NUMBER_PLAYERS) {
      inProgress = true;
      isCommit = true;
    }



  }

  function reveal(uint salt, uint x, uint y, uint wager) public
  ifInProgress
  isRegistered
  notCommitPhase
  returns (bool) {
    require(!hasRevealed[msg.sender], "You have already made a move!");




    bytes memory encoded = abi.encodePacked(salt, x, y, wager, msg.sender);
    bytes32 keccak = keccak256(encoded);
    require(keccak == hashes[msg.sender], "so sad");

    hashes[msg.sender] = 0;

    uint by = positions[msg.sender] % WIDTH;
    uint bx = positions[msg.sender] / WIDTH;
    uint cost = getDistance(x, y, bx, by) * MOVE_COST;
    require(wager >= MIN_WAGER, "Wager too low");
    require(balances[msg.sender] - cost - wager >= 0, "Insufficent funds for this move.");
    balances[msg.sender] -= wager;
    balances[msg.sender] -= cost;
    balances[msg.sender] += ROUND_REWARD;

    uint location = x * WIDTH + y;
    positions[msg.sender] = location;

    Move storage move = locations[location];
    if (!move.exists) {
      move.id = msg.sender;
      move.wager = wager;
      move.round = round;
      move.exists = true;
    } else {
      if (move.wager < wager && move.round == round) {
        move.id = msg.sender;
        move.wager = wager;
      }
    }

    revealCount++;
    if (revealCount >= NUMBER_PLAYERS) {
      revealCount = 0;
      isCommit = true;
      round++;
    }





    emit RevealEvent(x, y, wager, msg.sender);
  }

  function calc(uint a, uint b) public view returns(uint) {
    if (b > a) {
      int one = int(a + WIDTH) - int(b);
      int two = int(b) - int(a);
      return uint(one < two ? one : two);
    } else {
      int one = int(b + WIDTH) - int(a);
      int two = int(a) - int(b);
      return uint(one < two ? one : two);
    }
  }

  function getDistance(uint aX, uint aY, uint bX, uint bY) public view returns (uint) {
    uint x = calc(aX, bX);
    uint y = calc(aY, bY);
    return x + y;
  }

  function commit(bytes32 moveHash) public
  ifInProgress
  isRegistered
  isCommitPhase {
    require(hashes[msg.sender] == 0, "You have already committed a move!");
    hashes[msg.sender] = moveHash;
    hasRevealed[msg.sender] = false;
    commitCount++;
    if (commitCount >= NUMBER_PLAYERS) {
      commitCount = 0;
      isCommit = false;
    }
    emit CommitEvent(msg.sender);
  }
}
