async function register(list, player, contract) {
  lockUI();
  try {
    let register;
    if (USE_NAIVE) {
      register = contract.methods.register();
    } else {
      const merkle = new MerkleTree(["leaf", ...list]);
      const proof = merkle.getHexProof(player.address);
      register = contract.methods.register(proof);
    }

    const estimate = await register.estimateGas();
    const result = await register.send({gas: estimate}).catch(error);
    logGasUsed("Register", result, estimate);
    
    return result;
  } catch(e) {
    return {error: e};
  } finally {
    unlockUI();
  }
}

async function commitMove(contract, salt, position, wager, address) {
  let hashed;
  if (USE_NAIVE) {
    hashed = web3.utils.soliditySha3(
      {
        type: "uint",
        value: salt
      },
      {
        type: "uint",
        value: position.x
      },
      {
        type: "uint",
        value: position.y
      },
      {
        type: "uint",
        value: wager
      },
      {
        type: "address",
        value: address
      }
    );
  } else {
    hashed = web3.utils.soliditySha3(
      {
        type: "uint8",
        value: salt
      },
      {
        type: "uint8",
        value: position.x
      },
      {
        type: "uint8",
        value: position.y
      },
      {
        type: "uint16",
        value: wager
      },
      {
        type: "address",
        value: address
      }
    );
  }
  lockUI();
  const commit = contract.methods.commit(hashed);
  
  const estimate = await commit.estimateGas(); 
  const playResult = await commit.send({gas: Math.round(estimate * 1.2)}).catch(error);
  if (!playResult || playResult.error) {
    unlockUI();
    alert("An error occured: " + (playResult ? playResult.error : "unknown error"));
    return false;
  }
  logGasUsed("Commit", playResult, estimate);
}

async function revealMove(contract, salt, position, wager) {
  lockUI();
  
  const reveal = contract.methods.reveal(salt, position.x, position.y, wager);
  const estimate = await reveal.estimateGas();
  // use 20% more gas than estimated because of race conditions between other plays, the gas estimation
  // and the transaction
  const revealResult = await reveal.send({gas: Math.round(estimate * 1.2)}).catch(error);
  if (!revealResult || revealResult.error) {
    unlockUI();
    alert("An error occured: " + (revealResult ? revealResult.error : "unknown error"));
    return;
  }
  logGasUsed("Reveal", revealResult, estimate);
}

