
if (typeof web3 === "undefined" || typeof ethereum === "undefined") {
  document.body.innerHTML = "An ethereum provider must be installed and must be injecting web3 into your browser to continue. Please enable MetaMask or compatible wallet then try again.";
} else {
  // web3 = new Web3(web3.currentProvider); // <-- use a wallet like meta mask
  web3 = new Web3(new Web3.providers.WebsocketProvider("ws://127.0.0.1:8545"));

  function init() {
    const locationHash = document.location.hash;
    if (locationHash.length > 1) {
      try {
        const hash = atob(locationHash.replace(/^#/, ""));
        const parts = hash.split(":");
        const list = parts[0].split(",").map(s => s.trim());
        const gameAddress = parts[1].trim()
        const state = new State();
        startGame(unique(list), state, gameAddress);
      } catch(e) {
        document.body.innerHTML  = "There was an error: " + e;
      }
    } else {
      document.body.innerHTML = `
        <div>
          <button class=unlock>Unlock Accounts</button>
        </div>`;
      document.getElementsByClassName("unlock")[0].addEventListener("click", inviteList);
    }
  }
  init();
}
