// Copyright (C) 2016 Dmitry Chestnykh
// MIT License. See LICENSE file for details.

import { suite, test } from "mocha-typescript";
import { expect } from "chai";
import { AesExample } from "./support/test_vectors";

import PolyfillAes from "../src/internal/polyfill/aes";

@suite class PolyfillAesSpec {
  static vectors: AesExample[];

  static async before() {
    this.vectors = await AesExample.loadAll();
  }

  @test "should not accept wrong key length"() {
    expect(() => new PolyfillAes(new Uint8Array(10))).to.throw(/^AES/);
  }

  @test "should not accept different key in setKey()"() {
    const cipher = new PolyfillAes(new Uint8Array(32));
    expect(() => cipher.setKey(new Uint8Array(16))).to.throw(/^AES/);
  }

  @test "should correctly encrypt block"() {
    for (let v of PolyfillAesSpec.vectors) {
      const cipher = new PolyfillAes(v.key);
      const dst = new Uint8Array(16);
      cipher.encryptBlock(v.src, dst);
      expect(dst).to.eql(v.dst);
    }
  }

  @test "should correctly encrypt many blocks with different keys"() {
    let key = new Uint8Array(32);
    let block = new Uint8Array(16);
    const newKey = new Uint8Array(32);
    for (let i = 0; i < 100; i++) {
      const cipher = new PolyfillAes(key);
      for (let j = 0; j < 100; j++) {
        cipher.encryptBlock(block, block);
      }
      newKey.set(key.subarray(16, 32)); // move 16 bytes to left
      newKey.set(block, 16); // fill the rest 16 bytes with block
      key.set(newKey);
    }

    let expected = new Uint8Array([58, 111, 217, 50, 246, 8, 131, 95, 31, 86, 217, 220, 31, 206, 207, 163]);
    expect(block).to.eql(expected);
  }
}
