import { Pset, payments, Creator, networks, address, Updater, Transaction } from "liquidjs-lib";
import * as varuint from "varuint-bitcoin";
/**
 * Size estimator for transactions.
 * This is ported from https://github.com/louisinger/marina
 *
 * MIT License
 *
 * Copyright (c) 2020 Vulpem Ventures
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

function estimateScriptSigSize(type) {
    switch (type) {
        case address.ScriptType.P2Pkh:
            return 108;
        case address.ScriptType.P2Sh:
        case address.ScriptType.P2Wsh:
            return 35;
        case address.ScriptType.P2Tr:
        case address.ScriptType.P2Wpkh:
            return 1; // one byte for the variable len encoding (varlen(0) = 1 byte)
        default:
            return 0;
    }
}

const INPUT_BASE_SIZE = 40; // 32 bytes for outpoint, 4 bytes for sequence, 4 for index
const UNCONFIDENTIAL_OUTPUT_SIZE = 33 + 9 + 1 + 1; // 33 bytes for value, 9 bytes for asset, 1 byte for nonce, 1 byte for script length

function txBaseSize(inScriptSigsSize, outNonWitnessesSize) {
    const inSize = inScriptSigsSize.reduce((a, b) => a + b + INPUT_BASE_SIZE, 0);
    const outSize = outNonWitnessesSize.reduce((a, b) => a + b, 0);
    return (
        9 +
        varuint.encodingLength(inScriptSigsSize.length) +
        inSize +
        varuint.encodingLength(outNonWitnessesSize.length + 1) +
        outSize
    );
}

function txWitnessSize(inWitnessesSize, outWitnessesSize) {
    const inSize = inWitnessesSize.reduce((a, b) => a + b, 0);
    const outSize = outWitnessesSize.reduce((a, b) => a + b, 0) + 1 + 1; // add the size of proof for unconf fee output
    return inSize + outSize;
}

// estimate pset virtual size after signing, take confidential outputs into account
// aims to estimate the fee amount needed to be paid before blinding or signing the pset
function estimateVirtualSize(pset, withFeeOutput) {
    const inScriptSigsSize = [];
    const inWitnessesSize = [];
    for (const input of pset.inputs) {
        const utxo = input.getUtxo();
        if (!utxo) throw new Error("missing input utxo, cannot estimate pset virtual size");
        const type = address.getScriptType(utxo.script);
        const scriptSigSize = estimateScriptSigSize(type);
        let witnessSize = 1 + 1 + 1; // add no issuance proof + no token proof + no pegin
        if (input.redeemScript) {
            // get multisig
            witnessSize += varSliceSize(input.redeemScript);
            const pay = payments.p2ms({ output: input.redeemScript });
            if (pay && pay.m) {
                witnessSize += pay.m * 75 + pay.m - 1;
            }
        } else {
            // len + witness[sig, pubkey]
            witnessSize += 1 + 107;
        }
        inScriptSigsSize.push(scriptSigSize);
        inWitnessesSize.push(witnessSize);
    }

    const outSizes = [];
    const outWitnessesSize = [];
    for (const output of pset.outputs) {
        let outSize = 33 + 9 + 1; // asset + value + empty nonce
        let witnessSize = 1 + 1; // no rangeproof + no surjectionproof
        if (output.needsBlinding()) {
            outSize = 33 + 33 + 33; // asset commitment + value commitment + nonce
            witnessSize = 3 + 4174 + 1 + 131; // rangeproof + surjectionproof + their sizes
        }
        outSizes.push(outSize);
        outWitnessesSize.push(witnessSize);
    }

    if (withFeeOutput) {
        outSizes.push(UNCONFIDENTIAL_OUTPUT_SIZE);
        outWitnessesSize.push(1 + 1); // no rangeproof + no surjectionproof
    }

    const baseSize = txBaseSize(inScriptSigsSize, outSizes);
    const sizeWithWitness = baseSize + txWitnessSize(inWitnessesSize, outWitnessesSize);
    const weight = baseSize * 3 + sizeWithWitness;
    return (weight + 3) / 4;
}

export default { estimateVirtualSize };
