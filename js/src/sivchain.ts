// Copyright (C) 2017 Dmitry Chestnykh
// MIT License. See LICENSE file for details.

import { AES } from "./internal/polyfill/aes";
import { CMAC, dbl } from "./internal/polyfill/cmac";
import { CTR } from "./internal/polyfill/ctr";
import { equal } from "./internal/constant-time";
import { wipe } from "./internal/wipe";
import { xor, zeroIVBits } from "./internal/util";

/** Maximum number of associated data items */
export const MAX_ASSOCIATED_DATA = 126;

/** Thrown when ciphertext fails to verify as authentic */
export class IntegrityError extends Error {
  constructor(m: string) {
    super(m);
    Object.setPrototypeOf(this, IntegrityError.prototype);
  }
}

/** The AES-SIV mode of authenticated encryption */
export class AESSIV {
  private _mac: CMAC;
  private _ctr: CTR | undefined;
  private _macCipher: AES;
  private _encCipher: AES;
  private _tmp1: Uint8Array;
  private _tmp2: Uint8Array;

  tagLength: number;

  static async importKey(key: Uint8Array): Promise<AESSIV> {
    const macKey = key.subarray(0, key.length / 2 | 0);
    const encKey = key.subarray(key.length / 2 | 0);

    return Promise.resolve(new AESSIV(macKey, encKey));
  }

  constructor(macKey: Uint8Array, encKey: Uint8Array) {
    this._macCipher = new AES(macKey);
    this._encCipher = new AES(encKey);
    this._mac = new CMAC(this._macCipher);

    if (this._mac.digestLength !== this._mac.blockSize) {
      throw new Error("AESSIV: this implementation needs CMAC block size to equal tag length");
    }
    this.tagLength = this._mac.digestLength;

    this._tmp1 = new Uint8Array(this._mac.digestLength);
    this._tmp2 = new Uint8Array(this._mac.digestLength);
  }

  async seal(associatedData: Uint8Array[], plaintext: Uint8Array): Promise<Uint8Array> {
    if (associatedData.length > MAX_ASSOCIATED_DATA) {
      throw new Error("AESSIV: too many associated data items");
    }

    // Allocate space for sealed ciphertext.
    const resultLength = this.tagLength + plaintext.length;
    let result = new Uint8Array(resultLength);

    // Authenticate.
    const iv = this._s2v(associatedData, plaintext);
    result.set(iv);

    // Encrypt.
    zeroIVBits(iv);
    this._streamXOR(iv, plaintext, result.subarray(iv.length));
    return result;
  }

  async open(associatedData: Uint8Array[], sealed: Uint8Array): Promise<Uint8Array> {
    if (associatedData.length > MAX_ASSOCIATED_DATA) {
      throw new Error("AESSIV: too many associated data items");
    }
    if (sealed.length < this.tagLength) {
      throw new IntegrityError("AESSIV: ciphertext is truncated");
    }

    // Allocate space for decrypted plaintext.
    const resultLength = sealed.length - this.tagLength;
    let result = new Uint8Array(resultLength);

    // Decrypt.
    const tag = sealed.subarray(0, this.tagLength);
    const iv = this._tmp1;
    iv.set(tag);
    zeroIVBits(iv);
    this._streamXOR(iv, sealed.subarray(this.tagLength), result);

    // Authenticate.
    const expectedTag = this._s2v(associatedData, result);

    if (!equal(expectedTag, tag)) {
      wipe(result);
      throw new IntegrityError("AESSIV: ciphertext verification failure!");
    }

    return Promise.resolve(result);
  }

  private _streamXOR(iv: Uint8Array, src: Uint8Array, dst: Uint8Array) {
    if (!this._ctr) {
      this._ctr = new CTR(this._encCipher, iv);
    } else {
      this._ctr.setCipher(this._encCipher, iv);
    }
    this._ctr.streamXOR(src, dst);
  }

  private _s2v(s: Uint8Array[], sn: Uint8Array): Uint8Array {
    if (!s) {
      s = [];
    }

    this._mac.reset();
    wipe(this._tmp1);

    // Note: the standalone S2V returns CMAC(1) if the number of passed
    // vectors is zero, however in SIV contruction this case is never
    // triggered, since we always pass plaintext as the last vector (even
    // if it's zero-length), so we omit this case.
    this._mac.update(this._tmp1);
    this._mac.finish(this._tmp2);
    this._mac.reset();

    for (let i = 0; i < s.length; i++) {
      this._mac.update(s[i]);
      this._mac.finish(this._tmp1);
      this._mac.reset();
      dbl(this._tmp2, this._tmp2);
      xor(this._tmp2, this._tmp1);
    }

    wipe(this._tmp1);

    if (sn.length >= this._mac.blockSize) {
      const n = sn.length - this._mac.blockSize;
      this._tmp1.set(sn.subarray(n));
      this._mac.update(sn.subarray(0, n));
    } else {
      this._tmp1.set(sn);
      this._tmp1[sn.length] = 0x80;
      dbl(this._tmp2, this._tmp2);
    }
    xor(this._tmp1, this._tmp2);
    this._mac.update(this._tmp1);
    this._mac.finish(this._tmp1);
    return this._tmp1;
  }

  clean() {
    wipe(this._tmp1);
    wipe(this._tmp2);
    if (this._ctr) {
      this._ctr.clean();
    }
    this._mac.clean();
    this._encCipher.clean();
    this._macCipher.clean();
    this.tagLength = 0;
  }
}
