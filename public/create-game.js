async function inviteList() {
  const creatorAddress = await unlockAccounts();
  if (!creatorAddress) return;

  document.body.innerHTML = `
    <div>
      Your address:<br/>
      <textarea cols=41 rows=1 readonly>${creatorAddress}</textarea><br/><br/>
      Invite list (one Ethereum address per line):<br/>
      <textarea cols=41 rows=10 autofocus></textarea><br/><br/>
      <button class=create-game>Create New Game</button>
    </div>`;
  document.getElementsByClassName("create-game")[0].addEventListener("click", createNewGame.bind(this, creatorAddress));
}

async function createNewGame(creatorAddress) {
  let list = document.getElementsByTagName("textarea")[1].value.split("\n")
    .map(s => s.trim())
    .filter(s => s != null && s !== "");
  list.unshift(creatorAddress);

  list = unique(list);

  const contract = await getContract("Main", creatorAddress);

  lockUI();
  let newGame;
  if (USE_NAIVE) {
    newGame = contract.methods.NewGame(list);
  } else {
    const merkle = new MerkleTree(["leaf", ...list]);
    const root = merkle.getHexRoot();
    newGame = contract.methods.NewGameOptimizedGame(root, list.length);
  }

  let newGameTxHash;
  const newGamePromise = new Resolver();
  const estimate = await newGame.estimateGas();
  const pendingNewGame = newGame.send({gas: estimate}).catch(error);
  const newGameUnsubscribe = await contract.events.NewGameEvent(async (_, log) => {
    // make sure we don't process the event before we get the transaction receipt
    // (ganache can be too fast sometimes)
    await pendingNewGame;
    if (log.transactionHash === newGameTxHash) {
      newGameUnsubscribe.unsubscribe();
      newGamePromise.resolve(log.returnValues.gameAddress);
    }
  });
  const newGameResult = await pendingNewGame;
  if (!newGameResult || newGameResult.error) {
    document.body.innerHTML = "Didn't work. " + (newGameResult ? newGameResult.error : "");
    return;
  }
  logGasUsed("New Game", newGameResult, estimate);

  newGameTxHash = newGameResult.transactionHash;
  const gameContractAddress = await newGamePromise;
  unlockUI();

  const hash = btoa(`${unique(list).join(",")}:${gameContractAddress}`);
  const url = `${document.location.href}#${hash}`;

  document.body.innerHTML = `
    <div>
      Send this link to your friends:
      <a href='${encodeURI(url)}' target=_blank>${escapeHtml(url)}</a>
      <hr>
      <button>Play!</button>
    </div>`;
  printGasUsed();
  document.getElementsByTagName("button")[0].addEventListener("click", () => {
    document.location.hash = hash;
    const state = new State();
    startGame(list, state, gameContractAddress);
  });
}
