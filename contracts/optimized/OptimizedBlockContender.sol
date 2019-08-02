pragma solidity ^0.5.10;

import "../Game.sol";

contract OptimizedBlockContender is Game {
  bytes32 public merkleRoot;
  uint8 constant WIDTH = 5; // use constants save on SLOAD
  uint8 constant MOVE_COST = 2;
  uint8 constant MIN_WAGER = 10;
  uint8 constant ROUND_REWARD = 10;
  uint16 constant STARTING_MONEY = 1000;
  uint8 NUMBER_PLAYERS = 0;

  struct Move {
    uint16 id;
    uint16 wager;
    uint8 round;
    bool exists;
  }

  struct State {
    address addr;
    uint16 balance;
    uint8 position; // last valid position
  }

  mapping (address => bytes32) hashes;

  Move[WIDTH * WIDTH] locations;

  mapping (uint8 => State) stateLookup;
  mapping (address => uint8) idLookup;

  uint8 round = 1;
  uint8 registerCount = 0;
  uint8 playCount = 0; // reuse

  event CommitEvent(address sender);
  event RevealEvent(uint8 x, uint8 y, uint16 wager, address sender);
  event RegisterEvent(address sender);

  modifier isRegistered() {
    require(idLookup[msg.sender] > 0, "You must be registered to play!");
    _;
  }

  function init(bytes32 _merkleRoot, uint8 numOfPlayers) external {

    NUMBER_PLAYERS = numOfPlayers;

    merkleRoot = _merkleRoot;
  }

  function me() external isRegistered view returns(uint16, uint8, uint8) {
    State memory state = stateLookup[idLookup[msg.sender]];

    return (state.balance, state.position / WIDTH, state.position % WIDTH);
  }

  function register(bytes32[] calldata proof) external notInProgress returns (bool) {
    require(idLookup[msg.sender] == 0, "You have already registered!");
    bytes32 computedHash = keccak256(abi.encodePacked(msg.sender));

    for (uint256 i = 0; i < proof.length; i++) {
      bytes32 proofElement = proof[i];
      if (computedHash < proofElement) {
        // Hash(current computed hash + current element of the proof)
        computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
      } else {
        // Hash(current element of the proof + current computed hash)
        computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
      }
    }

    // Check if the computed hash (root) is equal to the provided root
    if (computedHash == merkleRoot) {
      registerCount++;
      idLookup[msg.sender] = registerCount;

      uint32 startingPosition = (registerCount * (WIDTH * WIDTH)/NUMBER_PLAYERS) - 1;

      State memory current = stateLookup[registerCount];
      current.addr = msg.sender;
      current.balance = STARTING_MONEY;
      current.position = uint8(startingPosition);
      stateLookup[registerCount] = current;

      Move memory move = locations[startingPosition];
      move.round = 0;
      move.id = registerCount;
      move.exists = true;
      locations[startingPosition] = move;

      // if we have completed all registrations set the state to inProgress
      if (registerCount == NUMBER_PLAYERS) {
        inProgress = true;
        isCommit = true;
      }
    } else {
      revert("Invalid Proof");
    }
  }

  function reveal(uint8 salt, uint8 x, uint8 y, uint16 wager) external
  ifInProgress
  isRegistered
  notCommitPhase
  returns (bool) {
    uint8 id = idLookup[msg.sender];
    State memory current = stateLookup[id];
    Move memory prevMove = locations[current.position];
    require(prevMove.round < round, "You have already made a move!");

    bytes memory encoded = abi.encodePacked(salt, x, y, wager, msg.sender);
    bytes32 keccak = keccak256(encoded);
    require(keccak == hashes[msg.sender], "so sad");

    hashes[msg.sender] = 0;

    uint8 by = current.position % WIDTH;
    uint8 bx = current.position / WIDTH;
    uint8 cost = getDistance(x, y, bx, by) * MOVE_COST;
    require(wager >= MIN_WAGER, "Wager too low");
    require(int32(current.balance) - int32(cost) - int32(wager) >= 0, "Insufficent funds for this move.");

    uint16 fee = wager + cost - ROUND_REWARD;
    current.balance -= fee;

    uint location = x * WIDTH + y;
    current.position = uint8(location);

    Move memory move = locations[location];
    if(!move.exists) {
      move.id = id;
      move.wager = wager;
      move.round = round;
      move.exists = true;
    } else {
      if (move.wager < wager && move.round == round) {
        move.id = id;
        move.wager = wager;
      }
    }


    if (playCount + 1 >= NUMBER_PLAYERS) {
      playCount = 0;
      isCommit = true;
      round++;
    } else {
      playCount++;
    }

    stateLookup[id] = current;
    locations[location] = move;
    emit RevealEvent(x, y, wager, msg.sender);
  }

  function calc(uint8 a, uint8 b) public pure returns(uint8) {
    if (b > a) {
      int8 one = int8(a + WIDTH) - int8(b);
      int8 two = int8(b) - int8(a);
      return uint8(one < two ? one : two);
    } else {
      int8 one = int8(b + WIDTH) - int8(a);
      int8 two = int8(a) - int8(b);
      return uint8(one < two ? one : two);
    }
  }

  function getDistance(uint8 aX, uint8 aY, uint8 bX, uint8 bY) public pure returns (uint8) {
    uint8 x = calc(aX, bX);
    uint8 y = calc(aY, bY);
    return x + y;
  }

  function commit(bytes32 moveHash) external
  ifInProgress
  isRegistered
  isCommitPhase {
    require(hashes[msg.sender] == 0, "You have already committed a move!");
    hashes[msg.sender] = moveHash;
    if (playCount + 1 >= NUMBER_PLAYERS) {
      playCount = 0;
      isCommit = false;
    } else {
      playCount++;
    }
    emit CommitEvent(msg.sender);
  }
}