// logic
async function startGame(list, state, contractAddress) {
  const NUM_PLAYERS = list.length;
  const player = {
    balance: null,
    position: null,
    address: await unlockAccounts()
  };
  if (!player.address) return;

  const contract = await getContract(`${USE_NAIVE ? "" : "Optimized"}BlockContender`, player.address, contractAddress);

  // check if the player is regsitered already
  let rawPlayer;
  try {
    rawPlayer = await contract.methods.me().call();
  } catch (e) {
    // this error probably just means they haven't registered yet. ignore.
    console.log("This is probably fine: " + e);
  }

  let pendingCommits = SubscribeCommits();
  let pendingReveals = SubscribeReveals();

  if (!rawPlayer) {
    // register the player if they aren't already
    const registerResult = await register(list, player, contract);
    if (!registerResult || registerResult.error) {
      document.body.innerHTML = "Didn't work. " + (registerResult.error || " \\_(ツ)_/¯");
      return;
    }
    rawPlayer = await contract.methods.me().call();
  }

  player.balance = parseInt(rawPlayer[0], 10);
  player.position = {
    x: parseInt(rawPlayer[1], 10),
    y: parseInt(rawPlayer[2], 10)
  };
  lockUI("Waiting for other players to join...");
  await ready(contract);
  unlockUI();

  const game = drawGame(state, player, list);

  let currentEl = document.querySelector(`div.row:nth-child(${player.position.y + 1})>button:nth-child(${player.position.x + 1})`);

  async function SubscribeCommits(){
    const playEventCache = {};
    const playPromise = new Resolver();
    let counter = 0;
    const eventUnsubscriber = contract.events.CommitEvent(async (_, log) => {
      if (playEventCache[log.id]) return;
      playEventCache[log.id] = true;
      counter++;
      if (counter === NUM_PLAYERS) {
        await eventUnsubscriber.unsubscribe();
        playPromise.resolve(Object.values(playEventCache));
      }
    });
    return playPromise;
  }

  async function SubscribeReveals(){
    const revealEventCache = {};
    const revealPromise = new Resolver();
    let counter = 0;
    const eventUnsubscriber = await contract.events.RevealEvent(async (_, log) => {
      if (revealEventCache[log.id]) return; //avoid processing duplicate events
      revealEventCache[log.id] = log;
      counter++;
      if (counter === NUM_PLAYERS) {
        await eventUnsubscriber.unsubscribe();
        revealPromise.resolve(Object.values(revealEventCache));
      }
    });
    return revealPromise;
  }

  async function makeMove(state) {
    if (game.nextTarget && currentEl) {
      const distance = getDistance(game.nextPosition, player.position);
      const moveCost = distance * MOVE_COST;
      const wager = parseInt(game.wager.value, 10);
      if (!validateBalance(wager, moveCost, player)) {
        return;
      }
      const salt = generateSalt();

      await commitMove(contract, salt, game.nextPosition, wager, player.address);
      lockUI("Waiting for other players to move...");
      // wait for all players to make their move
      const hashesStates = await pendingCommits;
      pendingCommits = SubscribeCommits(); // resubscribe
      if(!hashesStates) return;
      
      lockUI("All moves committed. Reveal your move now.<br>Check Wallet");
      await revealMove(contract, salt, game.nextPosition, wager);
      // wait for all players to make their reveal
      lockUI("Waiting for other players to reveal...");
      const logs = await pendingReveals;
      pendingReveals = SubscribeReveals(); // resubscribe
      if(!logs) return;

      // moves done, update board:
      currentEl.classList.remove("current");
      currentEl = game.nextTarget;
      currentEl.classList.add("current");
      currentEl.classList.remove("wager");

      // resolve wager/move conflicts:
      const newMoves = calculateStateFromLogs(logs);
      updateBoard(game, newMoves, state, player);

      // update player:
      player.balance -= moveCost;
      player.balance -= wager;
      player.balance += ROUND_REWARD;
      game.money.innerHTML = player.balance;
      player.position = game.nextPosition;

      // update state:
      state.updateCell(player.position, player.address);

      // get ready for next move
      game.nextTarget = null;
      game.nextPosition = null;
      game.submit.disabled = true;
      game.board.classList.remove("disabled");

      unlockUI();

      checkScores(state);
    }
  }

  // listen for all click events within the board
  game.board.addEventListener("click", (e) => {
    if (game.board.classList.contains("disabled")) return;

    const target = e.target;
    if (target.tagName === "BUTTON") {
      handleClick(target, game);
    }
  });
  // listen for submit button click:
  game.submit.addEventListener("click", makeMove.bind(this, state));
}

function handleClick(target, game) {
  const targetPosition = JSON.parse(target.dataset.position);
  if (!target.classList.contains("taken")) {
    const distance = Math.abs(targetPosition.x - game.player.position.x) + Math.abs(targetPosition.y - game.player.position.y);
    const moveCost = distance * MOVE_COST;
    if (moveCost + MIN_WAGER > game.player.balance) {
      // they can't move this far because they are broke
      return;
    }

    target.classList.add("wager");

    game.nextTarget && game.nextTarget.classList.remove("wager");
    game.nextTarget = target;
    game.nextPosition = targetPosition;
    game.submit.disabled = false;

    game.wager.max = game.player.balance - moveCost;
    if (parseInt(game.wager.value) > game.wager.max) {
      game.wager.value = game.wager.max;
    }
  }
}

function ready(contract) {
  return new Promise(async (resolve) => {
    let inProgress = false;
    while (!inProgress) {
      inProgress = await contract.methods.inProgress().call();
    }
    resolve();
  });
}
