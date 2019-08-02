pragma solidity ^0.5.0;

contract Contract {
  /* array */
  address[] public addresses0;
  function createGame0(address[] memory _addresses) public {
    addresses0 = _addresses;
  }

  function verify0() public view returns (bool) {
    for (uint i = 0; i < addresses0.length; i++) {
      if (addresses0[i] == msg.sender) {
        return true;
      }
    }
    return false;
  }


  /* mapping */
  mapping(address => bool) addresses;
  function createGame1(address[] memory _addresses) public {
    for (uint i = 0; i < _addresses.length; i++) {
      addresses[_addresses[i]] = true;
    }
  }

  function verify1() public view returns (bool) {
    return addresses[msg.sender];
  }

  /** merkle tree */
  bytes32 public merkleRoot;
  function createGame2(bytes32 _merkleRoot) public {
    merkleRoot = _merkleRoot;
  }

  mapping(address => bool) validAddresses1;

  function verify2(
    bytes32[] memory proof
  )
    public
    returns (bool)
  {
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
    if(computedHash == merkleRoot){
      validAddresses1[msg.sender] = true;
      return true;
    } else {
      return false;
    }
  }

  /** optimized merkle tree */
  mapping(address => bool) validAddresses2;

  // proof
  bytes32 public merkleRootA;
  bytes32 public merkleRootB;
  function createGame3(bytes32 _merkleRootA, bytes32 _merkleRootB) public {
    merkleRootA = _merkleRootA;
    merkleRootB = _merkleRootB;
  }

  function verify3(
    bytes32[] memory proof
  )
    public
    returns (bool)
  {
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
    if(computedHash == merkleRootA || computedHash == merkleRootB){
      validAddresses2[msg.sender] = true;
      return true;
    } else {
      return false;
    }
  }
}
