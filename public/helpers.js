const Buffer = buffer.Buffer;

let totalGasUsed = 0;
function logGasUsed(transactionName, tx, estimate) {
  console.log("***********************************");
  console.log(transactionName);
  console.log("Transaction Hash", tx.transactionHash);
  console.log("Gas Used", tx.gasUsed);
  totalGasUsed += tx.gasUsed;
  console.log("Estimate", estimate);
  console.log("***********************************");
  printGasUsed();
}

function printGasUsed(){
  let con = document.getElementById("console")
  if (!con) {
    con = document.createElement("div");
    con.id = "console";
    document.body.appendChild(con);
  }
  con.innerHTML = totalGasUsed.toLocaleString() + " gas used";
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function unique(list) {
  return [...new Set(list)];
}

function bufferToHex(buf) {
  return `0x${buf.toString("hex")}`;
}

/**
   Returns the shortest path from one position to another.
 **/
function getDistance(positionA, positionB) {
  function calc(axis) {
    if (positionB[axis] > positionA[axis]) {
      return Math.min(
        positionA[axis] + WIDTH - positionB[axis],
        positionB[axis] - positionA[axis]
      );
    } else {
      return Math.min(
        positionB[axis] + WIDTH - positionA[axis],
        positionA[axis] - positionB[axis]
      );
    }
  }
  const x = calc("x");
  const y = calc("y");

  return x + y;
}

function lockUI(message) {
  let lockDiv = document.getElementById("ui-overlay");
  if (!lockDiv) {
    lockDiv = document.createElement("div");
    lockDiv.id = "ui-overlay";
    document.body.appendChild(lockDiv);
  }
  lockDiv.innerHTML = message || "Check Wallet";
}

function unlockUI() {
  let lockDiv = document.getElementById("ui-overlay")
  if (lockDiv) {
    lockDiv.remove();
  }
}

function error(error) {
  return { error };
}

async function unlockAccounts() {
  lockUI();
  const accounts = await ethereum.enable();
  unlockUI();
  if (!accounts || accounts.length === 0) {
    document.body.innerHTML = "No accounts returned. Please try again.";
    return null;
  }
  return accounts[0];
}

const contracts = {
  Main: fetch("./build/contracts/Main.json").then(r => r.json()),
  BlockContender: fetch("./build/contracts/BlockContender.json").then(r => r.json()),
  OptimizedBlockContender: fetch("./build/contracts/OptimizedBlockContender.json").then(r => r.json())
};
async function getContract(contractName, from, address) {
  const data = await contracts[contractName];
  return new web3.eth.Contract(data.abi, address || data.networks["1337"].address, { from: from });
}

function Resolver() {
  let resolve;
  const promise = new Promise(_resolve => {
    resolve = _resolve;
  });
  promise.resolve = resolve;
  return promise;
}

function generateSalt() {
  return Math.floor(Math.random() * 256);
}

function validateBalance(wager, moveCost, player) {
  if (wager < MIN_WAGER) {
    alert("You must wager at least " + MIN_WAGER);
    return false;
  }
  if (wager > 1024) {
    alert("Wager too large");
    return false;
  }
  if (player.balance - moveCost - wager < 0) {
    alert("You don't have enough money to make this move with that wager!");
    return false;
  }
  return true;
}

function calculateStateFromLogs(logs){
  const positions = {};
  logs.forEach(log => {
    const move = {
      sender: log.returnValues.sender.toLowerCase(),
      wager: parseInt(log.returnValues.wager, 10),
      position: {
        x: parseInt(log.returnValues.x, 10),
        y: parseInt(log.returnValues.y, 10),
      }
    };
    const position = move.position.x * WIDTH + move.position.y;
    if (!positions[position]) {
      positions[position] = {owner: move, players : []};
    } else if (move.wager > positions[position].owner.wager) {
      positions[position].owner = move;
    } else if(move.wager === positions[position].owner.wager) {
      positions[position].owner = null;
    }
    positions[position].players.push(move.sender)
  });
  return positions;
}

function incrementScore(state, leaderboard, address) {
  let leaderLineEl = leaderboard.querySelector(`#_${address}`);
  if(!leaderLineEl){
    leaderLineEl = leaderboard.querySelector(".pending");
    leaderLineEl.classList = "";
    leaderLineEl.id = `_${address}`;
  }
  const scoreEl = leaderLineEl.querySelector(".score");
  const score = state.score[address] || 1;
  scoreEl.innerText = score + 1;
  state.score[address] = score + 1;
  state.total++;
}

function updateBoard(game, moves, state, player) {
  const board = game.board;
  const playerPositions = [...board.getElementsByClassName("player")];
  for (let i = 0, l = playerPositions.length; i < l; i++) {
    try {
      playerPositions[i].classList.remove("player");
    } catch(e) {
      console.log(e);
    }
  }
  Object.keys(moves).forEach(key => {
    key = parseInt(key, 10);
    const blockState = moves[key];
    const position = {
      x: Math.floor(key / WIDTH),
      y: key % WIDTH
    };
    const el = board.querySelector(`div.row:nth-child(${position.y + 1})>button:nth-child(${position.x + 1})`);
    // remove all classes
    el.classList = "";
    if (blockState.owner) {
      el.classList.add("taken");
      if (blockState.owner.sender === player.address) {
        el.classList.add("mine");
        state.updateCell(position, player.address);
      } else {
        state.updateCell(position, blockState.owner.sender);
      }
      incrementScore(state, game.leaderboard, blockState.owner.sender);
    }
    blockState.players.forEach(currentPlayer => {
      if (currentPlayer === player.address) {
        el.classList.add("current");
      } else {
        el.classList.add("player");
      }
    });
  });
}

function checkScores(state) {
  if (state.total === WIDTH * WIDTH){
    let winners = [];
    let top = 0;
    Object.keys(state.score).forEach(key => {
      if(state.score[key] >= top){
        if(state.score[key] === top){
          winners.push(key)
        } else {
          winners = [key];
        }
        top = state.score[key];
      }
    });
    const text = winners.length === 1 ? "The winner is" : "The winners are";
    const message = `${text}...<br><br>${winners.join("<br>")}`;
    lockUI(message);
  }
}

function drawGame(state, player, list) {
  const numberOfPlayers = list.length;
  state.total = numberOfPlayers;
  const startingLocations = new Set();
  const fields = [];
  fields.push("<div class='leaderboard'>")
  fields.push("<h3>Leaderboard</h3>");
  fields.push("<ul>");
  for (let i = 1; i <= numberOfPlayers; i++) {
    const location = Math.floor(i * (WIDTH * WIDTH)/numberOfPlayers) - 1;
    startingLocations.add(location);
    fields.push(` <li class='${list[i-1].toLowerCase() === player.address ? "you" : ""}' id='_${list[i-1].toLowerCase()}'>Player ${i}: <span class='score'>1</span></li>`);
  }
  
  fields.push("</ul>");
  fields.push("</div>");
  fields.push(`<div>Balance: <span class='money'>${STARTING_MONEY}</span></div>`);
  fields.push("<div class='game'>");
  
  for (let y = 0; y < WIDTH; y++) {
    fields.push("<div class='row'>");
    const row = [];
    state.cells.push(row);
    for (let x = 0; x < WIDTH; x++) {
      const classes = [];
      const location = x * WIDTH + y;
      row.push({ y, x, owner: null, players: [] });
      if (startingLocations.has(location)) {
        classes.push("taken");
        if (player.position.x === x && player.position.y === y){
          classes.push("mine", "current");
          state.updateCell(player.position, player.address);
        } else {
          classes.push("player");
          state.updateCell({x, y}, null);
        }
      }
      // TODO: draw players and mark owner
      fields.push(`<button class='${classes.join(" ")}' data-position='{"y":${y},"x":${x}}'></button>`);
    }
    fields.push("</div>");
  }
  fields.push("</div>");
  fields.push(`<div>`);
  fields.push(`Wager: <input class='wager' type='number' min='0' max='${player.balance}' value='${DEFAULT_WAGER}'/> `);
  fields.push("<button class='submit' disabled>Submit!</button>");
  fields.push(`</div>`);
  fields.push(`<hr/>`);
  document.body.innerHTML = fields.join("");
  printGasUsed();
  return {
    money: document.getElementsByClassName("money")[0],
    board: document.getElementsByClassName("game")[0],
    submit: document.getElementsByClassName("submit")[0],
    wager: document.getElementsByClassName("wager")[0],
    leaderboard: document.getElementsByClassName("leaderboard")[0],
    player,
    nextTarget: null,
    nextPosition: null
  }
}