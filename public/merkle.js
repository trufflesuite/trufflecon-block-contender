// Copyright 2019, 2019 Roman Storm, Nikita Tolkachev
// Original source: https://github.com/rstormsf/merkleairdrop/blob/master/frontend/src/Services/MerkleTree.js
// License: ISC
// Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, 
// provided that the above copyright notice and this permission notice appear in all copies.
// 
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
// 
// Modified by David Murdoch and Nicholas Paterno

class MerkleTree {
  constructor(elements) {
    // Filter empty strings and hash elements
    this.elements = elements.filter(el => el).map(el => Buffer.from(Web3.utils.soliditySha3(el).substring(2), "hex"))
    // Deduplicate elements
    this.elements = this.bufDedup(this.elements)
    // Sort elements
    this.elements.sort(Buffer.compare)

    // Create layers
    this.layers = this.getLayers(this.elements)
  }

  getLayers(elements) {
    if (elements.length === 0) {
      return [[""]]
    }

    const layers = []
    layers.push(elements)

    // Get next layer until we reach the root
    while (layers[layers.length - 1].length > 1) {
      layers.push(this.getNextLayer(layers[layers.length - 1]))
    }

    return layers
  }

  getNextLayer(elements) {
    return elements.reduce((layer, el, idx, arr) => {
      if (idx % 2 === 0) {
        // Hash the current element with its pair element
        layer.push(this.combinedHash(el, arr[idx + 1]))
      }

      return layer
    }, [])
  }

  combinedHash(first, second) {
    if (!first) {
      return second
    }
    if (!second) {
      return first
    }

    const concat = this.sortAndConcat(first, second);
    const hex = Web3.utils.soliditySha3("0x" + concat.toString("hex")).substring(2);
    return Buffer.from(hex, "hex")
  }

  getRoot() {
    return this.layers[this.layers.length - 1][0]
  }

  getHexRoot() {
    return bufferToHex(this.getRoot())
  }

  getProof(el) {
    let idx = this.bufIndexOf(el, this.elements)
    if (idx === -1) {
      throw new Error("Element does not exist in Merkle tree")
    }

    return this.layers.reduce((proof, layer) => {
      const pairElement = this.getPairElement(idx, layer)
      if (pairElement) {
        proof.push(pairElement)
      }

      idx = Math.floor(idx / 2)

      return proof
    }, [])
  }

  getHexProof(el) {
    const proof = this.getProof(el)

    return this.bufArrToHexArr(proof)
  }

  getHexProofSkip0x(el) {
    const proof = this.getProof(el)

    return proof.map(el => el.toString("hex"))
  }

  getPairElement(idx, layer) {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1

    if (pairIdx < layer.length) {
      return layer[pairIdx]
    } else {
      return null
    }
  }

  bufIndexOf(el, arr) {
    let hash

    // Convert element to 32 byte hash if it is not one already
    if (el.length !== 32 || !Buffer.isBuffer(el)) {
      hash = Buffer.from(Web3.utils.soliditySha3(el).substring(2), "hex")
    } else {
      hash = el
    }

    for (let i = 0; i < arr.length; i++) {
      if (hash.equals(arr[i])) {
        return i
      }
    }

    return -1
  }

  bufDedup(elements) {
    return elements.filter((el, idx) => {
      return this.bufIndexOf(el, elements) === idx
    })
  }

  bufArrToHexArr(arr) {
    if (arr.some(el => !Buffer.isBuffer(el))) {
      throw new Error("Array is not an array of buffers")
    }

    return arr.map(el => "0x" + el.toString("hex"))
  }

  sortAndConcat(...args) {
    return Buffer.concat([...args].sort(Buffer.compare))
  }
}
